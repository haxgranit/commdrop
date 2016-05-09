module JsonApi::Goal
  extend JsonApi::Json
  
  TYPE_KEY = 'goal'
  DEFAULT_PAGE = 25
  MAX_PAGE = 50
    
  def self.build_json(goal, args={})
    json = {}
    json['id'] = goal.global_id
    json['has_video'] = goal.settings['video_id']
    
    ['active', 'template', 'template_header'].each do |key|
      json[key] = goal.send(key)
    end

    ['summary', 'description'].each do |key|
      json[key] = goal.settings[key]
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
        goal['user'] = JsonApi::User.as_json(user, limited_identity: true) if user
        author = users_hash[goal.settings['author_id']]
        goal['author'] = JsonApi::User.as_json(author, limited_identity: true) if author
        goal['comments'] = []
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
          
          goal['comments'] << res
        end
      end
    end
    json
  end
end

class UserGoal < ActiveRecord::Base
  include Processable
  include Permissions
  include Async
  include GlobalId
  include SecureSerialize

  belongs_to :user
  before_save :generate_defaults
  after_save :check_set_as_primary
  replicated_model  

  secure_serialize :settings

  add_permissions('view') {|user| self.user && self.user.allows?('supervise') }
  add_permissions('view', 'edit') {|user| self.user && self.user.allows?('edit') }
  
  def generate_defaults
    self.settings ||= {}
    self.settings['summary'] ||= "user goal"
    if self.active && !self.settings['started_at']
      self.settings['started_at'] = Time.now.iso8601
    end
    if !self.active && !self.settings['ended_at'] && self.settings['started_at']
      self.settings['ended_at'] = Time.now.iso8601
    end
  end
  
  def summary
    self.settings['summary']
  end
  
  def check_set_as_primary
    if @set_as_primary
      if self.user && self.user.settings
        self.user.settings['primary_goal'] = {
          'id' => self.global_id,
          'summary' => self.summary
        }
        self.user.save
      end
    end
    true
  end
  
  def primary?
    !!(self.user && self.user.settings && self.user.settings['primary_goal'] && self.user.settings['primary_goal']['id'] == self.global_id)
  end
  
  def process_params(params, non_user_params)
    raise "user required as goal target" unless self.user_id || non_user_params[:user]
    raise "user required as update author" unless non_user_params[:author]
    self.user ||= non_user_params[:user] if non_user_params[:user]
    self.settings ||= {}
    self.settings['author_id'] ||= non_user_params[:author].global_id
    self.active = !!params[:active] if params[:active] != nil
    ['template', 'template_header'].each do |key|
      self.settings[key] = params[key] if params[key]
    end
    if params['video_id']
      video = UserVideo.find_by_global_id(params['video_id'])
      if video
        self.settings['video'] = {
          'id' => params['video_id'],
          'duration' => video.settings['duration']
        }
      end
    end
    if params['template_id']
      template = UserGoal.find_by_global_id(params['template_id'])
      if template && template.template
        self.build_from_template(template, self.user)
      end
    end
    if params['comment']
      self.settings['comments'] || []
      video = UserVideo.find_by_global_id(params['comment']['video_id']) if params['comment']['video_id']
      comment = {
        'id' => 0,
        'user_id' => non_user_params[:author].global_id,
        'user_name' => non_user_params[:author].user_name,
        'created' => Time.now.iso8601,
        'text' => params['comment']['text']
      }
      if video
        comment['video'] = {
          'id' => video.global_id,
          'duration' => video.settings['duration']
        }
      end
      self.settings['comments'] << comment
    end
    
    if params[:primary]
      @set_as_primary = true
    end
    true
  end
  
  def author
    self.settings && self.settings['author_id'] && User.find_by_global_id(self.settings['author_id'])
  end

  def calculate_advancement     
    return nil unless self.settings && self.settings['next_template_id']
    if self.settings['goal_duration']
      Time.now + self.settings['goal_duration']
    elsif self.settings['goal_advances_at']
      Time.parse(self.settings['goal_advances_at']
    else
      nil
    end
  end
    
  def build_from_template(template, user, set_as_primary=false)
    self.settings ||= {}
    self.settings['template_id'] = template.global_id
    self.advance_at = template.calculate_advancement
    self.user = user
    self.settings['author_id'] = prior_goal.settings['author_id']
    self.settings['video_id'] = template.settings['video_id']
    self.active = true
    @set_as_primary = true if set_as_primary
  end
  
  def next_template
    return nil unless self.settings && self.settings['next_template_id']
    res = UserGoal.find_by_global_id(self.settings['next_template_id'])
    res = nil unless res.template
    res
  end
  
  def advance!
    return true unless self.active && self.advance_at && self.advance_at < Time.now && self.settings && self.settings['template_id']
    template = UserGoal.find_by_global_id(self.settings['template_id'])
    return false unless template && template.template
    next_template = template.next_template
    return false unless next_template
    return false unless self.user
    new_goal = UserGoal.new
    new_goal.build_from_template(next_template, self.user, self.primary?)
    new_goal.save

    self.active = false
    self.save
  end
  
  def self.advance_goals
    UserGoal.where(['advance_at < ?', Time.now]).each do |goal|
      goal.schedule(:advance!)
    end
  end
end
