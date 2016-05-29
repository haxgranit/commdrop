class LogSession < ActiveRecord::Base
  include Async
  include Processable
  include GlobalId
  include SecureSerialize
  include Notifier
  belongs_to :user
  belongs_to :author, :class_name => User
  belongs_to :ip_cluster, :class_name => ClusterLocation
  belongs_to :geo_cluster, :class_name => ClusterLocation
  belongs_to :device
  belongs_to :goal, :class_name => UserGoal
  before_save :generate_defaults
  before_save :generate_stats
  after_save :split_out_later_sessions
  after_save :schedule_clustering
  after_save :schedule_summary
  after_save :push_notification
  after_save :update_board_connections
  replicated_model  

  has_paper_trail :only => [:data, :user_id, :author_id, :device_id]
  secure_serialize :data

  def generate_defaults
    self.data ||= {}
    self.data['events'] ||= []
    # if two events share the same timestamp, put the buttons before the actions
    self.data['events'].sort_by!{|e| [e['timestamp'] || 0, (e['type'] == 'button' ? 0 : 1)] }
    last = self.data['events'].last
    first = self.data['events'].first
    self.ended_at = last ? DateTime.strptime(last['timestamp'].to_s, '%s') : nil
    self.started_at = first ? DateTime.strptime(first['timestamp'].to_s, '%s') : nil
    if self.ended_at && self.started_at == self.ended_at && self.data['events']
      self.ended_at += 5
    end
    self.data['event_count'] = self.data['events'].length
    
    attrs = ClusterLocation.calculate_attributes(self)
    self.data['geo'] = attrs['geo']
    self.data['ip_address'] = attrs['ip_address']
    self.data['readable_ip_address'] = attrs['readable_ip_address']
    
    self.data['duration'] = last && last['timestamp'] && first && first['timestamp'] && (last['timestamp'] - first['timestamp'])
    utterances = self.data['events'].select{|e| e['type'] == 'utterance' }
    buttons = self.data['events'].select{|e| e['type'] == 'button' }
    self.data['button_count'] = buttons.length
    self.data['utterance_count'] = utterances.length
    self.data['utterance_word_count'] = utterances.map{|u| u['utterance']['text'].split(/\s+/).length }.sum
    
    last_stamp = nil
    max_diff = (60.0 * 10.0)
    max_dots = 5
    str = ""
    hit_locations = {}
    event_notes = 0
    ids = (self.data['events'] || []).map{|e| e['id'] }.compact
    spelling_sequence = []
    (self.data['events'] || []).each_with_index do |event, idx|
      next_event = self.data['events'][idx + 1]
      if event['button'] && next_event && next_event['button'] && (next_event['button']['vocalization'] || "").match(/^:/)
        event['modified_by_next'] = true
      end
      # if it's part of a spelling, add the letter(s) to the spelling sequence
      if event['button'] && (event['button']['vocalization'] || "").match(/^\+/)
        spelling_next = !!(next_event && next_event['button'] && (next_event['button']['vocalization'] || "").match(/^\+/))
        event['modified_by_next'] ||= spelling_next
        spelling_sequence << event['button']['vocalization'][1..-1]
      # if it's a modifier, mark the spelling sequence as tainted (it'll be handled by the completion, anyway)
      elsif event['button'] && (event['button']['vocalization'] || "").match(/^:/)
        spelling_sequence << ":"
      end
      
      # if this is the end of the spelling sequence, go ahead and try to process it
      if spelling_sequence.length > 0 && !event['modified_by_next']
        # if it's not tainted, combine it
        if !spelling_sequence.any?{|s| s == ":" }
          spelling = spelling_sequence.join("").strip
          event['spelling'] = spelling unless spelling.match(/:/)
        end
        spelling_sequence = []
      end
      if event['button'] && event['button']['percent_x'] && event['button']['percent_y'] && event['button']['board'] && event['button']['board']['id']
        x = event['button']['percent_x'].round(2)
        y = event['button']['percent_y'].round(2)
        board_id = event['button']['board']['id']
        hit_locations[board_id] ||= {}
        hit_locations[board_id][x] ||= {}
        hit_locations[board_id][x][y] ||= 0
        hit_locations[board_id][x][y] += 1
      end
      if event['button'] && event['button']['label'] && (!event['parts_of_speech'] || event['parts_of_speech']['types'] == ['other'])
        if event['button']['part_of_speech']
          speech = {'types' => [event['button']['part_of_speech']]}
        end
        word = event['spelling'] || event['button']['completion'] || event['button']['vocalization'] || event['button']['label']
        speech ||= WordData.find_word(word)
        if !speech && !event['modified_by_next'] && (event['spelling'] || event['completion'] || !(event['button']['vocalization'] || "").match(/^[\+:]/))
          speech = {'types' => ['other']}
          if event['button'] && event['button']['type'] == 'speak'
            RedisInit.default.hincrby('missing_words', word.to_s, 1) if RedisInit.default
          end
        end
        event['parts_of_speech'] = speech
      end
      event_notes += (event['notes'] || []).length
      
      event['id'] ||= (ids.max || 0) + 1
      ids << event['id']
      
      next if event['action'] && event['action']['action'] == 'auto_home'
      stamp = event['timestamp']
      event_string = event['button'] && event['button']['label']
      event_string = "[#{event['action']['action']}]" if event['action']
      event_string = event['button']['completion'] if event && event['button'] && event['button']['completion']
      event_string = "[vocalize]" if event['utterance']
      event_string ||= "event"
      if !last_stamp
        str += event_string
      else
        stamp ||= last_stamp + max_diff
        diff = [0.0, [stamp - last_stamp, max_diff].min].max
        dots = "."
        dots += "." if diff >= max_diff
        dots += "." if diff > (60.0 * 5.0)
        dots += "." if diff > (60.0 * 1.0)
        dots += "." if diff > 10
        str += dots + event_string
      end
      last_stamp = stamp
    end
    self.data['event_note_count'] = event_notes
    self.has_notes = event_notes > 0
    self.data['touch_locations'] = hit_locations
    self.log_type = 'session'
    if self.data['note']
      self.log_type = 'note'
      if self.data['note']['timestamp']
        time = DateTime.strptime(self.data['note']['timestamp'].to_s, '%s')
        self.started_at = time
        self.ended_at = time
      end
      self.started_at ||= Time.now
      self.ended_at ||= self.started_at
      str = "Note by #{self.author.user_name}: "
      if self.data['note']['video'] 
        duration = self.data['note']['video']['duration'].to_i
        time = "#{duration}s"
        if duration > 60
          time = "#{(duration / 60).to_i}m"
        end 
        str += "recording (#{time})"
        str += " - #{self.data['note']['text']}" if !self.data['note']['text'].blank?
      else
        str += self.data['note']['text'] || ""
      end
    elsif self.data['assessment']
      self.log_type = 'assessment'
      str = "Assessment by #{self.author.user_name}: "
      str += self.data['assessment']['description'] || "Quick assessment"

      self.data['assessment']['totals'] ||= {}
      self.data['assessment']['tallies'] ||= []
      self.data['assessment']['totals']['correct'] ||= 0
      self.data['assessment']['totals']['incorrect'] ||= 0
      correct = self.data['assessment']['totals']['correct']
      incorrect = self.data['assessment']['totals']['incorrect']
      post_str = "(#{correct} correct, #{incorrect} incorrect"
      total = self.data['assessment']['totals']['correct'] + self.data['assessment']['totals']['incorrect']
      if total > 0
        pct = (self.data['assessment']['totals']['correct'].to_f / total.to_f * 100).round(1)
        post_str += ", #{pct}%"
      end
      post_str += ")"
      self.data['assessment']['summary'] = post_str
      str += " " + post_str

      self.started_at = DateTime.strptime(self.data['assessment']['start_timestamp'].to_s, '%s') if self.data['assessment']['start_timestamp']
      self.ended_at = DateTime.strptime(self.data['assessment']['end_timestamp'].to_s, '%s') if self.data['assessment']['end_timestamp']
      last_tally = self.data['assessment']['tallies'].last
      first_tally = self.data['assessment']['tallies'].first
      self.started_at ||= DateTime.strptime(first_tally['timestamp'].to_s, '%s') if first_tally
      self.ended_at ||= DateTime.strptime(last_tally['timestamp'].to_s, '%s') if last_tally
      self.started_at ||= Time.now
      self.ended_at ||= self.started_at
    end
    if self.data['goal']
      if self.data['assessment']
        self.data['goal']['positives'] = self.data['assessment']['totals']['correct']
        self.data['goal']['negatives'] = self.data['assessment']['totals']['incorrect']
      elsif self.data['goal']['status']
        self.data['goal']['positives'] = self.data['goal']['status'] > 1 ? 1 : 0
        self.data['goal']['negatives'] = self.data['goal']['status'] <= 1 ? 1 : 0
      end
    end
    self.data['event_summary'] = str
    self.data['nonce'] ||= Security.nonce('log_nonce')
    
    if (!self.geo_cluster_id || !self.ip_cluster_id) && (!self.last_cluster_attempt_at || self.last_cluster_attempt_at < 12.hours.ago)
      self.last_cluster_attempt_at = Time.now
      @clustering_scheduled = true
    end
    
    self.processed ||= false
    return false unless self.user_id && self.author_id && self.device_id
    true
  end
  
  def require_nonce
    if !self.data['nonce']
      self.data['nonce'] = Security.nonce('log_nonce')
      self.save
    end
    self.data['nonce']
  end
  
  def generate_stats
    self.data['stats'] ||= {}
    self.data['stats']['session_seconds'] = 0
    self.data['stats']['utterances'] = 0.0
    self.data['stats']['utterance_words'] = 0.0
    self.data['stats']['utterance_buttons'] = 0.0
    self.data['stats']['all_buttons'] = []
    self.data['stats']['all_words'] = []
    self.data['stats']['all_boards'] = []
    self.data['stats']['all_button_counts'] = {}
    self.data['stats']['all_word_counts'] = {}
    self.data['stats']['all_board_counts'] = {}
    self.data['stats']['parts_of_speech'] = {}
    if self.data['events'] && self.started_at && self.ended_at
      self.data['stats']['session_seconds'] = (self.ended_at - self.started_at).to_i
      self.data['events'].each do |event|
        if event['type'] == 'utterance'
          self.data['stats']['utterances'] += 1
          self.data['stats']['utterance_words'] += event['utterance']['text'].split(/\s+/).length
          self.data['stats']['utterance_buttons'] += (event['utterance']['buttons'] || []).length
        elsif event['type'] == 'button'
          if event['button'] && event['button']['board']
            button = {
              'button_id' => event['button']['button_id'],
              'board_id' => event['button']['board']['id'],
              'text' => (event['completion'] || event['spelling'] || event['button']['vocalization'] || event['button']['label']),
              'count' => 0
            }
            if button['button_id'] && button['board_id']
              ref = "#{button['button_id']}::#{button['board_id']}"
              self.data['stats']['all_button_counts'][ref] ||= button
              self.data['stats']['all_button_counts'][ref]['count'] += 1
              if button['text'] && button['text'].length > 0 && event['button']['spoken']
                button['text'].split(/\s+/).each do |word|
                  self.data['stats']['all_word_counts'][word] ||= 0
                  self.data['stats']['all_word_counts'][word] += 1
                end
              end
              
              board = event['button']['board'].merge({'count' => 0})
              self.data['stats']['all_board_counts'][button['board_id']] ||= board
              self.data['stats']['all_board_counts'][button['board_id']]['count'] ||= 0
              self.data['stats']['all_board_counts'][button['board_id']]['count'] += 1
            end
          end
        end
        if event['parts_of_speech'] && event['parts_of_speech']['types'] && event['button'] && event['button']['spoken']
          part = event['parts_of_speech']['types'][0]
          if part
            self.data['stats']['parts_of_speech'][part] ||= 0
            self.data['stats']['parts_of_speech'][part] += 1
          end
        end
      end
    end
    if self.data['assessment'] && self.started_at && self.ended_at
      self.data['stats'] = {}
      self.data['stats']['session_seconds'] = (self.ended_at - self.started_at).to_i
      self.data['stats']['total_correct'] = self.data['assessment']['totals']['correct']
      self.data['stats']['total_incorrect'] = self.data['assessment']['totals']['incorrect']
      self.data['stats']['recorded_correct'] = self.data['assessment']['tallies'].select{|t| t['correct'] == true }.length
      self.data['stats']['recorded_incorrect'] = self.data['assessment']['tallies'].select{|t| t['correct'] == false }.length
      total = self.data['stats']['total_correct'] + self.data['stats']['total_incorrect']
      recorded_total = self.data['stats']['recorded_correct'] + self.data['stats']['recorded_incorrect']
      
      pct_correct = total > 0 ? self.data['stats']['total_correct'].to_f / total.to_f : 0.0
      pct_incorrect = total > 0 ? self.data['stats']['total_incorrect'].to_f / total.to_f : 0.0
      self.data['stats']['total_tallies'] = total
      self.data['stats']['total_recorded_tallies'] = recorded_total
      self.data['stats']['percent_correct'] = (pct_correct * 100).round(1)
      self.data['stats']['percent_incorrect'] = (pct_incorrect * 100).round(1)
      
      biggest_correct_streak = 0
      biggest_incorrect_streak = 0
      self.data['assessment']['tallies'].chunk{|t| t['correct'] }.each do |correct, list|
        if correct
          biggest_correct_streak = [biggest_correct_streak, list.length].max
        else
          biggest_incorrect_streak = [biggest_incorrect_streak, list.length].max
        end
      end
      self.data['stats']['longest_correct_streak'] = biggest_correct_streak
      self.data['stats']['longest_incorrect_streak'] = biggest_incorrect_streak
    end
    true
  end
  
  def schedule_clustering
    if @clustering_scheduled
      ClusterLocation.schedule(:add_to_cluster, self.global_id)
      @clustering_scheduled = false
    end
    if @goal_clustering_scheduled
      UserGoal.schedule(:add_log_session, self.global_id)
      @goal_clustering_scheduled = false
    end
    true
  end
  
  def schedule_summary
    if self.log_type == 'session'
      WeeklyStatsSummary.schedule(:update_for, self.global_id)
    end
    true
  end
  
  def update_board_connections(frd=false)
    if frd
      board_ids = []
      if self.data['events']
        self.data['events'].each do |event|
          if event['type'] == 'button' && event['button'] && event['button']['board']
            board_ids << event['button']['board']['id']
          end
        end
      end
      Board.find_all_by_global_id(board_ids.uniq).each do |board|
        LogSessionBoard.find_or_create_by(:board_id => board.id, :log_session_id => self.id)
      end
    else
      schedule(:update_board_connections, true)
      return true
    end
  end
  
  def geo_object
    @geo ||= ClusterLocation.geo_object(self)
  end
  
  def split_out_later_sessions(frd=false)
    cutoff = (self.user && self.user.log_session_duration) || User.default_log_session_duration
    last_stamp = nil
    sessions = []
    more_sessions = []
    current_user_id = nil
    current_session = []
    self.data ||= {}
    (self.data['events'] || []).each do |event|
      stamp = event['timestamp'] || last_stamp
      # when the user_id changes or there's a long delay, split out into another session
      if event['note'] || event['assessment']
        more_sessions << [event]
      elsif (!stamp || !last_stamp || stamp - last_stamp < cutoff) && (!current_user_id || event['user_id'] == current_user_id)
        current_session << event
      else
        sessions << current_session if current_session.length > 0
        current_session = []
        current_session << event
      end
      current_user_id = event['user_id']
      last_stamp = stamp
    end
    sessions << current_session if current_session.length > 0
    sessions += more_sessions
    if sessions.length > 1
      if !frd
        schedule(:split_out_later_sessions, true)
      else
        self.data['events'] = sessions.shift
        sessions.each do |session|
          user_id = session.map{|e| e['user_id'] }.compact.first || (self.user && self.user.global_id)
          user = User.find_by_global_id(user_id)
          # TODO: right now this silently throws away any unauthorized log attempts. Is this a good idea?
          if user && user.allows?(self.author, 'supervise')
            params = {:events => session}
            event = session[0] if session.length == 1
            if event && event['note']
              params = event['note']
            elsif event && event['assessment']
              params = event['assessment']
            end
            LogSession.process_new(params, {
              :ip_address => self.data['id_address'], 
              :device => self.device,
              :author => self.author,
              :user => user
            })
          end
        end
        self.processed = true
        if self.data['events'].length == 0
          self.destroy
        else
          self.save
        end
      end
    elsif !self.processed
      self.processed = true
      LogSession.where(:id => self.id).update_all(:processed => true)
    end
    true
  end
  
  def self.process_as_follow_on(params, non_user_params)
    raise "user required" if !non_user_params[:user]
    raise "author required" if !non_user_params[:author]
    raise "device required" if !non_user_params[:device]
    # TODO: marrying across devices could be really cool, i.e. teacher is using their phone to
    # track pass/fail while the student uses the device to communicate. WHAAAAT?!
    if params['note']
      params['events'] = nil
      self.process_new(params, non_user_params)
    elsif params['assessment']
      params['events'] = nil
      self.process_new(params, non_user_params)
    else
      res = LogSession.new(:data => {})
      # background-job it, too much processing for in-request!
      user = non_user_params.delete(:user)
      author = non_user_params.delete(:author)
      device = non_user_params.delete(:device)
      non_user_params[:user_id] = user.global_id
      non_user_params[:author_id] = author.global_id
      non_user_params[:device_id] = device.global_id
      schedule(:process_delayed_follow_on, params, non_user_params)
      res
    end
  end
  
  def self.process_delayed_follow_on(params, non_user_params)
    non_user_params = non_user_params.with_indifferent_access
    non_user_params[:user] = User.find_by_global_id(non_user_params[:user_id])
    non_user_params[:author] = User.find_by_global_id(non_user_params[:author_id])
    non_user_params[:device] = Device.find_by_global_id(non_user_params[:device_id])
    raise "user required" if !non_user_params[:user]
    raise "author required" if !non_user_params[:author]
    raise "device required" if !non_user_params[:device]
    
    active_session = LogSession.all.where(['log_type = ? AND device_id = ? AND author_id = ? AND user_id = ? AND ended_at > ?', 'session', non_user_params[:device].id, non_user_params[:author].id, non_user_params[:user].id, 1.hour.ago]).order('ended_at DESC').first
    if params['events']
      if active_session
        active_session.process(params, non_user_params)
        active_session
      else
        self.process_new(params, non_user_params)
      end
    else
      raise "only event-list logs can be delay-processed"
    end
  end
  
  
  def process_params(params, non_user_params)
    raise "user required" if !self.user_id && !non_user_params[:user]
    raise "author required" if !self.author_id && !non_user_params[:author]
    raise "device required" if !self.device_id && !non_user_params[:device]
    user_id = self.user ? self.user.global_id : non_user_params[:user].global_id

    self.device = non_user_params[:device] if non_user_params[:device]
    self.user = non_user_params[:user] if non_user_params[:user]
    self.author = non_user_params[:author] if non_user_params[:author]
    
    # TODO: respect logging settings server-side in addition to client-side
    # TODO: mark ip address as potentially inaccurate when log event is much after last event timestamp (i.e. catching up after offline)
    self.data ||= {}
    if non_user_params[:update_only]
      if params['events']
        self.data_will_change!
        self.data['events'].each do |e|
          pe = params['events'].detect{|ev| ev['id'] == e['id'] && ev['timestamp'].to_f == e['timestamp'] }
          if !e['id']
            pe ||= params['events'].detect{|ev| ev['type'] == e['type'] && ev['timestamp'].to_f == e['timestamp'] }
            e['id'] = pe && pe['id']
          end
          if pe
            new_notes = []
            (e['notes'] || []).each do |note|
              pnote = (pe['notes'] || []).detect{|n| n['id'] === note['id'] }
              deletable = self.user.allows?(non_user_params[:author], 'delete')
              if pnote || !deletable
                new_notes << note
              end
            end
            (pe['notes'] || []).each do |pnote|
              note = (e['notes'] || []).detect{|n| n['id'] === pnote['id'] }
              if !note
                new_notes << pnote
              end
            end
            ids = new_notes.map{|n| n['id'] }.compact
            new_notes.each do |note|
              # TODO: is this denormalization a good idea?
              note['author'] ||= {
                'id' => non_user_params[:author].global_id,
                'user_name' => non_user_params[:author].user_name
              }
              note['timestamp'] ||= Time.now.utc.to_f
              note['id'] ||= (ids.max || 0) + 1
              ids << note['id']
            end
            e['notes'] = new_notes
          end
        end
      end
      if self.goal_id
        @goal_clustering_scheduled = true
      end
    else
      ids = (self.data['events'] || []).map{|e| e['id'] }.max || 0
      ip_address = non_user_params[:ip_address]
      if params['events']
        self.data['events'] ||= []
        params['events'].each do |e|
          e['timestamp'] = e['timestamp'].to_f
          e['ip_address'] = ip_address
          if !e['id']
            ids += 1
            e['id'] = ids
          end
          self.data['events'] << e
        end
      end
      if params['notify'] && params['note']
        @push_message = true
      end
      self.data['note'] = params['note'] if params['note']
      if params['video_id']
        video = UserVideo.find_by_global_id(params['video_id'])
        if video
          self.data['note']['video'] = {
            'id' => params['video_id'],
            'duration' => video.settings['duration']
          }
        end
      end
      if self.user == self.author && params['referenced_user_id']
        ref_user = User.find_by_path(params['referenced_user_id'])
        if ref_user.allows?(self.author, 'supervise')
          self.data['referenced_user_id'] = ref_user.global_id
        end
      end
      if params['goal_id'] || self.goal_id
        log_goal = self.goal || UserGoal.find_by_global_id(params['goal_id'])
        if log_goal.user_id == self.user_id
          @goal_clustering_scheduled = true
          self.goal = log_goal
          self.data['goal'] = {
            'id' => log_goal.global_id,
            'summary' => log_goal.summary
          }
          if params['goal_status'] && params['goal_status'].to_i > 0
            self.data['goal']['status'] = params['goal_status'].to_i
          end
        end
      end
      self.data['assessment'] = params['assessment'] if params['assessment']
    end
    true
  end
  
  # TODO: this assumes clusters and sessions are on the same shard. It means
  # fewer lookups when generating stats summaries, though, which is probably worth it.
  def geo_cluster_global_id
    related_global_id(self.geo_cluster_id)
  end
  
  def ip_cluster_global_id
    related_global_id(self.ip_cluster_id)
  end
  
  def device_global_id
    related_global_id(self.device_id)
  end
  
  def process_raw_log
    # update user_board_connections table to show recency of usage
  end
  
  def push_notification
    if @push_message
      notify('push_message')
      @push_message = false
      @pushed_message = true
    end
    true
  end
  
  def self.push_logs_remotely
    remotes = LogSession.where(:needs_remote_push => true).where(['ended_at < ?', 2.hours.ago])
    remotes.each do |session|
      session.notify('new_session')
    end
  end
  
  def default_listeners(notification_type)
    if notification_type == 'push_message'
      return [] unless self.user
      users = [self.user] + self.user.supervisors - [self.author]
      users.map(&:record_code)
    else
      []
    end
  end
end
