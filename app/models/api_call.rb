class ApiCall < ActiveRecord::Base
  include SecureSerialize
  secure_serialize :data
  replicated_model
  
  def self.log(token, user, request, response, time)
    if request && request.path && request.path.match(/^\/api\/v\d+/) && token && user && response
      call = ApiCall.new
      call.user_id = user.id
      call.data ||= {}
      call.data['url'] = request.url
      call.data['method'] = request.method
      call.data['access_token'] = token
      call.data['status'] = response.code
      call.data['time'] = time
      call.save
    else
      false
    end
  end
end
