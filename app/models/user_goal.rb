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

  add_permissions('view', 'comment', 'edit') {|user| self.user && self.user == user }
  add_permissions('view', 'comment') {|user| self.user && self.user.allows?(user, 'supervise') }
  add_permissions('view', 'comment', 'edit') {|user| self.user && self.user.allows?(user, 'edit') }
  cache_permissions
  
  def generate_defaults
    self.settings ||= {}
    self.settings['summary'] ||= "user goal"
    self.generate_stats
    self.primary ||= false
    if self.active && !self.settings['started_at']
      self.settings['started_at'] = Time.now.iso8601
    end
    if !self.active && !self.settings['ended_at'] && self.settings['started_at']
      self.settings['ended_at'] = Time.now.iso8601
    end
  end
  
  def generate_stats
    stats = {}
    # TODO: sharding
    sessions = []
    # monthly for all time
    sessions = LogSession.where(:goal_id => self.id).select{|s| s.started_at } if self.id
    stats['monthly'] = {}
    suggested_level = 'monthly'
    # weekly for the past 12 weeks
    stats['weekly'] = {}
    weekly_sessions = sessions.select{|s| s.started_at && s.started_at > 12.weeks.ago }
    suggested_level = 'weekly' if weekly_sessions.length == sessions.length
    # daily for the past 2 weeks
    stats['daily'] = {}
    daily_sessions = sessions.select{|s| s.started_at && s.started_at > 2.weeks.ago }
    suggested_level = 'daily' if daily_sessions.length == weekly_sessions.length
    [[daily_sessions, 'daily'], [weekly_sessions, 'weekly'], [sessions, 'monthly']].each do |sessions, level|
      sessions.each do |session|
        key = session.started_at.utc.iso8601[0, 10]
        key = "#{session.started_at.utc.to_date.cwyear}-#{session.started_at.utc.to_date.cweek}" if level == 'weekly'
        key = session.started_at.utc.iso8601[0, 7] if level == 'monthly'
        [key, 'totals'].each do |k|
          stats[level][k] ||= {}
          stats[level][k]['sessions'] ||= 0
          stats[level][k]['sessions'] += 1
          stats[level][k]['positives'] ||= 0
          stats[level][k]['positives'] += session.data['goal']['positives'] if session.data['goal'] && session.data['goal']['positives']
          stats[level][k]['negatives'] ||= 0
          stats[level][k]['negatives'] += session.data['goal']['negatives'] if session.data['goal'] && session.data['goal']['negatives']
          stats[level][k]['statuses'] ||= []
          stats[level][k]['statuses'] << session.data['goal']['status'] if session.data['goal'] && session.data['goal']['status']
        end
      end
      stats[level]['totals'] ||= {
        'sessions' => 0,
        'positives' => 0,
        'negatives' => 0,
        'statuses' => []
      }
    end
    all_statuses = stats['monthly']['totals']['statuses']
    status_tally = 0.0
    positive_tally = 0.0
    status_total = 0.0
    positive_total = 0.0
    last_session = sessions.map(&:started_at).max
    sessions.each do |session|
      diff = last_session - session.started_at
      mult = 1.0
      if diff < 1.week
        mult = 5.0
      elsif diff < 2.weeks
        mult = 3.0
      elsif diff < 1.month
        mult = 2.0
      elsif diff < 3.months
        mult = 1.5
      end
      if session.data['goal']['status']
        status_total += mult
        status_tally += session.data['goal']['status'] * mult
      end
      if session.data['goal']['positives']
        positive_total += (session.data['goal']['positives'] + session.data['goal']['negatives']) * mult
        positive_tally += session.data['goal']['positives'] * mult
      end
    end
    stats['average_status'] = all_statuses.length > 0 ? all_statuses.sum.to_f / all_statuses.length.to_f : 0
    total_tallies = stats['monthly']['totals']['positives'].to_f + stats['monthly']['totals']['negatives'].to_f
    stats['percent_positive'] = total_tallies > 0 ? (stats['monthly']['totals']['positives'].to_f / total_tallies * 100.0) : 0
    stats['weighted_percent_positive'] = positive_total > 0 ? (positive_tally.to_f / positive_total.to_f * 100.0) : 0
    stats['weighted_average_status'] = status_total > 0 ? (status_tally.to_f / status_total.to_f) : 0
    stats['sessions'] = sessions.length
    stats['suggested_level'] = suggested_level
    self.settings ||= {}
    self.settings['stats'] = stats
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
      self.settings['comments'] ||= []
      self.settings['last_comment_id'] ||= 0
      video = UserVideo.find_by_global_id(params['comment']['video_id']) if params['comment']['video_id']
      comment = {
        'id' => self.settings['last_comment_id'],
        'user_id' => non_user_params[:author].global_id,
        'user_name' => non_user_params[:author].user_name,
        'created' => Time.now.iso8601,
        'text' => params['comment']['text']
      }
      self.settings['last_comment_id'] += 1
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
    prior_goal = self.settings['prior_goal_id'] && UserGoal.find_by_global_id(self.settings['prior_goal_id'])
    self.settings['author_id'] = prior_goal && prior_goal.settings['author_id']
    self.settings['author_id'] ||= user.global_id
    self.settings['video'] = template.settings['video']
    self.settings['summary'] = nil if self.settings['summary'] == 'user goal'
    self.settings['summary'] ||= template.settings['summary']
    self.settings['description'] ||= template.settings['description']
    self.active = true
    @set_as_primary = true if set_as_primary
  end
  
  def next_template
    return nil unless self.settings && self.settings['next_template_id']
    res = UserGoal.find_by_global_id(self.settings['next_template_id'])
    res = nil unless res.template
    res
  end
  
  def self.add_log_session(log_id)
    session = LogSession.find_by_global_id(log_id)
    goal = session.goal
    if goal && goal.user_id == session.user_id
      goal.generate_stats
      goal.save
    end
  end
  
  def advance!
    return true unless self.active && self.advance_at && self.advance_at < Time.now && self.settings && self.settings['template_id']
    template = UserGoal.find_by_global_id(self.settings['template_id'])
    return false unless template && template.template
    next_template = template.next_template
    if !next_template || !self.user
      # TODO: notification that goal has ended with no follow-up
    else
      new_goal = UserGoal.new(:settings => {'prior_goal_id' => self.global_id})
      new_goal.build_from_template(next_template, self.user, self.primary?)
      new_goal.save
      self.settings['next_goal_id'] = new_goal.global_id
    end
    
    self.active = false
    self.save
  end
  
  def self.advance_goals
    UserGoal.where(['advance_at < ?', Time.now]).each do |goal|
      goal.schedule(:advance!)
    end
  end
end
