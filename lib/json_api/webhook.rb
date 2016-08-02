module JsonApi::Webhook
  extend JsonApi::Json
  
  TYPE_KEY = 'webhook'
  DEFAULT_PAGE = 10
  MAX_PAGE = 25
    
  def self.build_json(obj, args={})
    json = {}
    # TODO: include devices
    
    json['id'] = obj.global_id
    json['name'] = obj.settings['name'] || 'Unnamed Webhook'
    json['url'] = obj.settings['url'] if obj.settings['url']
    json['webhook_type'] = obj.settings['webhook_type']
    json['webhooks'] = (obj.settings['notifications'] || {}).keys
    includes_content = false
    (obj.settings['notifications'] || {}).each do |key, list|
      list.each do |notif|
        includes_content = true if notif['include_content']
      end
    end
    json['include_content'] = !!includes_content
    json['advanced_configuration'] = !!obj.settings['advanced_configuration']
    json['custom_configuration'] = !!obj.settings['url']

    json
  end
end
