class Board < ActiveRecord::Base
  DEFAULT_ICON = "https://s3.amazonaws.com/opensymbols/libraries/arasaac/board_3.png"
  include Processable
  include Permissions
  include Async
  include UpstreamDownstream
  include Relinking
  include GlobalId
  include MetaRecord
  include Notifier
  include SecureSerialize
  include Sharing
  include Renaming
  include PgSearch
  has_many :board_button_images
  has_many :button_images, :through => :board_button_images
  has_many :board_button_sounds
  has_many :button_sounds, :through => :board_button_sounds
  has_many :log_session_boards
  belongs_to :user
  belongs_to :parent_board, :class_name => 'Board'
  has_many :child_boards, :class_name => 'Board', :foreign_key => 'parent_board_id'
  pg_search_scope :search_by_text, :against => :search_string
  before_save :generate_defaults
  before_save :generate_stats
  before_save :require_key
  after_save :post_process
  after_destroy :flush_related_records
  
  has_paper_trail :only => [:current_revision, :settings, :name, :key, :public, :parent_board_id, :user_id]
  secure_serialize :settings

  # cache should be invalidated if:
  # - it is shared or unshared (including upstream)
  # - an author is added or removed (via sharing)
  # - it gains a new upstream link
  # - the author's supervision settings change
  # public boards anyone can view
  add_permissions('view') { self.public }
  # explicitly-shared boards are viewable
  add_permissions('view') {|user| self.shared_with?(user) }
  # the author's supervisors can view the author's boards
  # the user (and co-authors) should have edit and sharing access
  add_permissions('view', 'edit', 'delete', 'share') {|user| self.author?(user) }
  add_permissions('view') {|user| self.user && self.user.allows?(user, 'supervise') }
  # the user and any of their editing supervisors should have edit access
  add_permissions('view', 'edit', 'delete', 'share') {|user| self.user && self.user.allows?(user, 'edit') }
  # the user should have edit and sharing access if a parent board is edit-shared including downstream with them
  add_permissions('view', 'edit', 'delete', 'share') {|user| self.shared_with?(user, true) }
  # the user should have view access if the board is shared with any of their supervisees
  add_permissions('view') {|user| user.supervisees.any?{|u| self.shared_with?(u) } }
  cache_permissions

  def starred_by?(user)
    !!(user && user.global_id && (self.settings['starred_user_ids'] || []).include?(user.global_id))
  end
  
  def star(user, star)
    self.settings ||= {}
    self.settings['starred_user_ids'] ||= []
    if user
      if star
        self.settings['starred_user_ids'] << user.global_id if user
        self.settings['starred_user_ids'].uniq!
      else
        self.settings['starred_user_ids'] = self.settings['starred_user_ids'] - [user.global_id]
      end
      self.settings['never_edited'] = false
      user.schedule(:remember_starred_board!, self.global_id)
    end
  end
  
  def star!(user, star)
    self.star(user, star)
    self.save
  end
  
  def board_downstream_button_set
    if self.settings && self.settings['board_downstream_button_set_id']
      BoardDownstreamButtonSet.find_by_global_id(self.settings['board_downstream_button_set_id'])
    else
      BoardDownstreamButtonSet.find_by(:board_id => self.id)
    end
  end

  
  def non_author_starred?
    self.user && ((self.settings || {})['starred_user_ids'] || []).any?{|s| s != self.user.global_id }
  end
  
  def stars
    (self.settings || {})['stars'] || 0
  end
  
  def generate_stats
    self.settings['stars'] = (self.settings['starred_user_ids'] || []).length
    self.settings['forks'] = self.child_boards.count
    self.settings['home_uses'] = UserBoardConnection.where(:board_id => self.id, :home => true).count
    self.settings['recent_home_uses'] = UserBoardConnection.where(['board_id = ? AND home = ? AND updated_at > ?', self.id, true, 30.days.ago]).count
    self.settings['uses'] = UserBoardConnection.where(:board_id => self.id).count
    self.settings['recent_uses'] = UserBoardConnection.where(['board_id = ? AND updated_at > ?', self.id, 30.days.ago]).count
    self.settings['non_author_uses'] = UserBoardConnection.where(['board_id = ? AND user_id != ?', self.id, self.user_id]).count
    if self.settings['never_edited']
      self.popularity = -1
      self.home_popularity = -1
    else
      # TODO: a real algorithm perchance?
      self.popularity = (self.settings['stars'] * 100) + self.settings['uses'] + (self.settings['recent_uses'] * 3)
      self.home_popularity = (self.any_upstream ? 0 : 1) + self.settings['home_uses'] + (self.settings['recent_home_uses'] * 5)
    end
    self.any_upstream ||= false
    self.settings['total_buttons'] = (self.settings['buttons'] || []).length + (self.settings['total_downstream_buttons'] || 0)
    self.settings['unlinked_buttons'] = (self.settings['buttons'] || []).select{|btn| !btn['load_board'] }.length + (self.settings['unlinked_downstream_buttons'] || 0)
    if !self.settings['buttons'] || self.settings['buttons'].length == 0
      self.popularity = 0
      self.home_popularity = 0
    end
    true
  end
  
  def find_copies_by(user)
    if user
      ids = [user.id] + self.class.local_ids(user.supervised_user_ids || [])
      # TODO: sharding
      Board.where(:parent_board_id => self.id, :user_id => ids).sort_by{|b| [b.user_id == user.id ? 0 : 1, 0 - b.id] }
    else
      []
    end
  end
  
  def self.import(user_id, url)
    boards = []
    user = User.find_by_global_id(user_id)
    Progress.update_current_progress(0.05, :generating_boards)
    Progress.as_percent(0.05, 0.9) do
      boards = Converters::Utils.remote_to_boards(user, url)
    end
    return boards.map{|b| JsonApi::Board.as_json(b, :permissions => user) }
  end
  
  def generate_download(user_id, type, include='this', headerless=false)
    res = {}
    user = User.find_by_global_id(user_id)
    Progress.update_current_progress(0.05, :generating_files)
    Progress.as_percent(0.05, 0.9) do
      if ['obz', 'obf', 'pdf'].include?(type.to_s)
        url = Converters::Utils.board_to_remote(self, user, type.to_s, include, !!headerless)
        if !url
          raise Progress::ProgressError, "No URL generated"
        end
        res = {:download_url => url}
      else
        raise Progress::ProgressError, "Unexpected download type, #{type}"
      end
    end
    return res
  end
  
  def generate_defaults
    self.settings ||= {}
    self.settings['name'] ||= "Unnamed Board"
    if !self.settings['image_url']
      self.settings['image_url'] = DEFAULT_ICON
      self.settings['default_image_url'] = DEFAULT_ICON
    elsif self.settings['image_url'] != self.settings['default_image_url']
      self.settings['default_image_url'] = nil
    end
    @brand_new = !self.id
    @buttons_changed = true if self.settings['buttons'] && !self.id
    if @edit_description
      if self.settings['edit_description'] && self.settings['edit_description']['timestamp'] < @edit_description['timestamp'] - 1
        @edit_description = nil
      end
    end
    self.settings['edit_description'] = @edit_description
    @edit_description = nil

    self.settings['buttons'] ||= []
    self.settings['grid'] ||= {}
    self.settings['grid']['rows'] = (self.settings['grid']['rows'] || 2).to_i
    self.settings['grid']['columns'] = (self.settings['grid']['columns'] || 4).to_i
    self.settings['grid']['order'] ||= []
    self.settings['grid']['rows'].times do |i|
      self.settings['grid']['order'][i] ||= []
      self.settings['grid']['columns'].times do |j|
        self.settings['grid']['order'][i][j] ||= nil
      end
      if self.settings['grid']['order'][i].length > self.settings['grid']['columns']
        self.settings['grid']['order'][i] = self.settings['grid']['order'][i].slice(0, self.settings['grid']['columns'])
      end
    end
    if self.settings['grid']['order'].length > self.settings['grid']['rows']
      self.settings['grid']['order'] = self.settings['grid']['order'].slice(0, self.settings['grid']['rows'])
    end
    if self.settings['grid']['labels'] && self.settings['buttons'].length == 0
      self.populate_buttons_from_labels(self.settings['grid'].delete('labels'))
    end
    update_immediately_downstream_board_ids
    
    data_hash = Digest::MD5.hexdigest(self.global_id.to_s + "_" + self.settings['grid'].to_json + "_" + self.settings['buttons'].to_json)
    self.settings['revision_hashes'] ||= []
    if !self.settings['revision_hashes'].last || self.settings['revision_hashes'].last[0] != data_hash
      @track_revision = [data_hash, Time.now.to_i]
      self.settings['revision_hashes'] << @track_revision
      self.current_revision = data_hash
    end
    
    self.settings['license'] ||= {type: 'private'}
    self.name = self.settings['name']
    if self.public == nil
      if self.user && self.user.premium?
        self.public = false
      else
        self.public = true
      end
    end
          
    # TODO: encrypted search
    self.settings['search_string'] = "#{self.name} #{self.settings['description'] || ""} #{self.key} #{self.labels}".downcase
    self.search_string = self.public ? self.settings['search_string'] : nil
    true
  end
  
  def labels
    return @labels if @labels
    list = []
    grid = self.settings['grid']
    buttons = self.settings['buttons']
    return "" if !grid || !buttons
    grid['columns'].times do |jdx|
      grid['rows'].times do |idx|
        id = grid['order'][idx] && grid['order'][idx][jdx]
        button = buttons.detect{|b| b['id'] == id }
        list.push(button['label']) if button && button['label']
      end
    end
    @labels = list.join(", ");
    return list.join(', ');
  end
  
  def current_revision
    self.attributes['current_revision'] || (self.settings && self.settings['revision_hashes'] && self.settings['revision_hashes'][-1] && self.settings['revision_hashes'][-1][0])
  end
  
  def full_set_revision
    self.settings['full_set_revision'] || self.current_revision || self.global_id
  end
  
  def populate_buttons_from_labels(labels)
    max_id = self.settings['buttons'].map{|b| b['id'].to_i || 0 }.max || 0
    idx = 0
    labels.split(/\n|,\s*/).each do |label|
      label.strip!
      next if label.blank?
      max_id += 1
      button = {
        'id' => max_id,
        'label' => label,
        'suggest_symbol' => true
      }
      self.settings['buttons'] << button
      @buttons_changed = true
      row = idx % self.settings['grid']['rows']
      col = (idx - row) / self.settings['grid']['rows']
      if row < self.settings['grid']['rows'] && col < self.settings['grid']['columns']
        self.settings['grid']['order'][row][col] = button['id']
      end
      idx += 1
    end
  end
  
  def save_without_post_processing
    @skip_post_process = true
    self.save
    @skip_post_process = false
  end
  
  def post_process
    if @skip_post_process
      @skip_post_process = false
      return
    end
    
    rev = (((self.settings || {})['revision_hashes'] || [])[-2] || [])[0]
    notify('board_buttons_changed', {'revision' => rev}) if @buttons_changed && !@brand_new
    # Can't be backgrounded because board rendering depends on this
    self.map_images
    
    if self.settings && self.settings['image_url'] == DEFAULT_ICON && self.settings['default_image_url'] == self.settings['image_url'] && self.settings['name'] && self.settings['name'] != 'Unnamed Board'
      self.schedule(:check_image_url)
    end
    
    if @check_for_parts_of_speech
      self.schedule(:check_for_parts_of_speech)
      @check_for_parts_of_speech = nil
    end

    schedule_downstream_checks
  end
  
  def check_image_url
    if self.settings && self.settings['image_url'] == DEFAULT_ICON && self.settings['default_image_url'] == self.settings['image_url'] && self.settings['name'] && self.settings['name'] != 'Unnamed Board'
      res = Typhoeus.get("https://www.opensymbols.org/api/v1/symbols/search?q=#{CGI.escape(self.settings['name'])}", :ssl_verifypeer => false)
      results = JSON.parse(res.body) rescue nil
      results ||= []
      icon = results.detect do |result|
        result['license'] == "CC By" || result['repo_key'] == 'arasaac'
      end
      if icon && icon['image_url'] != DEFAULT_ICON
        self.settings['image_url'] = icon['image_url']
        self.settings['default_image_url'] = icon['image_url']
        self.settings['default_image_details'] = icon
        @skip_post_process = true
        self.save_without_post_processing
        @skip_post_process = false
      end
    end
  end
  
  def map_images
    return unless @buttons_changed
    @buttons_changed = false

    images = []
    sounds = []
    ((self.settings || {})['buttons'] || []).each do |button|
      images << {:id => button['image_id'], :label => button['label']} if button['image_id']
      sounds << {:id => button['sound_id']} if button['sound_id']
    end
    
    existing_image_ids = BoardButtonImage.images_for_board(self.id).map(&:global_id)
    existing_images = existing_image_ids.map{|id| {:id => id} }
    image_ids = images.map{|i| i[:id] }
    new_images = images.select{|i| !existing_image_ids.include?(i[:id]) }
    orphan_images = existing_images.select{|i| !image_ids.include?(i[:id]) }
    BoardButtonImage.connect(self.id, new_images, :user_id => self.user.global_id)
    BoardButtonImage.disconnect(self.id, orphan_images)
    
    existing_sound_ids = BoardButtonSound.sounds_for_board(self.id).map(&:global_id)
    existing_sounds = existing_sound_ids.map{|id| {:id => id} }
    sound_ids = sounds.map{|i| i[:id] }
    new_sounds = sounds.select{|i| !existing_sound_ids.include?(i[:id]) }
    orphan_sounds = existing_sounds.select{|i| !sound_ids.include?(i[:id]) }
    BoardButtonSound.connect(self.id, new_sounds, :user_id => self.user.global_id)
    BoardButtonSound.disconnect(self.id, orphan_sounds)
    @images_mapped_at = Time.now.to_i
  end
  
  def require_key
    # TODO: truncate long names
    self.key ||= generate_board_key(self.settings && self.settings['name'])
    true
  end
  
  def cached_user_name
    (self.key || "").split(/\//)[0]
  end
  
  def process_params(params, non_user_params)
    raise "user required as board author" unless self.user_id || non_user_params[:user]
    @edit_notes = []
    self.user ||= non_user_params[:user] if non_user_params[:user]
    if params['parent_board_id']
      parent_id = params['parent_board_id'].split(/_/).last
      self.parent_board_id = parent_id
    end
    self.settings ||= {}
    self.settings['last_updated'] = Time.now.iso8601
    @edit_notes << "renamed the board" if params['name'] && self.settings['name'] != params['name']
    self.settings['name'] = params['name'] if params['name']
    self.settings['word_suggestions'] = params['word_suggestions'] if params['word_suggestions']
    @edit_notes << "updated the description" if params['description'] && params['description'] != self.settings['description']
    self.settings['description'] = params['description'] if params['description']
    @edit_notes << "changed the image" if params['image_url'] && params['image_url'] != self.settings['image_url']
    self.settings['image_url'] = params['image_url'] if params['image_url']
    self.settings['never_edited'] = false
    process_buttons(params['buttons'], non_user_params[:user]) if params['buttons']
    prior_license = self.settings['license'].to_json
    process_license(params['license']) if params['license']
    @edit_notes << "changed the license" if self.settings['license'].to_json != prior_license
    self.star(non_user_params[:starrer], params['starred']) if params['starred'] != nil
    
    self.settings['grid'] = params['grid'] if params['grid']
    if params['public'] != nil
#       if self.public != false && params['public'] == false && (!self.user || !self.user.premium?)
#         add_processing_error("only premium users can make boards private")
#         return false
#       end
      @edit_notes << "set to public" if params['public'] && !self.public
      @edit_notes << "set to private" if !params['public'] && self.public
      self.public = params['public'] 
    end
    if params['sharing_key']
      return false unless self.process_share(params['sharing_key'])
    end
    non_user_params[:key] = nil if non_user_params[:key].blank?
    if non_user_params[:key]
      non_user_params[:key].sub!(/^tmp\//, '')
      non_user_params[:key] = nil if non_user_params[:key].match(/^tmp_/)
      self.key = generate_board_key(non_user_params[:key]) if non_user_params[:key]
    end
#    @edit_description = nil
    if self.id && @edit_notes.length > 0
      @edit_description = {
        'timestamp' => Time.now.to_f,
        'notes' => @edit_notes
      }
    end
    true
  end
  
  def check_for_parts_of_speech!
    self.check_for_parts_of_speech
    self.save!
  end
  
  def check_for_parts_of_speech
    if self.settings && self.settings['buttons']
      any_changed = false
      self.settings['buttons'].each do |button|
        word = button['vocalization'] || button['label']
        if word && !button['part_of_speech']
          speech ||= WordData.find_word(word)
          if speech && speech['types'] && speech['types'].length > 0
            button['part_of_speech'] = speech['types'][0]
            button['suggested_part_of_speech'] = speech['types'][0]
            any_changed = true
          end
        elsif button['part_of_speech'] && button['suggested_part_of_speech'] && button['part_of_speech'] != button['suggested_part_of_speech']
          str = "#{button['vocalization'] || button['label']}-#{button['part_of_speech']}"
          RedisInit.default.hincrby('overridden_parts_of_speech', str, 1) if RedisInit.default
        end
      end
      self.save if any_changed
    end
  end
  
  def process_buttons(buttons, editor)
    @edit_notes ||= []
    @check_for_parts_of_speech = true
    prior_buttons = self.settings['buttons'] || []
    approved_link_ids = []
    prior_buttons.each do |button|
      if button['load_board']
        approved_link_ids << button['load_board']['id']
        approved_link_ids << button['load_board']['key']
      end
    end
    self.settings['buttons'] = buttons.map do |button|
      button = button.slice('id', 'hidden', 'link_disabled', 'image_id', 'sound_id', 'label', 'vocalization', 'background_color', 'border_color', 'load_board', 'hide_label', 'url', 'apps', 'video', 'part_of_speech', 'suggested_part_of_speech', 'painted_part_of_speech', 'add_to_vocalization');
      if button['load_board']
        if !approved_link_ids.include?(button['load_board']['id']) && !approved_link_ids.include?(button['load_board']['key'])
          link = Board.find_by_path(button['load_board']['id']) || Board.find_by_path(button['load_board']['key'])
          if !link || !link.allows?(editor, 'view')
            button.delete('load_board')
          end
        end
      end
      if button['part_of_speech'] && button['part_of_speech'] == ''
        button.delete('part_of_speech')
      end
      if !button['load_board'] && !button['apps'] && !button['url'] && !button['video']
        button.delete('link_disabled')
      end
      button
    end
    # TODO: for each button use tinycolor to compute a "safe" color for border and bg,
    # also a hover color for each, and mark them as "server-side approved"

    if self.settings['buttons'].to_json != prior_buttons.to_json
      @edit_notes << "modified buttons"
      @buttons_changed = true 
    end
    self.settings['buttons']
  end
  
  def icon_url_or_fallback
    fallback = DEFAULT_ICON
    self.settings['image_url'].blank? ? fallback : self.settings['image_url']
  end
  
  def self.user_versions(global_id)
    # TODO: sharding
    local_id = Board.local_ids([global_id])[0]
    current = Board.find_by_global_id(global_id)
    versions = []
    all_versions = PaperTrail::Version.where(:item_type => 'Board', :item_id => local_id).order('id DESC')

    all_versions.each_with_index do |v, idx|
      if v.whodunnit
        later_version = all_versions[idx - 1]
        later_object = later_version ? later_version.reify : current
        v.instance_variable_set('@later_object', later_object)
        versions << v
      end
    end
    versions
  end
  
  def flush_related_records
    DeletedBoard.process(self)
  end
  
  def default_listeners(notification_type)
    if notification_type == 'board_buttons_changed'
      ubc = UserBoardConnection.where(:board_id => self.id)
      direct_users = ubc.map(&:user)
      supervisors = direct_users.map(&:supervisors).flatten
      (direct_users + supervisors).uniq.map(&:record_code)
    else
      []
    end
  end
end
