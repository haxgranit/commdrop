module JsonApi::Snapshot
  extend JsonApi::Json
  
  TYPE_KEY = 'snapshot'
  DEFAULT_PAGE = 50
  MAX_PAGE = 100
    
  def self.build_json(snapshot, args={})
    json = {}
    
    json['id'] = snapshot.global_id
    json['name'] = snapshot.settings['name'] || "Unnamed Snapshot"
    json['user_id'] = snapshot.related_global_id(snapshot.user_id)
    ['start', 'end', 'device_id', 'location_id'].each do |key|
      json[key] = snapshot.settings[key]
    end

    if args.key?(:permissions)
      json['permissions'] = snapshot.permissions_for(args[:permissions])
    end
    
    json
  end
end
