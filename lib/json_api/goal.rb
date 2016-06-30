module JsonApi::Goal
  extend JsonApi::Json
  
  TYPE_KEY = 'goal'
  DEFAULT_PAGE = 25
  MAX_PAGE = 50
    
  def self.build_json(goal, args={})
    json = {}
    json['id'] = goal.global_id
    json['has_video'] = goal.settings['video_id']
    
    ['active', 'template', 'template_header', 'primary'].each do |key|
      json[key] = goal.send(key)
    end

    ['summary', 'description'].each do |key|
      json[key] = goal.settings[key]
    end
    json['started'] = goal.settings['started_at']
    json['ended'] = goal.settings['ended_at']
    if goal.settings['stats']
      json['stats'] = {}
      goal.settings['stats'].each do |key, val|
        if val.respond_to?(:round)
          json['stats'][key] = val.round(2)
        else
          json['stats'][key] = val
        end
      end
    end

    if args[:permissions]
      json['permissions'] = goal.permissions_for(args[:permissions])
      if json['permissions']['view']
        video_ids = []
        video_ids << goal.settings['video_id'] if goal.settings['video_id']
        
        user_ids = []
        user_ids << goal.related_global_id(:user_id) if goal.user_id
        user_ids << goal.settings['author_id']
        (goal.settings['comments'] || []).each do |comment| 
          user_ids << comment['user_id'] if comment['user_id']
          video_ids << comment['video_id'] if comment['video_id']
        end
        users_hash = {}
        User.find_all_by_global_id(user_ids).each{|user| users_hash[user.global_id] = user }
        videos_hash = {}
        UserVideo.find_all_by_global_id(video_ids).each{|video| videos_hash[video.global_id] = video }

        video = videos_hash[goal.settings['video_id']]
        json['video'] = video.summary_hash if video


        user = users_hash[goal.related_global_id(:user_id)]
        json['user'] = JsonApi::User.as_json(user, limited_identity: true) if user
        author = users_hash[goal.settings['author_id']]
        json['author'] = JsonApi::User.as_json(author, limited_identity: true) if author
        json['comments'] = []
        (goal.settings['comments'] || []).each do |comment|
          commenter = users_hash[comment['user_id']]
          res = {
            'id' => comment['id'],
            'created' => comment['created'],
            'text' => comment['text']
          }
          video = comment['video_id'] && videos_hash[comment['video_id']]
          res['video'] = video.summary_hash if video
          res['user'] = JsonApi::User.as_json(commenter, limited_identity: true) if commenter
          
          json['comments'] << res
        end
      end
    end
    json
  end
end
