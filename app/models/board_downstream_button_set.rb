class BoardDownstreamButtonSet < ActiveRecord::Base
  MAX_DEPTH = 10
  include Async
  include GlobalId
  include SecureSerialize
  include ExtraData
  secure_serialize :data
  belongs_to :board
  include Replicate

  before_save :generate_defaults
  
  def generate_defaults
    self.data ||= {}
    self.data['remote_salt'] ||= GoSecure.nonce('remote_salt')
    @buttons = nil
    unless skip_extra_data_processing?
      self.data['board_ids'] = self.buttons.map{|b| b['board_id'] }.compact.uniq
      self.data['public_board_ids'] = Board.where(:id => Board.local_ids(self.data['board_ids']), :public => true).select('id').map(&:global_id)
      self.data['linked_board_ids'] = self.buttons.map{|b| b['linked_board_id'] }.compact.uniq
      self.data['button_count'] = self.buttons.length
      self.data['board_count'] = self.buttons.map{|b| b['board_id'] }.uniq.length
      self.data.delete('json_response')
    end
    true
  end
  
  def cached_json_response
    self.data && self.data['json_response']
  end
  
  def self.for_user(user)
    board_ids = []
    if user.settings['preferences'] && user.settings['preferences']['home_board']
      board_ids << user.settings['preferences']['home_board']['id']
    end
    board_ids += user.sidebar_boards.map{|b| b['key'] }
    boards = Board.find_all_by_path(board_ids).uniq
    
    button_sets = boards.map{|b| b.board_downstream_button_set }.compact.uniq
    button_sets.each{|bs| bs.assert_extra_data }
    button_sets
  end
  
  def buttons
    self.touch if self.updated_at && self.updated_at < 1.week.ago
    return @buttons if @buttons
    brd = self
    visited_sources = []
    while brd && brd.data['source_id'] && !visited_sources.include?(brd.global_id)
      visited_sources << brd.global_id
      bs = BoardDownstreamButtonSet.find_by_global_id(brd.data['source_id'])
      if bs && !bs.data['source_id']
        bs.assert_extra_data
        @buttons = bs.buttons_starting_from(self.related_global_id(self.board_id))
        bs.touch if bs.updated_at && bs.updated_at < 1.week.ago
        if self.data['source_id'] != bs.global_id
          self.data['source_id'] = bs.global_id
          self.save
        end
        return @buttons
      else
        brd = bs if bs
      end
    end
    self.assert_extra_data
    if self.data['buttons']
      @buttons = self.data['buttons']
    else
      # If brd.data['source_id'] is defined, that means we got
      # to a dead end, so we should probably schedule .update_for
      if brd.data['source_id'] && self.data['dead_end_source_id'] != brd.data['source_id']
        self.class.schedule_once(:update_for, self.related_global_id(self.board_id))
        self.data['dead_end_source_id'] = brd.data['source_id']
        self.save
      end
      @buttons = []
    end
  end
  
  def buttons_starting_from(board_id)
    boards_to_include = {}
    boards_to_include[board_id] = 0
    res = []
    (self.data['buttons'] || []).each do |button|
      if boards_to_include[button['board_id']] != nil
        if button['linked_board_id']
          boards_to_include[button['linked_board_id']] = [boards_to_include[button['linked_board_id']], boards_to_include[button['board_id']] + 1].compact.min
        end
      end
    end
    (self.data['buttons'] || []).each do |button|
      if boards_to_include[button['board_id']]
        button['depth'] = boards_to_include[button['board_id']] if boards_to_include[button['board_id']]
        res << button
      end
    end
    res
  end

  def has_buttons_defined?
    self.data && (self.data['buttons'] || self.data['extra_url'])
  end

  def url_for(user, full_set_revision)
    allowed_ids = {}
    button_set = self
    # Force an auto-regenerate if the revision doesn't match
    return nil unless full_set_revision && button_set.data['full_set_revision'] == full_set_revision
    if button_set.data['source_id']
      button_set = BoardDownstreamButtonSet.find_by_global_id(button_set.data['source_id'])
      button_set ||= self
    end
    public_board_ids = button_set.data['public_board_ids'] || Board.where(:id => Board.local_ids(button_set.data['board_ids']), :public => true).select('id').map(&:global_id)
    public_board_ids.each{|id| allowed_ids[id] = true }
    if user
      user.private_viewable_board_ids.each do |id|
        allowed_ids[id] = true
      end
      if user.possible_admin?
        if Organization.admin_manager?(user)
          button_set.data['board_ids'].each{|id| allowed_ids[id] = true }
        end
      end
    end
    @unviewable_ids = button_set.data['board_ids'].select{|id| !allowed_ids[id] }
    return button_set.extra_data_private_url if @unviewable_ids.blank?

    if !button_set.data['remote_salt']
      button_set.generate_defaults
      button_set.save
    end

    @remote_hash = GoSecure.sha512(@unviewable_ids.sort.to_json, button_set.data['remote_salt'])
    if (((button_set.data['remote_paths'] || {})[@remote_hash] || {})['expires'] || 0) > Time.now.to_i
      if button_set.data['remote_paths'][@remote_hash]['expires'] < 2.weeks.from_now.to_i
        button_set.schedule_once(:touch_remote, @remote_hash)
      end
      url = Uploader.check_existing_upload(button_set.data['remote_paths'][@remote_hash]['path'])
      return url if url
    end
    @remote_path = "extras/button_set_cache/#{button_set.global_id}/#{@remote_hash}.json"
    return nil
  end

  def touch_remote(hash)
    if self.data['remote_paths'] && self.data['remote_paths'][hash]
      # Touch the remote file so it hangs around longer now that
      # we know it's actually being used
      res = Uploader.remote_touch(self.data['remote_paths'][hash]['path'])
      if res
        self.data['remote_paths'][hash]['expires'] = 5.months.from_now.to_i
        self.save
      else
        self.data['remote_paths'].delete(hash)
        self.save
      end
    end
  end

  def self.generate_for(board_id, user_id)
    board = Board.find_by_global_id(board_id)
    user = user_id && User.find_by_global_id(user_id)
    return {success: false, error: 'missing board or user'} unless board && user
    button_set = board.board_downstream_button_set
    if !button_set
      self.update_for(board_id, true)
      button_set = board.reload.board_downstream_button_set
    end
    return {success: false, error: 'could not generate button set'} unless button_set
    if button_set.data['source_id']
      button_set = BoardDownstreamButtonSet.find_by_global_id(button_set.data['source_id'])
    end
    url = button_set.url_for(user, board.settings['full_set_revision'])
    return {success: true, url: url} if url
    unviewable_ids = button_set.instance_variable_get('@unviewable_ids')
    remote_path = button_set.instance_variable_get('@remote_path')
    remote_hash = button_set.instance_variable_get('@remote_hash')
    if !button_set.data['extra_data_nonce']
      # If the button set has never been detached, do that part
      button_set.detach_extra_data(true)
      return {success: true, url: button_set.extra_data_private_url} if unviewable_ids.blank?
    end
    button_set.data['remote_paths'] ||= {}
    if button_set.data['remote_paths'][remote_hash] && !button_set.data['remote_paths'][remote_hash]['path'] && button_set.data['remote_paths'][remote_hash]['generated'] > 12.hours.ago.to_i
      # Don't allow repeated regeneration attempts to bog things down
      if button_set.data['remote_paths'][remote_hash]['path']
        return {success: true, url: "#{ENV['UPLOADS_S3_CDN']}/#{button_set.data['remote_paths'][remote_hash]['path']}"}
      else
        return {success: false, error: 'button set failed to generate, waiting for cool-down period'}
      end
    end

    button_set.generate_defaults
    bad_ids = {}
    unviewable_ids.each{|id| bad_ids[id] = true }
    button_set.assert_extra_data
    available_buttons = button_set.data['buttons'].select{|b| !bad_ids[b['board_id']] }

    path = remote_path
    button_set.data['remote_paths'][remote_hash] = {'generated' => Time.now.to_i, 'path' => path, 'expires' => 5.months.from_now.to_i}
    begin
      file = Tempfile.new("stash")
      file.write(available_buttons.to_json)
      file.close
      Uploader.remote_upload(remote_path, file.path, 'text/json')
    rescue => e
      button_set.data['remote_paths'][remote_hash]['path'] = false
      button_set.data['remote_paths'][remote_hash]['error'] = e.message
    end
    button_set.save
    return {success: false, error: 'button set failed to generate'} unless button_set.data['remote_paths'][remote_hash]['path']
    {success: true, url: "#{ENV['UPLOADS_S3_CDN']}/#{button_set.data['remote_paths'][remote_hash]['path']}"}
  end

  def self.flush_caches(board_ids, timestamp)
    board_ids.each do |board_id|
      board = Board.find_by_global_id(board_id)
      bs = board && board.board_downstream_button_set
      if bs && bs.data['remote_paths']
        bs.data['remote_paths'].each do |hash, obj|
          if obj['generated'] < timestamp && obj['path']
            path = obj['path']
            Uploader.remote_remove(path)
            bs.data['remote_paths'].delete(hash)
          end
        end
        bs.save
      end
    end
  end
  
  def self.update_for(board_id, immediate_update=false, traversed_ids=[])
    traversed_ids ||= []
    key = "traversed/button_set/#{board_id}"
    cached_traversed = (JSON.parse(RedisInit.default.get(key)) rescue nil) || []
    RedisInit.default.del(key)
    traversed_ids = (traversed_ids + cached_traversed).uniq

    board = Board.find_by_global_id(board_id)
    return if board && traversed_ids.include?(board.global_id)
    if board
      # Prevent loop from running forever
      traversed_ids << board.global_id
      set = BoardDownstreamButtonSet.find_or_create_by(:board_id => board.id) rescue nil
      set ||= BoardDownstreamButtonSet.find_or_create_by(:board_id => board.id)
      set.data['source_id'] = nil if set.data['source_id'] == set.global_id
      set.data['full_set_revision'] = board.settings['full_set_revision']
      # Don't re-update if you've updated more recently than when this
      # job was scheduled
      return if self.last_scheduled_stamp && (set.updated_at.to_i - 5) > self.last_scheduled_stamp
      
      existing_board_ids = (set.data || {})['linked_board_ids'] || []
      Board.find_batches_by_global_id(board.settings['immediately_upstream_board_ids'] || [], :batch_size => 3) do |brd|
        set.data['found_upstream_board'] = true
        bs = brd.board_downstream_button_set
        set.data['found_upstream_set'] = true if bs
        source_board_id = nil
        linked_board_ids = bs && (bs.data['linked_board_ids'] || bs.buttons.map{|b| b['linked_board_id'] }.compact.uniq)
        do_update = false
        # If the parent board is the correct source, use that
        if bs && bs.has_buttons_defined? && linked_board_ids.include?(board.global_id)
          # legacy lists don't correctly filter linked board ids
          valid_button = bs.buttons.detect{|b| b['linked_board_id'] == board.global_id } # && !b['hidden'] && !b['link_disabled'] }
          if valid_button && bs != set
            do_update = true if bs.updated_at <= set.updated_at
            set.data['source_id'] = bs.global_id
            set.data['buttons'] = nil
            set.save
            source_board_id = bs.related_global_id(bs.board_id)
          end
        # Otherwise if the parent board has a source_id, use that
        elsif bs && bs.data['source_id'] && linked_board_ids.include?(board.global_id)
          # legacy lists don't correctly filter linked board ids
          buttons = bs.buttons
          valid_button = (buttons || []).detect{|b| b['linked_board_id'] == board.global_id } # && !b['hidden'] && !b['link_disabled'] }
          if valid_button && bs.data['source_id'] != set.global_id
            source = BoardDownstreamButtonSet.find_by_global_id(bs.data['source_id'])
            if source
              do_update = true if source.updated_at <= set.updated_at
              source_board_id = source.related_global_id(source.board_id) if source
              set.data['source_id'] = bs.data['source_id']
              set.data['buttons'] = nil
              set.save
            end
          end
        end
        if source_board_id
          # If pointing to a source, go ahead and update that source
          # as part of the update process for this button set
          if do_update && !traversed_ids.include?(source_board_id)
            # If we're already in a slow background job, just do everything immediately
            if immediate_update || Worker.current_speed.to_s == 'slow'
              BoardDownstreamButtonSet.update_for(source_board_id, true, traversed_ids)
            else
              BoardDownstreamButtonSet.schedule_update(source_board_id, traversed_ids)
            end
          end
          return set
        end
      end
      boards_hash = {}
      # hash of all downstream boards is pretty memory intensive, let's skip
#      Board.find_batches_by_global_id(board.settings['downstream_board_ids'] || [], :batch_size => 3) do |brd|
#        boards_hash[brd.global_id] = brd
#      end
      
      boards_to_visit = [{:board_id => board.global_id, :depth => 0, :index => 0}]
      visited_board_ids = []
      linked_board_ids = []
      all_buttons = []
      while boards_to_visit.length > 0
        bv = boards_to_visit.shift
        board_to_visit = Board.find_by_global_id(bv[:board_id])
        if board_to_visit
          images = board_to_visit.button_images
          visited_board_ids << board_to_visit.global_id
          # add all buttons
          board_to_visit.settings['buttons'].each_with_index do |button, idx|
            image = images.detect{|i| button['image_id'] == i.global_id }
            visible_level = 1
            linked_level = 1
            if button['level_modifications'] && button['level_modifications']['pre'] && button['level_modifications']['pre']['hidden']
              visible_level = button['level_modifications'].select{|l, mod| mod['hidden'] == false }.map(&:first).sort.first.to_i || 10
              if button['level_modifications']['override'] && button['level_modifications']['override']['hidden'] == false
                visible_level = 1
              end
            end
            if button['level_modifications'] && button['level_modifications']['pre'] && button['level_modifications']['pre']['link_disabled']
              linked_level = button['level_modifications'].select{|l, mod| mod['link_disabled'] == false }.map(&:first).sort.first.to_i || 1
              if button['level_modifications']['override'] && button['level_modifications']['override']['link_disabled'] == false
                linked_level = 1
              end
            end
            button_data = {
              'id' => button['id'],
              'locale' => board_to_visit.settings['locale'] || 'en',
              'board_id' => board_to_visit.global_id,
              'board_key' => board_to_visit.key,
              'hidden' => !!button['hidden'],
              'hidden_link' => !!bv[:hidden],
              'visible_level' => visible_level,
              'linked_level' => linked_level,
              'image' => image && image.url,
              'hc' => image && image.settings['hc'],
              'image_id' => button['image_id'],
              'sound_id' => button['sound_id'],
              'label' => button['label'],
              'force_vocalize' => button['add_to_vocalization'],
              'vocalization' => button['vocalization'],
              'link_disabled' => !!button['link_disabled'],
              'border_color' => button['border_color'],
              'background_color' => button['background_color'],
              'depth' => bv[:depth] || 0
            }
            button_data.keys.each{|k| button_data.delete(k) if button_data[k] == nil }
            # check for any linked buttons
            if button['load_board'] && button['load_board']['id']
              linked_board = boards_hash[button['load_board']['id']]
              linked_board ||= Board.find_by_global_id(button['load_board']['id'])
              # hidden or disabled links shouldn't be tracked (why not???)
              if linked_board # && !button['hidden'] && !button['link_disabled']
                button_data['linked_board_id'] = linked_board.global_id
                button_data['linked_board_key'] = linked_board.key
                button_data['home_lock'] = true if button['home_lock']
              end
              # mark the first link to each board as "preferred"
              # TODO: is this a good idea? is there a better strategy? It honestly
              # shouldn't happen that much, having multiple links to the same board
              if linked_board && !linked_board_ids.include?(linked_board.global_id) # && !button['hidden'] && !button['link_disabled']
                button_data['preferred_link'] = true
                linked_board_ids << button['load_board']['id']
                boards_to_visit << {:board_id => linked_board.global_id, :depth => bv[:depth] + 1, :hidden => (bv[:hidden] || button['hidden'] || button['link_disabled']), :index => idx} if !visited_board_ids.include?(linked_board.global_id)
              end
            end
            all_buttons << button_data
          end
        end
        boards_to_visit.sort_by!{|bv| [bv[:depth], bv[:index]] }
      end
      set.data['buttons'] = all_buttons
      set.data['source_id'] = nil
      set.save

      board_ids_to_flush = [board.global_id]
      lost_board_ids = existing_board_ids - set.data['linked_board_ids']
      # Any boards that we no longer referenced are going to need their
      # own button data instead of using this button set as their source
      lost_board_ids.each do |id|
        BoardDownstreamButtonSet.schedule_update(id, traversed_ids)
        board_ids_to_flush << id
      end

      # Retrieve all linked boards and set them to this source
      Board.find_batches_by_global_id(set.data['linked_board_ids'] || [], :batch_size => 3) do |brd|
        board_ids_to_flush << brd.global_id
        bs = brd.board_downstream_button_set
        # TODO: it was too expensive updating everyone with the wrong source,
        # so I changed it to only update everyone with no source, since 
        # bs.buttons should update to the right source eventually
        if bs && bs.global_id != set.global_id && !bs.data['source_id'] # bs.data['source_id'] != set.global_id
          bs.data['full_set_revision'] = brd.settings['full_set_revision']
          bs.data['source_id'] = set.global_id
          bs.data['buttons'] = nil
          bs.save
        end
      end
      # TODO: clear out existing caches for a button set (and maybe lost boards and source_id board on update
      BoardDownstreamButtonSet.schedule_once_for('slow', :flush_caches, board_ids_to_flush, Time.now.to_i)

      if board.settings['board_downstream_button_set_id'] != set.global_id
        # TODO: race condition?
        board.update_setting('board_downstream_button_set_id', set.global_id)
      end
      set
    end
  end

  def self.schedule_update(board_id, traversed_ids)
    # This appears to be here to prevent multiple updates happening
    # independently from updating button sets when they don't have to.
    key = "traversed/button_set/#{board_id}"
    # TODO: if the Redis value gets removed unexpectedly, we
    # won't have a list of traversed ids which could result
    # in a recursive loop. This check is an emergency measure
    # to prevent that from happening and stuffing the queue.
    return if Worker.job_chain.split(/##/).select{|c| c.match(/BoardDownstreamButtonSet/) }.length > 5
    traversed = JSON.parse(RedisInit.default.get(key)) rescue nil
    traversed ||= []
    traversed += (traversed_ids - [board_id])
    RedisInit.default.setex(key, 6.hours.to_i, traversed.uniq.to_json)
    BoardDownstreamButtonSet.schedule_once(:update_for, board_id)
  end
  
  def self.spoken_button?(button, user)
    if !button['hidden']
      if !button['linked_board_id'] || (user && user.settings['preferences']['vocalize_linked_buttons']) || button['force_vocalize']
        if button['label'] && button['label'].split(/\s/).length <= 2
          return true
        end
      end
    end
    false
  end

  def self.reconcile(start_id = 0)
    wasted = 0
    destroyed = 0
    BoardDownstreamButtonSet.where("id > #{start_id}").find_in_batches(batch_size: 10) do |batch|
      batch.each do |button_set|
        button_set.assert_extra_data
        if button_set.data['buttons']
          size = button_set.data.to_json.length
          board = button_set.board
          puts "#{button_set.global_id} #{board ? board.key : 'NO BOARD'} #{size}"
          if !board
            puts "  no board!"
            button_set.destroy
            destroyed += size
          elsif (board.settings['immediately_upstream_board_ids'] || []).length > 0
            if size > 20000
              if button_set.data['source_id'] == button_set.global_id
                button_set.data['source_id'] = nil 
                button_set.save
              end
              bs = BoardDownstreamButtonSet.update_for(board.global_id)
              bs_size = bs.data.to_json.length
              if bs_size < size
                puts "  -#{size - bs_size}"
                wasted += size - bs_size
              end
            end
          end
        elsif button_set.data['source_id'] == button_set.global_id
          button_set.data['source_id'] = nil 
          button_set.save
          if button_set.board
            bs = BoardDownstreamButtonSet.update_for(button_set.board.global_id)                
          else
            puts "  no board!"
            button_set.destroy
            destroyed += size
          end
          puts "  mismatched source"
        end
      end
    end
    puts "wasted #{wasted / 1.megabyte}Mb, destroyed #{destroyed / 1.megabyte}Mb"
  end

  def self.clean_old_button_sets
    ids = BoardDownstreamButtonSet.where(['updated_at < ?', 3.months.ago]).select('id').limit(200).map(&:id)
    BoardDownstreamButtonSet.where(id: ids).delete_all
  end
  
  def self.word_map_for(user)
    board_key = user && user.settings['preferences'] && user.settings['preferences']['home_board'] && user.settings['preferences']['home_board']['key']
    board = Board.find_by_path(board_key) if board_key
    button_set = board && board.board_downstream_button_set
    return nil unless button_set
    button_set.assert_extra_data
    res = {'words' => [], 'word_map' => {}}
    
    # TODO: include images with attribution
    
    button_set.buttons.each do |button|
      if spoken_button?(button, user)
        res['words'] << button['label'].downcase
        locale = button['locale'] || 'en'
        res['word_map'][locale] ||= {}
        res['word_map'][locale][button['label'].downcase] = {
          'label' => button['label'].downcase,
          'border_color' => button['border_color'],
          'background_color' => button['background_color'],
          'image' => {
            'image_url' => button['image'],
            'license' => 'private'
          }
        }
      end
    end
    res['words'].uniq!
    
    res
  end
end
