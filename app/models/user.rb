class User < ActiveRecord::Base
  include Processable
  include Permissions
  include Passwords
  include Async
  include GlobalId
  include MetaRecord
  include Supervising
  include SecureSerialize
  include Notifiable
  include Subscription
  include Renaming
  has_many :log_sessions
  has_many :boards
  has_many :devices
  belongs_to :managing_organization, :class_name => Organization
  belongs_to :managed_organization, :class_name => Organization
  before_save :generate_defaults
  after_save :track_boards
  after_save :notify_of_changes

  has_paper_trail :only => [:settings, :user_name]
  secure_serialize :settings

  # TODO: callback to update board names if username changes
  # ...I guess should do something about old links as well. Github
  # doesn't redirect on old usernames, but I think it does on old
  # repo names, at least until they're replaces by a same-named repo.

  # cache should be invalidated if:
  # - a supervisor is added or removed
  add_permissions('view_existence') { true } # anyone can get basic information
  add_permissions('view_existence', 'view_detailed', 'supervise', 'edit', 'manage_supervision', 'delete', 'view_deleted_boards') {|user| user.id == self.id }
  add_permissions('view_existence', 'view_detailed') { self.settings && self.settings['public'] == true }
  add_permissions('edit', 'manage_supervision', 'view_deleted_boards') {|user| user.edit_permission_for?(self) }
  add_permissions('view_existence', 'view_detailed', 'supervise', 'view_deleted_boards') {|user| user.supervisor_for?(self) }
  add_permissions('manage_supervision', 'support_actions') {|user| Organization.manager_for?(user, self) }
  add_permissions('admin_support_actions', 'view_deleted_boards') {|user| Organization.admin_manager?(user) }
  cache_permissions
  
  def self.find_for_login(user_name)
    res = self.find_by(:user_name => user_name)
    res ||= self.find_by(:user_name => user_name.downcase)
    if !res
      emails = self.find_by_email(user_name)
      emails = self.find_by_email(user_name.downcase) if emails.length == 0
      res = emails[0] if emails.length == 1
    end
    res
  end
  
  def named_email
    "#{self.settings['name']} <#{self.settings['email']}>"
  end
  
  def prior_named_email
    email = self.settings['old_emails'][-1]
    "#{self.settings['name']} <#{email}>"
  end
  
  def registration_type
    res = (self.settings['preferences'] || {})['registration_type']
    res = 'unspecified' if !res || res.length == 0
    res
  end
  
  def log_session_duration
    (self.settings['preferences'] && self.settings['preferences']['log_session_duration']) || User.default_log_session_duration
  end
  
  def self.default_log_session_duration
    30.minutes.to_i
  end
  
  def enable_feature(feature)
    self.settings ||= {}
    self.settings['feature_flags'] ||= {}
    self.settings['feature_flags'][feature.to_s] = true
    self.save
  end
  
  def disable_feature(feature)
    self.settings['feature_flags'].delete(feature.to_s) if self.settings && self.settings['feature_flags']
    self.save
  end
  
  def self.default_premium_voices
    {
      'claimed' => [],
      'allowed' => 2
    }
  end
  
  def add_premium_voice(voice_id)
    # Limit the number of premium_voices users can download
    # TODO: don't let users set their voice to a premium voice that they have downloaded for a different user
    voices = {}.merge(self.settings['premium_voices'] || {})
    voices['claimed'] ||= self.class.default_premium_voices['claimed']
    voices['allowed'] ||= self.class.default_premium_voices['allowed']
    new_voice = !voices['claimed'].include?(voice_id)
    voices['claimed'] = voices['claimed'] | [voice_id]
    if voices['claimed'].length > voices['allowed']
      return false
    else
      self.settings['premium_voices'] = voices
      self.save
      if new_voice
        data = {
          :user_id => self.global_id,
          :user_name => self.user_name,
          :voice_id => voice_id,
          :timestamp => Time.now.to_i
        }
        AuditEvent.create!(:event_type => 'voice_added', :summary => "#{self.user_name} added #{voice_id}", :data => data)
      end
      return true
    end
  end
  
  def registration_code
    self.settings ||= {}
    if !self.settings['registration_code']
      self.settings['registration_code'] = Security.nonce('reg_code')
      self.save
    end
    self.settings['registration_code']
  end
  
  def self.preference_defaults
    {
      'device' => {
        'voice' => {'pitch' => 1.0, 'volume' => 1.0},
        'button_spacing' => 'small',
        'button_border' => 'small',
        'button_text' => 'medium',
        'vocalization_height' => 'small',
      },
      'any_user' => {
        'activation_location' => 'end',
        'auto_home_return' => true,
        'vocalize_buttons' => true,
        'confirm_external_links' => true,
        'clear_on_vocalize' => true,
        'sharing' => true,
        'board_jump_delay' => 500,
        'default_sidebar_boards' => default_sidebar_boards,
        'blank_status' => false
      },
      'authenticated_user' => {
        'long_press_edit' => true,
        'require_speak_mode_pin' => false,
        'logging' => false,
        'geo_logging' => false,
        'role' => 'communicator',
        'auto_open_speak_mode' => true,
        'share_notifications' => 'email'
      }
    }
  end
  
  def generate_defaults
    self.settings ||= {}
    self.settings['name'] ||= "No name"
    self.settings['preferences'] ||= {}
    self.settings['preferences']['progress'] ||= {}
    if self.settings['preferences']['home_board']
      self.settings['preferences']['progress']['home_board_set'] = true
      self.settings['all_home_boards'] ||= []
      self.settings['all_home_boards'] << self.settings['preferences']['home_board']
      self.settings['all_home_boards'] = self.settings['all_home_boards'].uniq
    end
    self.settings['preferences']['devices'] ||= {}
    self.settings['preferences']['devices']['default'] ||= {}
    self.settings['preferences']['devices']['default']['name'] ||= "Web browser for Desktop"
    self.settings['preferences']['devices'].each do |key, hash|
      User.preference_defaults['device'].each do |attr, val|
        self.settings['preferences']['devices'][key][attr] ||= val
      end
    end
    self.settings['preferences']['disable_quick_sidebar'] = false if self.settings['preferences']['quick_sidebar']
    User.preference_defaults['any_user'].each do |attr, val|
      self.settings['preferences'][attr] = val if self.settings['preferences'][attr] == nil
    end
    User.preference_defaults['authenticated_user'].each do |attr, val|
      self.settings['preferences'][attr] = val if self.settings['preferences'][attr] == nil
    end
    if self.settings['preferences']['role'] != 'communicator'
      self.settings['preferences'].delete('auto_open_speak_mode')
    end
    self.expires_at ||= Date.today + 60 if !self.id
    self.user_name ||= self.generate_user_name(self.settings['name']).downcase
    self.email_hash = User.generate_email_hash(self.settings['email'])
    true
  end
  
  def self.find_by_email(email)
    hash = User.generate_email_hash(email)
    self.where(:email_hash => hash).order('user_name')
  end
  
  def self.generate_email_hash(email)
    Digest::MD5.hexdigest((email || "none").to_s)
  end
  
  def generated_avatar_url(override_url=nil)
    bucket = ENV['STATIC_S3_BUCKET'] || "coughdrop"
    id = self.id || 0
    fallback = "https://s3.amazonaws.com/#{bucket}/avatars/avatar-#{id % 10}.png"
    url = self.settings && self.settings['avatar_url']
    url = override_url if override_url
    if url == 'fallback'
      fallback
    elsif url && url != 'default'
      # TODO: somewhere we should enforce that it's coming from a reliable location, or provide a fallback
      url
    else
      email_md5 = Digest::MD5.hexdigest(self.settings['email'] || "none")
      "https://www.gravatar.com/avatar/#{email_md5}?s=100&d=#{CGI.escape(fallback)}"
    end
  end
  
  def prior_avatar_urls
    res = self.settings && self.settings['prior_avatar_urls']
    current = generated_avatar_url
    default = generated_avatar_url('default')
    if (res && res.length > 0) || current != default
      res = res || []
      res.push(default)
      res.uniq!
    end
    res
  end
  
  # frd == "For Reals, Dude" obviously. It's a thing, I guess you just didn't know about it.
  # TODO: add "frd" to urban dictionary
  def track_boards(frd=false)
    if !frd
      self.schedule(:track_boards, true)
      return true
    end
    # TODO: trigger background process to create user_board_connection records for all boards
    previous_connections = UserBoardConnection.where(:user_id => self.id)
    orphan_board_ids = previous_connections.map(&:board_id)
    if self.settings['preferences'] && self.settings['preferences']['home_board'] && self.settings['preferences']['home_board']['id']
      board = Board.find_by_path(self.settings['preferences']['home_board']['id'])
      if board
        orphan_board_ids -= [board.id]
        # TODO: this doesn't shard, and probably other places don't as well
        UserBoardConnection.find_or_create_by(:board_id => board.id, :user_id => self.id, :home => true)
        board.track_downstream_boards!
        board.settings['downstream_board_ids'].each do |global_id|
          downstream_board = Board.find_by_path(global_id)
          if downstream_board
            orphan_board_ids -= [downstream_board.id]
            UserBoardConnection.find_or_create_by(:board_id => downstream_board.id, :user_id => self.id)
            downstream_board.save
          end
        end
      end
    end
    UserBoardConnection.delete_all(:user_id => self.id, :board_id => orphan_board_ids)
    orphan_board_ids.each do |id|
      board = Board.find_by(:id => id)
      if board
        board.generate_stats
        board.save
      end
    end
    true
  end

  def remember_starred_board!(board_id)
    board = Board.find_by_path(board_id)
    if board
      star = (board.settings['starred_user_ids'] || []).include?(self.global_id)
      self.settings['starred_board_ids'] ||= []
      if star
        self.settings['starred_board_ids'] << board.global_id if board
        self.settings['starred_board_ids'].uniq!
      else
        self.settings['starred_board_ids'] = self.settings['starred_board_ids'] - [board.global_id]
      end
      self.settings['starred_boards'] = self.settings['starred_board_ids'].length
      self.save
    end
  end
  
  def board_set_ids(opts=nil)
    opts ||= {}
    include_supervisees = opts['include_supervisees'] || opts[:include_supervisees] || false
    include_starred = opts['include_starred'] || opts[:include_starred] || false
    root_board_ids = []
    board_ids = []
    if self.settings && include_starred
      board_ids += self.settings['starred_board_ids'] || []
      root_board_ids += self.settings['starred_board_ids'] || []
    end
    if self.settings && self.settings['preferences'] && self.settings['preferences']['home_board']
      root_board_ids += [self.settings['preferences']['home_board']['id']] 
    end
    if include_supervisees
      self.supervisees.each do |u|
        if u.settings && u.settings['preferences'] && u.settings['preferences']['home_board']
          root_board_ids  += [u.settings['preferences']['home_board']['id']]
        end
      end
    end

    board_ids += root_board_ids
    root_boards = Board.find_all_by_global_id(root_board_ids)
    root_boards.each do |board|
      board_ids += board.settings['downstream_board_ids'] || []
    end
    
    board_ids.uniq
  end
  
  PREFERENCE_PARAMS = ['home_board', 'sidebar', 'auto_home_return', 'vocalize_buttons', 
      'sharing', 'button_spacing', 'quick_sidebar', 'disable_quick_sidebar', 
      'lock_quick_sidebar', 'clear_on_vocalize', 'logging', 'geo_logging', 
      'require_speak_mode_pin', 'speak_mode_pin', 'activation_minimum',
      'activation_location', 'activation_cutoff', 'activation_on_start', 
      'confirm_external_links', 'long_press_edit', 'scanning', 'scanning_interval',
      'scanning_mode', 'scanning_select_keycode', 'scanning_next_keycode',
      'scanning_select_on_any_event', 'vocalize_linked_buttons', 'sidebar_boards',
      'silence_spelling_buttons', 'stretch_buttons', 'registration_type',
      'board_background', 'vocalization_height', 'role', 'auto_open_speak_mode',
      'canvas_render', 'blank_status', 'share_notifications']

  PROGRESS_PARAMS = ['setup_done', 'intro_watched', 'profile_edited', 'preferences_edited', 'home_board_set', 'app_added', 'skipped_subscribe_modal']
  def process_params(params, non_user_params)
    self.settings ||= {}
    ['name', 'description', 'details_url', 'location'].each do |arg|
      self.settings[arg] = params[arg] if params[arg]
    end
    if params['terms_agree']
      self.settings['terms_agreed'] = Time.now.to_i
    end
    if params['avatar_url'] && (params['avatar_url'].match(/^http/) || params['avatar_url'] == 'fallback')
      if self.settings['avatar_url'] && self.settings['avatar_url'] != 'fallback'
        self.settings['prior_avatar_urls'] ||= []
        self.settings['prior_avatar_urls'] << self.settings['avatar_url']
        self.settings['prior_avatar_urls'].uniq!
      end
      self.settings['avatar_url'] = params['avatar_url']
    end
    if params['email'] && params['email'] != self.settings['email']
      if self.settings['email']
        self.settings['old_emails'] ||= []
        self.settings['old_emails'] << self.settings['email']
        @email_changed = true
      end
      self.settings['email'] = params['email']
    end
    if params['last_message_read']
      if params['last_message_read'] >= (self.settings['last_message_read'] || 0)
        self.settings['unread_messages'] = 0
        self.settings['last_message_read'] = params['last_message_read']
      end
    end
    self.settings['preferences'] ||= {}
    PREFERENCE_PARAMS.each do |attr|
      self.settings['preferences'][attr] = params['preferences'][attr] if params['preferences'] && params['preferences'][attr] != nil
    end
    self.settings['preferences']['stretch_buttons'] = nil if self.settings['preferences']['stretch_buttons'] == 'none'
    self.settings['preferences']['progress'] ||= {}
    if params['preferences'] && params['preferences']['progress']
      PROGRESS_PARAMS.each do |attr|
        self.settings['preferences']['progress'][attr] = params['preferences']['progress'][attr] if params['preferences']['progress'][attr]
      end
    end
    
    process_sidebar_boards(params['preferences']['sidebar_boards'], non_user_params) if params['preferences'] && params['preferences']['sidebar_boards']
    process_home_board(params['preferences']['home_board'], non_user_params) if params['preferences'] && params['preferences']['home_board'] && params['preferences']['home_board']['id']
    process_device(params['preferences']['device'], non_user_params) if params['preferences'] && params['preferences']['device']
    
    if non_user_params['premium_until']
      if non_user_params['premium_until'] == 'forever'
        self.expires_at = Date.today >> (100 * 12)
        self.settings['subscription'] ||= {}
        self.settings['subscription']['never_expires'] = true
      else
        self.expires_at = non_user_params['premium_until']
        self.settings['subscription'].delete('never_expires') if self.settings['subscription']
      end
    end
    
    if params['supervisee_code']
      if !self.id
        add_processing_error("can't modify supervisees on create") 
        return false
      end
      if !self.link_to_supervisee_by_code(params['supervisee_code'])
        add_processing_error("supervisee add failed") 
        return false
      end
    end
    if params['supervisor_key']
      if !self.id
        add_processing_error("can't modify supervisors on create") 
        return false
      end
      if !self.process_supervisor_key(params['supervisor_key'])
        add_processing_error("supervisor update failed")
        return false
      end
    end
    
    self.settings['pending'] = non_user_params[:pending] if non_user_params[:pending] != nil
    self.settings['public'] = !!params['public'] if params['public'] != nil
    self.settings['admin'] = !!non_user_params['admin'] if non_user_params['admin'] != nil
    if params['password'] && params['password'] != ""
      if !self.settings['password'] || valid_password?(params['old_password']) || non_user_params[:allow_password_change]
        @password_changed = !!self.settings['password']
        self.generate_password(params['password'])
      else
        add_processing_error("incorrect current password")
        return false
      end
    end
    new_user_name = nil
    new_user_name = self.generate_user_name(non_user_params[:user_name]) if non_user_params[:user_name]
    if !self.user_name
      new_user_name = self.generate_user_name(params['user_name']) if params['user_name'] && params['user_name'].length > 0
    end
    if new_user_name
      self.user_name = new_user_name.downcase
      self.settings['display_user_name'] = new_user_name
    end
    true
  end
  
  def display_user_name
    (self.settings && self.settings['display_user_name']) || self.user_name
  end
  
  def process_device(device, non_user_params)
    device_key = (non_user_params['device'] && non_user_params['device'].unique_device_key) || 'default'    
    if device
      self.settings['preferences']['devices'] ||= {}
      # Since 'browser' is a single device, it's possible that the voice_uri set for one
      # computer won't match the voice_uri needed for a different computer. So this keeps
      # a list of recent voice_uris and the client just uses the most recent one.
      # TODO: maybe this should be a browser-specific option since it'll be weird to other API consumers
      # TODO: now that we're storing all browsers as different devices, this seems like it needs to be replaced with an alternative
      voice_uris = ((self.settings['preferences']['devices'][device_key] || {})['voice'] || {})['voice_uris'] || []
      if device['voice'] && device['voice']['voice_uri']
        voice_uris = [device['voice']['voice_uri']] + voice_uris
        voice_uris = voice_uris[0, 10].uniq
        device['voice'].delete('voice_uri')
        device['voice']['voice_uris'] = voice_uris
      end
      self.settings['preferences']['devices'][device_key] ||= {}
      device.each do |key, val|
#         if self.settings['preferences']['devices']['default'][key] == device[key]
#           self.settings['preferences']['devices'][device_key].delete(key)
#         else
          self.settings['preferences']['devices'][device_key][key] = val
#         end
      end
    end
  end
  
  def process_home_board(home_board, non_user_params)
    board = Board.find_by_path(home_board['id'])
    if board && board.allows?(self, 'view')
      self.settings['preferences']['home_board'] = {
        'id' => board.global_id,
        'key' => board.key
      }
    elsif board && non_user_params['updater'] && board.allows?(non_user_params['updater'], 'share')
      board.share_with(self, true)
      self.settings['preferences']['home_board'] = {
        'id' => board.global_id,
        'key' => board.key
      }
    else
      self.settings['preferences'].delete('home_board')
    end
  end
  
  def process_sidebar_boards(sidebar, non_user_params)
    self.settings['preferences'] ||= {}
    result = []
    sidebar.each do |board|
      if board['alert']
        result.push({
          'name' => board['name'] || 'Alert',
          'alert' => true,
          'image' => board['image'] || 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/to%20sound.png'
        })
      else
        record = Board.find_by_path(board['key']) rescue nil
        allowed = record && record.allows?(self, 'view')
        if !allowed && record && non_user_params && non_user_params['updater'] && record.allows?(non_user_params['updater'], 'share')
          record.share_with(self, true)
          allowed = true
        end
        if record && allowed
          result.push({
            'name' => board['name'] || record.settings['name'] || 'Board',
            'key' => board['key'],
            'image' => board['image'] || record.settings['image_url'] || 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/board_3.png',
            'home_lock' => !!board['home_lock']
          })
        end
      end
    end

    if result.length == 0
      self.settings['preferences'].delete('sidebar_boards')
    else
      result = result.uniq{|b| b['alert'] ? 'alert' : b['key'] }
      self.settings['preferences']['sidebar_boards'] = result
      self.settings['preferences']['prior_sidebar_boards'] ||= []
      self.settings['preferences']['prior_sidebar_boards'] += result
      self.settings['preferences']['prior_sidebar_boards'].uniq!{|b| b['alert'] ? 'alert' : b['key'] }
    end
  end
  
  def admin?
    self.settings['admin'] == true
  end
  
  def self.default_sidebar_boards
    [
      {name: "Yes/No", key: 'example/yesno', image: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/yes_2.png', home_lock: false},
      {name: "Inflections", key: 'example/inflections', image: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/verb.png', home_lock: false},
      {name: "Keyboard", key: 'example/keyboard', image: 'https://s3.amazonaws.com/opensymbols/libraries/noun-project/Computer%20Keyboard-19d40c3f5a.svg', home_lock: false},
      {name: "Alert", alert: true, image: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/to%20sound.png'}
    ]
  end

  def notify_of_changes
    if @password_changed
      UserMailer.schedule_delivery(:password_changed, self.global_id)
      @password_changed = false
    end
    if @email_changed
      # TODO: should have confirmation flow for new email address
      UserMailer.schedule_delivery(:email_changed, self.global_id)
      @email_changed = false
    end
    true
  end
  
  def add_user_notification(args)
    args = args.with_indifferent_access
    self.settings['user_notifications'] ||= []
    self.settings['user_notifications'].reject!{|n| n['type'] == args['type'] && n['id'] == args['id'] }
    args['added_at'] = Time.now.iso8601
    self.settings['user_notifications'].unshift(args)
    self.settings['user_notifications'] = self.settings['user_notifications'][0, 10]
    self.save
  end
  
  def handle_notification(notification_type, record, args)
    if notification_type == 'push_message'
      if record.user_id == self.id
        self.settings['unread_messages'] ||= 0
        self.settings['unread_messages'] += 1
        self.settings['last_message_read'] = (record.started_at || 0).to_i
        self.save
      end
      self.add_user_notification({
        :id => record.global_id,
        :type => notification_type,
        :user_name => record.user.user_name,
        :author_user_name => record.author.user_name,
        :text => record.data['note']['text'],
        :occurred_at => record.started_at.iso8601
      })
      UserMailer.schedule_delivery(:log_message, self.global_id, record.global_id)
    elsif notification_type == 'board_buttons_changed'
      my_ubcs = UserBoardConnection.where(:user_id => self.id, :board_id => record.id)
      supervisee_ubcs = UserBoardConnection.where(:user_id => supervisees.map(&:id), :board_id => record.id)
      self.add_user_notification({
        :type => notification_type,
        :occurred_at => record.updated_at.iso8601,
        :for_user => my_ubcs.count > 0,
        :for_supervisees => supervisee_ubcs.map{|ubc| ubc.user.user_name }.sort,
        :previous_revision => args['revision'],
        :name => record.settings['name'],
        :key => record.key,
        :id => record.global_id
      })
    elsif notification_type == 'utterance_shared'
      pref = (self.settings && self.settings['preferences'] && self.settings['preferences']['share_notifications']) || 'email'
      if pref == 'email'
        UserMailer.schedule_delivery(:utterance_share, {
          'subject' => args['text'],
          'sharer_id' => args['sharer']['user_id'],
          'message' => args['text'],
          'to' => self.settings['email']
        })
      elsif pref == 'text'
        # TODO: twilio or something
      elsif pref == 'none'
        return
      end
      self.add_user_notification({
        :type => notification_type,
        :occurred_at => record.updated_at.iso8601,
        :sharer_user_name => args['sharer']['user_name'],
        :text => args['text']
      })
    end
  end
  
  def replace_board(starting_old_board_id, starting_new_board_id, update_inline=false)
    starting_old_board = Board.find_by_path(starting_old_board_id)
    starting_new_board = Board.find_by_path(starting_new_board_id)
    Board.replace_board_for(self, starting_old_board, starting_new_board, update_inline)
    ids = [starting_old_board_id]
    ids += (starting_old_board.reload.settings['downstream_board_ids'] || []) if starting_old_board
    {'affected_board_ids' => ids.uniq}
  end
  
  def copy_board_links(starting_old_board_id, starting_new_board_id)
    starting_old_board = Board.find_by_path(starting_old_board_id)
    starting_new_board = Board.find_by_path(starting_new_board_id)
    Board.copy_board_links_for(self, starting_old_board, starting_new_board)
    ids = [starting_old_board_id]
    ids += (starting_old_board.reload.settings['downstream_board_ids'] || []) if starting_old_board
    {'affected_board_ids' => ids.uniq}
  end

  def notify_on(attributes, notification_type)
    # TODO: ...
  end
end
