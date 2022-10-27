class ApplicationController < ActionController::Base
  before_filter :set_host
  before_filter :check_api_token
  before_filter :replace_helper_params
  after_filter :log_api_call
  
  # TODO: do we need a cache buster? Not for ember renders obviously, but for APIs?
  def set_host
    JsonApi::Json.set_host("#{request.protocol}#{request.host_with_port}")
  end
  
  def log_api_call
    time = @time ? (Time.now - @time) : nil
    ApiCall.log(@token, @api_user, request, response, time)
    true
  end
  
  def check_api_token
    return true unless request.path.match(/^\/api/) || request.path.match(/^\/oauth2/) || params['check_token'] || request.headers['Check-Token']
#     if request.path.match(/^\/api/)
#       headers['Access-Control-Allow-Origin'] = '*'
#       headers['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS'
#       headers['Access-Control-Max-Age'] = "1728000"      
#     end
    @time = Time.now
    Time.zone = nil
    token = params['access_token']
    PaperTrail.whodunnit = nil
    if !token && request.headers['Authorization']
      match = request.headers['Authorization'].match(/^Bearer ([\w\-_\~]+)$/)
      token = match[1] if match
    end
    @token = token
    if token
      # TODO: track last_used_at for each token, also device in general
      id = token.split(/~/)[0]
      @api_device = Device.find_by_global_id(id)
      if !['/api/v1/token_check'].include?(request.path)
        if !@api_device || !@api_device.valid_token?(token, request.headers['X-CoughDrop-Version'])
          @api_device = nil
          set_browser_token_header
          api_error 400, {error: "Invalid token", token: token}
          return false
        end
      end
      @api_user = @api_device && @api_device.user
      # TODO: timezone user setting
      Time.zone = "Mountain Time (US & Canada)"
      PaperTrail.whodunnit = user_for_paper_trail

      # TODO: masquerading is too technical for end users, just have "speak mode as..."
      # instead, and leave masquerading as an admin-only function if absolutely necessary
      # to have at all.
      as_user = params['as_user_id'] || request.headers['X-As-User-Id']
      if @api_user && as_user
        @linked_user = User.find_by_path(as_user)
        admin = Organization.admin
        if admin && admin.manager?(@api_user) && @linked_user #@linked_user && @linked_user != @api_user && @linked_user.allows?(@api_user, 'edit') 
          @true_user = @api_user
          @api_user = @linked_user
          PaperTrail.whodunnit = "user:#{@true_user.global_id}:as:#{@api_user.global_id}"
        else
          api_error 400, {error: "Invalid masquerade attempt", token: token, user_id: as_user}
        end
      end
      
    end
  end
  
  def user_for_paper_trail
    @api_user ? "user:#{@api_user.global_id}" : "unauthenticated:#{request.remote_ip}"
  end
  
  def replace_helper_params
    params.each do |key, val|
      if @api_user && (key == 'id' || key.match(/_id$/)) && val == 'self'
        params[key] = @api_user.global_id
      end
      if @api_user && (key == 'id' || key.match(/_id$/)) && val == 'my_org' && Organization.manager?(@api_user)
        org = @api_user.organization_hash.select{|o| o['type'] == 'manager' }.sort_by{|o| o['added'] || Time.now.iso8601 }[0]
        params[key] = org['id'] if org
      end
    end
  end
  
  def require_api_token
    if !@api_user
      api_error 400, {error: "Access token required for this endpoint"}
    end
  end
  
  def allowed?(obj, permission)
    if !obj || !obj.allows?(@api_user, permission)
      api_error 400, {error: "Not authorized"}
      false
    else
      true
    end
  end
  
  def api_error(status_code, hash)
    hash[:status] = status_code
    if hash[:error].blank? && hash['error'].blank?
      hash[:error] = "unspecified error"
    end
    cachey = request.headers['X-Has-AppCache'] || params['nocache']
    render json: hash.to_json, status: (cachey ? 200 : status_code)
  end
  
  def exists?(obj, ref_id=nil)
    if !obj
      res = {error: "Record not found"}
      res[:id] = ref_id if ref_id
      api_error 404, res
      false
    else
      true
    end
  end

  def set_browser_token_header
    response.headers['BROWSER_TOKEN'] = Security.browser_token
  end
end
