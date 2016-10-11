module JsonApi::Goal
  extend JsonApi::Json
  
  TYPE_KEY = 'goal'
  DEFAULT_PAGE = 30
  MAX_PAGE = 50
    
  def self.build_json(goal, args={})
    json = {}
    json['id'] = goal.global_id
    json['has_video'] = goal.settings['video_id']
    
    instance_goal = goal
    if !args[:permissions] && args[:lookups] != false && goal.template_header && goal.settings['goal_advances_at'] && goal.settings['linked_template_ids']
      current_goal = goal.current_template
      instance_goal = current_goal if current_goal
    end
    
    if goal.template 
      ['active', 'template', 'template_header'].each do |key|
        json[key] = goal.send(key)
      end
      ['sequence_description', 'sequence_summary', 'next_template_id', 'template_header_id'].each do |key|
        json[key] = goal.settings[key]
      end
      json['date_based'] = !!goal.settings['goal_advances_at']
      if goal.settings['template_stats']
        json['template_stats'] = goal.settings['template_stats']
      end
      json['sequence'] = goal.settings['template_stats'] && goal.settings['template_stats']['goals'] && goal.settings['template_stats']['goals'] > 1
      json['next_template_id'] = goal.settings['next_template_id']
      json['template_header_id'] = goal.settings['template_header_id']
    else
      ['active', 'primary'].each do |key|
        json[key] = goal.send(key)
      end
    end

    ['summary', 'description'].each do |key|
      json[key] = instance_goal.settings[key]
    end
    json['started'] = instance_goal.settings['started_at']
    json['ended'] = instance_goal.settings['ended_at']
    json['duration'] = instance_goal.settings['goal_duration'] if goal.settings['goal_duration']
    json['advance'] = instance_goal.goal_advance && instance_goal.goal_advance.iso8601
    
    if instance_goal.settings['stats']
      json['stats'] = {}
      instance_goal.settings['stats'].each do |key, val|
        if val.respond_to?(:round)
          json['stats'][key] = val.round(2)
        else
          json['stats'][key] = val
        end
      end
    end
    

    if args[:permissions]
      json['permissions'] = instance_goal.permissions_for(args[:permissions])
      if goal.template
        if goal.settings['template_header_id']
          header = goal if goal.settings['template_header_id'] == goal.global_id
          header ||= UserGoal.find_by_path(goal.settings['template_header_id'])
          linked_goals = UserGoal.find_all_by_global_id(header.settings['linked_template_ids']) if header && header.settings['linked_template_ids']
          next_template = linked_goals.detect{|g| goal.settings['next_template_id'] == g.global_id } if linked_goals
          previous_template = linked_goals.detect{|g| g.settings['next_template_id'] == goal.global_id } if linked_goals
          json['related'] ||= {}
          json['related']['next'] = JsonApi::Goal.build_json(next_template, :lookups => false) if next_template
          json['related']['previous'] = JsonApi::Goal.build_json(previous_template, :lookups => false) if previous_template
          json['related']['header'] = JsonApi::Goal.build_json(header, :lookups => false) if header
        end
      end
      if json['permissions']['view']
        video_ids = []
        video_ids << instance_goal.settings['video_id'] if instance_goal.settings['video_id']
        
        user_ids = []
        user_ids << instance_goal.related_global_id(:user_id) if instance_goal.user_id
        user_ids << instance_goal.settings['author_id']
        (instance_goal.settings['comments'] || []).each do |comment| 
          user_ids << comment['user_id'] if comment['user_id']
          video_ids << comment['video_id'] if comment['video_id']
        end
        users_hash = {}
        User.find_all_by_global_id(user_ids).each{|user| users_hash[user.global_id] = user }
        videos_hash = {}
        UserVideo.find_all_by_global_id(video_ids).each{|video| videos_hash[video.global_id] = video }

        video = videos_hash[instance_goal.settings['video_id']]
        json['video'] = video.summary_hash if video
        
        if !instance_goal.template
          json['advance'] = instance_goal.advance_at && instance_goal.advance_at.iso8601
        end

        user = users_hash[instance_goal.related_global_id(:user_id)]
        json['user'] = JsonApi::User.as_json(user, limited_identity: true) if user
        author = users_hash[instance_goal.settings['author_id']]
        json['author'] = JsonApi::User.as_json(author, limited_identity: true) if author
        json['comments'] = []
        (instance_goal.settings['comments'] || []).each do |comment|
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
    elsif goal.template
      author = goal.user
      json['author'] = JsonApi::User.as_json(author, limited_identity: true) if author
    end
    json
  end
end
