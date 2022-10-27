module JsonApi::BoardVersion
  extend JsonApi::Json
  
  TYPE_KEY = 'boardversion'
  DEFAULT_PAGE = 25
  MAX_PAGE = 50
  
  def self.build_json(version, args={})
    json = {}
    json['id'] = version.id
    json['action'] = version.event
    json['action'] = 'deleted' if json['action'] == 'destroy'
    json['action'] = 'created' if json['action'] == 'create'
    json['action'] = 'updated' if json['action'] == 'update'
    json['created'] = version.created_at.iso8601

    bucket = ENV['STATIC_S3_BUCKET'] || "coughdrop"
    
    if version.whodunnit
      if version.whodunnit.match(/^user:/)
        user_id = version.whodunnit.split(/:/)[1]
        args[:user_lookups] ||= {}
        user_json = args[:user_lookups][user_id]
        if !user_json
          user = User.find_by_path(user_id)
          if user
            args[:user_lookups][user_id] = JsonApi::User.as_json(user, :limited_identity => true)
            user_json = args[:user_lookups][user_id]
          end
        end
        if user_json
          json['modifier'] = {
            'description' => user_json['user_name'],
            'user_name' => user_json['user_name'],
            'image' => user_json['avatar_url']
          }
        end
      elsif version.whodunnit.match(/^admin:/)
        json['modifier'] = {
          'description' => 'CoughDrop Admin',
          'image' => "https://www.mycoughdrop.com/images/logo-big.png"
        }
      end
      later_object = version.instance_variable_get('@later_object')
      
      obj = version.reify rescue nil
      if obj && !obj.settings
        obj.load_secure_object rescue nil
      end
      if json['action'] == 'created' && later_object && later_object.parent_board_id
        json['action'] = 'copied'
      end
      if obj && obj.settings
        if json['action'] == 'updated' && obj.settings['edit_description'] && obj.settings['edit_description']['notes'] && obj.settings['edit_description']['notes'].length > 0
          json['action'] = obj.settings['edit_description']['notes'].join(', ')
        end
        if args[:admin]
          args[:board_lookups] ||= {}
          upstream_ids = obj.settings['immediately_upstream_board_ids'] || []
          upstream_boards = []
          found_upstream_ids = []
          upstream_ids.each do |id|
            if args[:board_lookups][id]
              found_upstream_ids << id 
              upstream_boards << args[:board_lookups][id]
            end
          end
          missing_upstream_ids = upstream_ids - found_upstream_ids
          # TODO: sharding
          missing_boards = Board.select('key, id').where(:id => Board.local_ids(missing_upstream_ids))
          missing_boards.each do |board|
            args[:board_lookups][board.global_id] = {
              id: board.global_id,
              key: board.key
            }
            upstream_boards << args[:board_lookups][board.global_id]
          end
          json['immediately_upstream_boards'] = upstream_boards
        end
      end
    end
    if args[:admin]
      json['immediately_upstream_boards'] ||= [] 
    end
    json['modifier'] ||= {
      'description' => 'Unknown User',
      'image' => "https://s3.amazonaws.com/#{bucket}/avatars/avatar-0.png"
    }

    json
  end
end
