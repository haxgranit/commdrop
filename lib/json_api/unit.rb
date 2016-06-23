module JsonApi::Unit
  extend JsonApi::Json
  
  TYPE_KEY = 'unit'
  DEFAULT_PAGE = 10
  MAX_PAGE = 25
    
  def self.build_json(unit, args={})
    json = {}
    
    json['id'] = unit.global_id
    json['name'] = unit.settings['name'] || "Unnamed Room"
    
    users_hash = args[:page_data] && args[:page_data][:users_hash]
    if !users_hash
      users = User.find_all_by_global_id(unit.all_user_ids)
      users_hash = {}
      users.each{|u| users_hash[u.global_id] = u }
    end
    
    json['supervisors'] = []
    json['communicators'] = []
    (unit.settings['supervisors'] || []).sort_by{|u| u['user_name'] || '' }.each do |sup|
      user = users_hash[sup['user_id']]
      hash = JsonApi::User.as_json(user, limited_identity: true) if user
      hash['org_unit_edit_permission'] = sup['edit_permission']
      json['supervisors'] << hash
    end
    (unit.settings['communicators'] || []).sort_by{|u| u['user_name'] || '' }.each do |sup|
      user = users_hash[sup['user_id']]
      json['communicators'] << JsonApi::User.as_json(user, limited_identity: true) if user
    end
    
    json
  end
  
  def self.page_data(results)
    res = {}
    ids = results.map(&:all_user_ids).flatten.uniq
    users = User.find_all_by_global_id(ids)
    res[:users_hash] = {}
    users.each{|u| res[:users_hash][u.global_id] = u }
    res
  end
end
