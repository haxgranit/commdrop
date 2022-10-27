class Api::UsersController < ApplicationController
  extend ::NewRelic::Agent::MethodTracer

  before_filter :require_api_token, :except => [:update, :show, :create, :confirm_registration, :forgot_password, :password_reset]
  def show
    user = User.find_by_path(params['id'])
    user_device = @api_user == user && @api_device
    allowed = false
    self.class.trace_execution_scoped(['user/permission_check']) do
      allowed = allowed?(user, 'view_existence')
    end
    return unless allowed
    json = {}
    self.class.trace_execution_scoped(['user/json_render']) do
      json = JsonApi::User.as_json(user, :wrapper => true, :permissions => @api_user, :device => user_device)
    end
    
    render json: json.to_json
  end
  
  def index
    if !Organization.admin_manager?(@api_user)
      return api_error 400, {error: 'admins only'}
    end
    if !params['q']
      return api_error 400, {error: 'q parameter required'}
    end
    users = []
    if params['q'].match(/@/)
      users = User.find_by_email(params['q'])
    else
      users = User.where(:user_name => params['q'])
      users = [User.find_by_global_id(params['q'])].compact if users.count == 0
      if users.count == 0
        users = User.where(["user_name ILIKE ?", "%#{params['q']}%"]).order('user_name')
      end
    end
    render json: JsonApi::User.paginate(params, users)
  end
  
  def update
    user = User.find_by_path(params['id'])
    user_device = @api_user == user && @api_device
    return unless exists?(user)
    options = {}
    if params['reset_token'] && user.valid_reset_token?(params['reset_token'])
      params['user'] ||= {}
      params['user'] = params['user'].slice('password')
      options[:allow_password_change] = true
      user.used_reset_token!(params['reset_token'])
    elsif params['reset_token'] == 'admin' && user.allows?(@api_user, 'support_actions')
      params['user'] ||= {}
      params['user'] = params['user'].slice('password')
      options[:allow_password_change] = true
      user.used_reset_token!(params['reset_token'])
    elsif user.allows?(@api_user, 'manage_supervision') && !user.allows?(@api_user, 'edit')
      params['user'] ||= {}
      params['user'] = params['user'].slice('supervisor_key')
    else
      return unless allowed?(user, 'edit')
    end
    options['device'] = @api_device if user == @api_user
    options['updater'] = @api_user
      
    if user.process(params['user'], options)
      render json: JsonApi::User.as_json(user, :wrapper => true, :permissions => @api_user, :device => user_device).to_json
    else
      api_error 400, {error: 'update failed', errors: user.processing_errors}
    end
  end
  
  def create
    user = User.process_new(params['user'], {:pending => true})
    if !user || user.errored?
      return api_error(400, {error: "user creation failed", errors: user && user.processing_errors})
    end
    UserMailer.schedule_delivery(:confirm_registration, user.global_id)
    UserMailer.schedule_delivery(:new_user_registration, user.global_id)

    d = Device.find_or_create_by(:user_id => user.id, :device_key => 'default', :developer_key_id => 0)
    d.settings['ip_address'] = request.remote_ip
    d.settings['user_agent'] = request.headers['User-Agent']
    
    d.generate_token!

    res = JsonApi::User.as_json(user, :wrapper => true, :permissions => @api_user || user)
    res['meta'] = JsonApi::Token.as_json(user, d)
    render json: res.to_json
  end
  
  def claim_voice
    user = User.find_by_path(params['user_id'])
    return unless exists?(user)
    return unless allowed?(user, 'edit')
    if user.add_premium_voice(params['voice_id'])
      res = {voice_added: true, voice_id: params['voice_id']}
      if params['voice_url']
        res[:download_url] = Uploader.signed_download_url(params['voice_url'])
      end
      render json: res.to_json
    else
      api_error(400, {error: "no more voices available"})
    end
  end
  
  def rename
    user = User.find_by_path(params['user_id'])
    return unless exists?(user)
    return unless allowed?(user, 'edit')
    if params['new_key'] && params['old_key'] == user.user_name && user.rename_to(params['new_key'])
      render json: {rename: true, key: params['new_key']}.to_json
    else
      api_error(400, {error: "user rename failed", key: params['key'], collision: user.collision_error?})
    end
  end
  
  def flush_logs
    user = User.find_by_path(params['user_id'])
    return unless allowed?(user, 'delete')
    return api_error(400, {'flushed' => 'false'}) unless user.user_name == params['user_name'] && user.global_id == params['user_id']
    progress = Progress.schedule(Flusher, :flush_user_logs, user.global_id, user.user_name)
    render json: JsonApi::Progress.as_json(progress, :wrapper => true)
  end
  
  def flush_user
    user = User.find_by_path(params['user_id'])
    return unless allowed?(user, 'delete')
    return api_error(400, {'flushed' => 'false'}) unless user.user_name == params['user_name'] && user.global_id == params['user_id']
    progress = Progress.schedule(Flusher, :flush_user_completely, user.global_id, user.user_name)
    render json: JsonApi::Progress.as_json(progress, :wrapper => true)
  end
  
  def hide_device
    user = User.find_by_path(params['user_id'])
    return unless allowed?(user, 'delete')
    device = Device.find_by_global_id(params['device_id'])
    if device && device.user_id == user.id
      device.settings['hidden'] = true
      device.save
      render json: JsonApi::Device.as_json(device, :current_device => @api_device)
    else
      api_error 400, {error: 'matching device not found'}
    end
  end
  
  def rename_device
    user = User.find_by_path(params['user_id'])
    return unless allowed?(user, 'delete')
    device = Device.find_by_global_id(params['device_id'])
    if device && device.user_id == user.id
      device.settings['name'] = params['device']['name']
      device.save
      render json: JsonApi::Device.as_json(device, :current_device => @api_device)
    else
      api_error 400, {error: 'matching device not found'}
    end
  end
  
  def subscribe
    user = User.find_by_path(params['user_id'])
    admin = Organization.admin
    token = params['token']
    if params['type'] == 'gift_code'
      return unless allowed?(user, 'edit')
      progress = Progress.schedule(user, :redeem_gift_token, token['code'])
    elsif params['type'] == 'never_expires' || params['type'] == 'eval' || params['type'] == 'add_1' || params['type'] == 'manual_supporter' || params['type'] == 'add_voice'
      return unless allowed?(user, 'admin_support_actions')
      progress = Progress.schedule(user, :subscription_override, params['type'], @api_user && @api_user.global_id)
    else
      return unless allowed?(user, 'edit')
      progress = Progress.schedule(user, :process_subscription_token, token, params['type'])
    end
    render json: JsonApi::Progress.as_json(progress, :wrapper => true)
  end
  
  def unsubscribe
    user = User.find_by_path(params['user_id'])
    return unless allowed?(user, 'edit')
    progress = Progress.schedule(user, :process_subscription_token, 'token', 'unsubscribe')
    render json: JsonApi::Progress.as_json(progress, :wrapper => true)
  end
  
  def replace_board
    user = User.find_by_path(params['user_id'])
    old_board = Board.find_by_path(params['old_board_id'])
    new_board = Board.find_by_path(params['new_board_id'])
    return unless exists?(user, params['user_id']) && exists?(old_board, params['old_board_id']) && exists?(new_board, params['new_board_id'])
    return unless allowed?(user, 'edit') && allowed?(old_board, 'view') && allowed?(new_board, 'view')
    
    progress = Progress.schedule(user, :replace_board, params['old_board_id'], params['new_board_id'], params['update_inline'], user_for_paper_trail)
    render json: JsonApi::Progress.as_json(progress, :wrapper => true)
  end
  
  def copy_board_links
    user = User.find_by_path(params['user_id'])
    old_board = Board.find_by_path(params['old_board_id'])
    new_board = Board.find_by_path(params['new_board_id'])
    return unless exists?(user, params['user_id']) && exists?(old_board, params['old_board_id']) && exists?(new_board, params['new_board_id'])
    return unless allowed?(user, 'edit') && allowed?(old_board, 'view') && allowed?(new_board, 'view')
    
    progress = Progress.schedule(user, :copy_board_links, params['old_board_id'], params['new_board_id'], user_for_paper_trail)
    render json: JsonApi::Progress.as_json(progress, :wrapper => true)
  end
  
  def confirm_registration
    user = User.find_by_path(params['user_id'])
    if params['resend']
      sent = false
      if user.settings['pending'] != false
        sent = true
        UserMailer.schedule_delivery(:confirm_registration, user.global_id)
      end
      render json: {sent: sent}.to_json
    else
      confirmed = false
      if params['code'] && user && params['code'] == user.registration_code
        confirmed = true
        user.settings['pending'] = false
        user.save
      end
      render json: {:confirmed => confirmed}.to_json
    end
  end
  
  def forgot_password
    # TODO: throttling...
    user = User.find_by_path(params['key'])
    users = [user].compact
    if !user && params['key'] && params['key'].match(/@/)
      users = User.where(:email_hash => User.generate_email_hash(params['key']))
    end
    not_disabled_users = users.select{|u| !u.settings['email_disabled'] }
    reset_users = not_disabled_users.select{|u| u.generate_password_reset }
    if users.length > 0
      if reset_users.length > 0
        UserMailer.schedule_delivery(:forgot_password, reset_users.map(&:global_id))
        if reset_users.length == users.length
          render json: {email_sent: true, users: users.length}.to_json
        else
          message = "One or more of the users matching that name or email have had too many password resets, so those links weren't emailed to you. Please wait at least three hours and try again."
          render json: {email_sent: true, users: users.length, message: message}.to_json
        end
      else
        message = "All users matching that name or email have had too many password resets. Please wait at least three hours and try again."
        message = "The user matching that name or email has had too many password resets. Please wait at least three hours and try again." if users.length == 1
        message = "The email address for that account has been manually disabled." if not_disabled_users.length == 0
        api_error 400, {email_sent: false, users: 0, error: message, message: message}
      end
    else
      if params['key'] && params['key'].match(/@/)
        UserMailer.schedule_delivery(:login_no_user, params['key'])
        render json: {email_sent: true, users: 0}.to_json
      else
        message = "No users found with that name or email."
        api_error 400, {email_sent: false, users: 0, error: message, message: message}
      end
    end
  end
  
  def password_reset
    user = User.find_by_path(params['user_id'])
    # TODO: clear reset code after too many attempts, log data for troubleshooting
    if user && reset_token = user.reset_token_for_code(params['code'])
      render json: {valid: true, reset_token: reset_token}.to_json
    else
      api_error 400, {valid: false}
    end
  end
  
  def daily_stats
    user = User.find_by_path(params['user_id'])
    return unless allowed?(user, 'supervise')
    begin
      options = request.query_parameters
      render json: Stats.cached_daily_use(user.global_id, options)
    rescue Stats::StatsError => e
      api_error 400, {error: e.message}
    end
  end
  
  def hourly_stats
    user = User.find_by_path(params['user_id'])
    return unless allowed?(user, 'supervise')
    begin
      options = request.query_parameters
      render json: Stats.hourly_use(user.global_id, options)
    rescue Stats::StatsError => e
      api_error 400, {error: e.message}
    end
  end
end
