module JsonApi::Organization
  extend JsonApi::Json
  
  TYPE_KEY = 'organization'
  DEFAULT_PAGE = 15
  MAX_PAGE = 25
  
  def self.build_json(org, args={})
    json = {}
    json['id'] = org.global_id
    json['name'] = org.settings['name']
    json['admin'] = !!org.admin
    
    if args.key?(:permissions)
      json['permissions'] = org.permissions_for(args[:permissions])
    end
    
    if json['permissions'] && json['permissions']['edit']
      json['allotted_licenses'] = org.settings['total_licenses'] || 0
      json['used_licenses'] = org.sponsored_users.count
      json['total_users'] = org.users.count
      json['total_managers'] = org.managers.count
      json['total_supervisors'] = org.supervisors.count
      json['created'] = org.created_at.iso8601
      recent_sessions = LogSession.where(['started_at > ?', 2.weeks.ago])
      if !org.admin?
        recent_sessions = recent_sessions.where(:user_id => org.users.map(&:id))
      end
      json['recent_session_count'] = recent_sessions.count
      json['recent_session_user_count'] = recent_sessions.distinct.count('user_id')
    end
    
    json
  end
end
