class UserGoal < ActiveRecord::Base
  include Processable
  include Permissions
  include Async
  include GlobalId
  include SecureSerialize

  belongs_to :user
  before_save :generate_defaults
  after_save :check_set_as_primary
  after_destroy :remove_if_primary
  replicated_model  

  secure_serialize :settings

  add_permissions('view', 'comment') {|user| self.user && self.user.allows?(user, 'supervise') }
  add_permissions('view', 'comment', 'edit') {|user| self.user && self.user.allows?(user, 'edit') }
  
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
  
  def remove_if_primary
    if self.user && self.user.settings && self.user.settings['primary_goal'] && self.user.settings['primary_goal']['id'] == self.global_id
      self.user.settings['primary_goal'] = nil
      self.user.save
    end
    true
  end
  
  def check_set_as_primary
    if @set_as_primary
      if self.user && self.user.settings
        UserGoal.where(:user_id => self.user_id).update_all(:primary => false)
        UserGoal.where(:id => self.id).update_all(:primary => true)
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
    ['summary', 'description'].each do |key|
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
      Time.parse(self.settings['goal_advances_at'])
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
