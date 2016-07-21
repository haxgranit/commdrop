module UpstreamDownstream
  extend ActiveSupport::Concern
  
  def track_downstream_boards!(already_visited_ids=[], buttons_changed=false)
    @track_downstream_boards = true
    self.touch_downstreams(already_visited_ids)
    self.track_downstream_boards(already_visited_ids, buttons_changed)
    self.touch_downstreams(already_visited_ids)
    @track_downstream_boards = false
    true
  end
  
  def track_downstream_boards(already_visited_ids=[], buttons_changed=false)
    return unless @track_downstream_boards
    return if already_visited_ids.include?(self.global_id)
    already_visited_ids << self.global_id

    top_board = self
    # step 1: travel downstream, for every board id get its immediate children
    boards_with_children = {}
    board_edit_stats = {}
    unfound_boards = ["self"]
    while !unfound_boards.empty?
      id = unfound_boards.shift
      board = top_board 
      if id != "self"
        board = Board.find_by_path(id)
        board.reload if board
      end
      if board
        children_ids = []
        # also track button counts, used for board stats
        board_edit_stats[id] = {
          'total_buttons' => board.settings['buttons'].length,
          'unlinked_buttons' => board.settings['buttons'].select{|btn| !btn['load_board'] }.length,
          'current_revision' => board.current_revision
        }
        downs = (board.settings['immediately_downstream_board_ids'] || [])
        downs.each do |child_id|
          children_ids << child_id
          if !boards_with_children[child_id]
            unfound_boards << child_id
          end
        end
        boards_with_children[id] = children_ids
      end
    end
    
    
    # step 2: the complete downstream list is a collection of all these ids
    downs = []
    boards_with_children.each do |id, children|
      downs += children
    end
    downs = downs.uniq.sort - [top_board.global_id]
    changed = (downs != top_board.settings['downstream_board_ids'])
    total_buttons = 0
    unlinked_buttons = 0
    revision_hashes = [top_board.current_revision]
    # TODO: track last edit date for board and any sub-board (not the same as updated_at)
    downs.each do |id|
      if board_edit_stats[id]
        total_buttons += board_edit_stats[id]['total_buttons']
        unlinked_buttons += board_edit_stats[id]['unlinked_buttons']
        revision_hashes << board_edit_stats[id]['current_revision']
      end
    end
    downstream_boards_changed = false
    full_set_revision = Digest::MD5.hexdigest(revision_hashes.join('_'))[0, 10]
    if self.settings['full_set_revision'] != full_set_revision
      self.settings['full_set_revision'] = full_set_revision
      downstream_boards_changed = true
      BoardDownstreamButtonSet.schedule_once(:update_for, self.global_id)
    end
    downstream_buttons_changed = false
    if self.settings['total_downstream_buttons'] != total_buttons
      self.settings['total_downstream_buttons'] = total_buttons
      downstream_buttons_changed = true
    end
    if self.settings['unlinked_downstream_buttons'] != unlinked_buttons
      self.settings['unlinked_downstream_buttons'] = unlinked_buttons
      downstream_buttons_changed = true
    end
    self.settings['downstream_board_ids'] = downs

    # step 3: notify upstream if there was a change
    if changed || buttons_changed || downstream_buttons_changed || downstream_boards_changed
      @track_downstream_boards = false
      self.save_without_post_processing
      self.complete_stream_checks(already_visited_ids)
    end
    
    # step 4: update any authors whose list of visible/editable private boards may have changed
    if !@skip_update_available_boards
      self.schedule_update_available_boards('downstream')
    end
    @skip_update_available_boards = false
    
    true
  end
  
  def schedule_update_available_boards(breadth='all', frd=false)
    if !frd
      self.schedule_once(:schedule_update_available_boards, breadth, true)
      return true
    end
    ids = []
    if breadth == 'all'
      ids = self.share_ids
    elsif breadth == 'downstream'
      ids = self.downstream_share_ids
    elsif breadth == 'author'
      ids = self.author_ids
    end
    User.find_all_by_global_id(ids).each do |user|
      user.schedule_once(:update_available_boards)
    end
  end
    
  def complete_stream_checks(notify_upstream_with_visited_ids)
    # TODO: as-is this won't unlink from boards when a linked button is removed or modified
    # TODO: this is way too eager
    # Step 1: reach in and add to immediately_upstream_board_ids without triggering any background processes
    downs = Board.find_all_by_global_id(self.settings['immediately_downstream_board_ids'] || [])
    downs.each do |board|
      if board && (!board.settings['immediately_upstream_board_ids'] || !board.settings['immediately_upstream_board_ids'].include?(self.global_id))
        board.add_upstream_board_id!(self.global_id)
      end
    end
    # Step 2: trigger background heavy update for all immediately-upstream boards
    if notify_upstream_with_visited_ids
      ups = Board.find_all_by_global_id(self.settings['immediately_upstream_board_ids'] || [])
      ups.each do |board|
        if board && !notify_upstream_with_visited_ids.include?(board.global_id)
          board.track_downstream_boards!(notify_upstream_with_visited_ids)
        end
      end
    end
  end
  
  def add_upstream_board_id!(id)
    self.settings ||= {}
    self.settings['immediately_upstream_board_ids'] ||= []
    self.settings['immediately_upstream_board_ids'] << id
    self.settings['immediately_upstream_board_ids'] = self.settings['immediately_upstream_board_ids'].uniq.sort
    self.any_upstream = true
    self.save!
  end
  
  def update_any_upstream
    self.any_upstream = (self.settings['immediately_upstream_board_ids'] || []).length > 0
    self.save_without_post_processing
  end
  
  def touch_downstreams(already_visited_ids=[])
    ids = [self.global_id] + ((self.settings || {})['downstream_board_ids'] || [])
    ids -= already_visited_ids
    # TODO: sharding
    db_ids = self.class.local_ids(ids)
    Board.where(:id => db_ids).update_all(:updated_at => Time.now)
  end
  
  def schedule_downstream_checks
    if @track_downstream_boards || @buttons_affecting_upstream_changed
      self.schedule(:track_downstream_boards!, [], @buttons_affecting_upstream_changed)
      @buttons_affecting_upstream_changed = nil
      @track_downstream_boards = nil
    end
  end
  
  def update_immediately_downstream_board_ids
    downs = get_immediately_downstream_board_ids
    if self.settings['immediately_downstream_board_ids'] != downs || @buttons_changed
      @track_downstream_boards = true
      @buttons_affecting_upstream_changed = @buttons_changed
      self.settings['immediately_downstream_board_ids'] = downs
    end
  end
  
  def get_immediately_downstream_board_ids
    downs = []
    (self.settings['buttons'] || []).each do |button|
      if button['load_board'] && button['load_board']['id']
        downs << button['load_board']['id']
      end
    end
    downs = downs.uniq.sort
  end
  

  module ClassMethods
  end
  
  included do
    after_create :schedule_update_available_boards
    after_destroy :schedule_update_available_boards
  end
end