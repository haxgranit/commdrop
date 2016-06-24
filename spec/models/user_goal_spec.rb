require 'spec_helper'

describe UserGoal, type: :model do
  it "should honor permissions" do
    g = UserGoal.new
    expect(g.permissions_for(nil)).to eq({'user_id' => nil})
    u = User.create
    expect(g.permissions_for(u)).to eq({'user_id' => u.global_id})
    g.user = u
    expect(g.permissions_for(u)).to eq({'user_id' => u.global_id, 'view' => true, 'comment' => true, 'edit' => true})
    u2 = User.create
    User.link_supervisor_to_user(u2, u, nil, false)
    expect(g.permissions_for(u2.reload)).to eq({'user_id' => u2.global_id, 'view' => true, 'comment' => true})
    User.link_supervisor_to_user(u2, u, nil, true)
    expect(g.permissions_for(u2.reload)).to eq({'user_id' => u2.global_id, 'view' => true, 'comment' => true, 'edit' => true})
  end
  
  describe "generate_defaults" do
    it "should generate defaults" do
      g = UserGoal.new
      g.generate_defaults
      expect(g.settings['summary']).to eq('user goal')
      expect(g.settings['started_at']).to eq(nil)
      expect(g.settings['ended_at']).to eq(nil)
      g.active = true
      g.generate_defaults
      expect(g.settings['started_at']).to_not eq(nil)
      expect(g.settings['ended_at']).to eq(nil)
      g.active = false
      g.generate_defaults
      expect(g.settings['ended_at']).to_not eq(nil)
    end
  end
 
  describe "generate_stats" do
    it "should generate default stats" do
      g = UserGoal.new
      g.generate_stats
      expect(g.settings['stats']).to eq({
        'average_status' => 0,
        'daily' => {
          'totals' => {
            'sessions' => 0,
            'positives' => 0,
            'negatives' => 0,
            'statuses' => []
          }
        },
        'weekly' => {
          'totals' => {
            'sessions' => 0,
            'positives' => 0,
            'negatives' => 0,
            'statuses' => []
          }
        },
        'monthly' => {
          'totals' => {
            'sessions' => 0,
            'positives' => 0,
            'negatives' => 0,
            'statuses' => []
          }
        },
        'percent_positive' => 0,
        'sessions' => 0,
        'suggested_level' => 'daily',
        'weighted_average_status' => 0,
        'weighted_percent_positive' => 0
      })
    end
    
    it "should generate tallied stats" do
      u = User.create
      d = Device.create(:user => u)
      g = UserGoal.create(:user => u)

      time1 = 16.days.ago
      s = LogSession.process_new({
        'goal_id' => g.global_id,         
        'assessment' => {
          'description' => 'Simple eval',
          'totals' => {
            'correct' => 5,
            'incorrect' => 6
          },
          'tallies' => [
            {'correct' => true, 'timestamp' => time1.to_i}
          ]
        }
      }, {:user => u, :author => u, :device => d})

      time2 = 3.months.ago
      s = LogSession.process_new({
        'goal_id' => g.global_id,         
        'goal_status' => 4,
        'note' => {
          'text' => 'hey friends',
          'timestamp' => time2.to_i
        }
      }, {:user => u, :author => u, :device => d})

      g.reload.generate_stats
      expect(g.settings['stats']).to_not eq(nil)
      expect(g.settings['stats']['sessions']).to eq(2)
      expect(g.settings['stats']['percent_positive']).to eq(50)
      expect(g.settings['stats']['daily']).to eq({
        'totals' => {
          'sessions' => 0,
          'positives' => 0,
          'negatives' => 0,
          'statuses' => []
        }
      })
      expect(g.settings['stats']['monthly'][time1.utc.iso8601[0, 7]]).to eq({
        'sessions' => 1,
        'positives' => 5,
        'negatives' => 6,
        'statuses' => []
      })
      expect(g.settings['stats']['monthly'][time2.utc.iso8601[0, 7]]).to eq({
        'sessions' => 1,
        'positives' => 1,
        'negatives' => 0,
        'statuses' => [4]
      })
      expect(g.settings['stats']['weekly']["#{time1.utc.to_date.cwyear}-#{time1.utc.to_date.cweek}"]).to eq({
        'sessions' => 1,
        'positives' => 5,
        'negatives' => 6,
        'statuses' => []
      })
      expect(g.settings['stats']['weekly']["#{time2.utc.to_date.cwyear}-#{time2.utc.to_date.cweek}"]).to eq(nil)
      expect(g.settings['stats']['weighted_average_status']).to eq(4)
      expect(g.settings['stats']['weighted_percent_positive']).to eq(46.902654867256636)
    end
  end
  
  describe "remove_if_primary" do
    it "should remove as primary goal if set" do
      u = User.create
      g = UserGoal.create(:user => u)
      u.settings['primary_goal'] = {'id' => g.global_id}
      u.save
      g.reload
      g.destroy
      u.reload
      expect(u.settings['primary_goal']).to eq(nil)
    end
  end
  
  describe "set_as_primary" do
    it "should set as primary if specified" do
      u = User.create
      gg = UserGoal.create(:user => u, :primary => true)
      g = UserGoal.process_new({
        primary: true
      }, {user: u, author: u})
      expect(g.primary).to eq(false)
      expect(u.settings['primary_goal']).to eq({'id' => g.global_id, 'summary' => 'user goal'})
      expect(g.reload.primary).to eq(true)
      expect(gg.reload.primary).to eq(false)
    end
  end
  
  describe "process_params" do
    it "should raise an error without a user" do
      expect{ UserGoal.process_new({}, {}) }.to raise_error("user required as goal target")
    end
    
    it "should raise an error without an author" do
      g = UserGoal.new(:user_id => 7)
      expect{ g.process({}, {}) }.to raise_error("user required as update author")
    end
    
    it "should set standard properties" do
      u = User.create
      g = UserGoal.process_new({
        active: true,
        summary: "something good",
        description: "a something that is good"
      }, {user: u, author: u})
      expect(g.active).to eq(true)
      expect(g.summary).to eq("something good")
      expect(g.settings['description']).to eq("a something that is good")
    end
    
    it "should check and set video" do
      u = User.create
      v = UserVideo.create(:user => u)
      g = UserGoal.process_new({
        video_id: v.global_id
      }, {user: u, author: u})
      expect(g.settings['video']['id']).to eq(v.global_id)
      expect(g.summary).to eq('user goal')
      
      g = UserGoal.process_new({
        video_id: '1234'
      }, {user: u, author: u})
      expect(g.settings['video']).to eq(nil)
      expect(g.summary).to eq('user goal')
    end
    
    it "should build from template if specified" do
      u = User.create
      template = UserGoal.create(:template => true)
      g = UserGoal.new
      expect(g).to receive(:build_from_template).with(template, u)
      g.process({
        template_id: template.global_id
      }, {user: u, author: u})
    end
    
    it "should add a comment if specified" do
      u = User.create
      g = UserGoal.process_new({
        comment: {
          text: "hello everyone"
        }
      }, {user: u, author: u})
      expect(g.settings['comments'].length).to eq(1)
      expect(g.settings['comments'][0]['text']).to eq('hello everyone')
      expect(g.settings['comments'][0]['user_name']).to eq(u.user_name)
    end
    
    it "should add a video comment if valid" do
      u = User.create
      u2 = User.create
      v = UserVideo.create(:user => u)
      g = UserGoal.process_new({
        comment: {
          text: "this is a video",
          video_id: v.global_id
        }
      }, {user: u, author: u2})
      expect(g.settings['comments'].length).to eq(1)
      expect(g.settings['comments'][0]['text']).to eq('this is a video')
      expect(g.settings['comments'][0]['user_name']).to eq(u2.user_name)
      expect(g.settings['comments'][0]['video']['id']).to eq(v.global_id)
    end
    
    it "should not add a video to a comment if not valid" do
      u = User.create
      g = UserGoal.process_new({
        comment: {
          text: "this is a video",
          video_id: '12345'
        }
      }, {user: u, author: u})
      expect(g.settings['comments'].length).to eq(1)
      expect(g.settings['comments'][0]['text']).to eq('this is a video')
      expect(g.settings['comments'][0]['user_name']).to eq(u.user_name)
      expect(g.settings['comments'][0]['video']).to eq(nil)
    end
    
    it "should mark to set as primary if specified" do
      u = User.create
      g = UserGoal.process_new({
        primary: true
      }, {user: u, author: u})
      expect(g.instance_variable_get('@set_as_primary')).to eq(true)
    end
  end
  
  describe "calculate_advancement" do
    it "should return nil unless there is a next template" do
      g = UserGoal.new(:settings => {
      })
      expect(g.calculate_advancement).to eq(nil)
      g.settings['next_template_id'] = '1234'
      expect(g.calculate_advancement).to eq(nil)
    end
    
    it "should return time-from-now if goal_duration is set" do
      g = UserGoal.new(:settings => {
        'next_template_id' => '123',
        'goal_duration' => 3.weeks
      })
      expect(g.calculate_advancement.to_i).to eq((Time.now + 3.weeks).to_i)
    end
    
    it "should return concrete time if goal_advances_at is set" do
      g = UserGoal.new(:settings => {
        'next_template_id' => '123',
        'goal_advances_at' => Time.parse('Jan 1, 2015').iso8601
      })
      expect(g.calculate_advancement.to_i).to eq(1420095600)
    end
  end
  
  describe "build_from_template" do
    it "should copy template settings as needed" do
      template = UserGoal.create(:settings => {
        'video' => {
          'id' => '1_123'
        },
        'author_id' => '9876',
        'summary' => 'hey ya',
        'description' => 'this is a really important thing',
        'next_template_id' => '1234',
        'goal_duration' => 3.weeks.to_i
      }, :template => true)
      u = User.create
      g = UserGoal.process_new({
        template_id: template.global_id
      }, {user: u, author: u})
      expect(g.settings['template_id']).to eq(template.global_id)
      expect(g.settings['description']).to eq('this is a really important thing')
      expect(g.summary).to eq('hey ya')
      expect(g.advance_at.to_i).to eq((Time.now + 3.weeks).to_i)
      expect(g.settings['author_id']).to eq(u.global_id)
      expect(g.settings['video']).to eq({'id' => '1_123'})
      expect(g.active).to eq(true)
      expect(g.user).to eq(u)
    end
    
    it "should use the prior goal's author_id if there is one" do
      template = UserGoal.create(:settings => {
        'video' => {
          'id' => '1_123'
        },
        'author_id' => '9876',
        'summary' => 'hey ya',
        'description' => 'this is a really important thing',
        'next_template_id' => '1234',
        'goal_duration' => 3.weeks.to_i
      }, :template => true)
      u = User.create
      prior = UserGoal.create(:settings => {'author_id' => '12345'})
      g = UserGoal.new(:settings => {'prior_goal_id' => prior.global_id})
      g.process({
        template_id: template.global_id
      }, {user: u, author: u})
      expect(g.settings['template_id']).to eq(template.global_id)
      expect(g.settings['description']).to eq('this is a really important thing')
      expect(g.summary).to eq('hey ya')
      expect(g.advance_at.to_i).to eq((Time.now + 3.weeks).to_i)
      expect(g.settings['author_id']).to eq('12345')
      expect(g.settings['video']).to eq({'id' => '1_123'})
      expect(g.active).to eq(true)
      expect(g.user).to eq(u)
    end
  end
  
  describe "add_log_session" do
    it "should call generate_stats on the goal" do
      u = User.create
      g = UserGoal.create(:user => u)
      ls = LogSession.create(:user => u, :goal => g)
      expect(g).to receive(:generate_stats).at_least(1).times
      expect(LogSession).to receive(:find_by_global_id).with(ls.global_id).and_return(ls)
      UserGoal.add_log_session(ls.global_id)
    end
  end
  
  describe "next_template" do
    it "should return nil if no template set" do
      g = UserGoal.new
      expect(g.next_template).to eq(nil)
    end
    
    it "should return nil if next id not a template" do
      g = UserGoal.create
      g2 = UserGoal.create(:settings => {'next_template_id' => g.global_id})
      expect(g2.next_template).to eq(nil)
    end
    
    it "should return the next goal if valid" do
      g = UserGoal.create(:template => true)
      g2 = UserGoal.create(:settings => {'next_template_id' => g.global_id})
      expect(g2.next_template).to eq(g)
    end
  end

  describe "advance_goals" do 
    it "should ignore unadvancing goals" do
      g = UserGoal.create
      Worker.process_queues
      UserGoal.advance_goals
      expect(Worker.scheduled_actions).to eq([])
    end
    
    it "should schedule only advancing goals" do
      g = UserGoal.create(:advance_at => 2.weeks.ago)
      g2 = UserGoal.create(:advance_at => 1.hour.from_now)
      Worker.process_queues
      UserGoal.advance_goals
      expect(Worker.scheduled_actions).to eq([{
        'class' => 'Worker',
        'args' => ['UserGoal', 'perform_action', {'id' => g.id, 'method' => 'advance!', 'arguments' => []}]
      }])
    end
    
    it "should advance to the next goal in a sequence" do
      t2 = UserGoal.create(:template => true, :settings => {
        'author_id' => '8765',
        'summary' => 'step 2',
        'description' => 'do stuff',
        'video' => {
          'id' => '1212'
        },
        'goal_duration' => 3.weeks.to_i
      })
      t1 = UserGoal.create(:template => true, :settings => {
        'next_template_id' => t2.global_id,
        'author_id' => '9876',
        'summary' => 'step 1',
        'goal_duration' => 2.weeks.to_i
      })
      u = User.create
      g1 = UserGoal.process_new({
        template_id: t1.global_id
      }, {user: u, author: u})
      expect(g1.settings['author_id']).to eq(u.global_id)
      expect(g1.settings['template_id']).to eq(t1.global_id)
      expect(g1.advance_at.to_i).to eq((Time.now + 2.weeks).to_i)
      expect(g1.active).to eq(true)
      g1.advance_at = 2.hours.ago
      
      res = g1.advance!
      expect(res).to eq(true)
      expect(g1.active).to eq(false)
      expect(g1.settings['next_goal_id']).to_not eq(nil)
      g2 = UserGoal.find_by_global_id(g1.settings['next_goal_id'])
      expect(g2).to_not eq(nil)
      expect(g2.settings['template_id']).to eq(t2.global_id)
      expect(g2.settings['summary']).to eq('step 2')
      expect(g2.settings['description']).to eq('do stuff')
      expect(g2.settings['video']).to eq({'id' => '1212'})
      expect(g2.settings['prior_goal_id']).to eq(g1.global_id)
    end
    
    it "should retire the goal even if there is no next goal in the sequence" do
      t2 = UserGoal.create(:template => true, :settings => {
        'author_id' => '8765',
        'summary' => 'step 2',
        'description' => 'do stuff',
        'video' => {
          'id' => '1212'
        },
        'goal_duration' => 3.weeks.to_i
      })
      t1 = UserGoal.create(:template => true, :settings => {
        'next_template_id' => t2.global_id,
        'author_id' => '9876',
        'summary' => 'step 1',
        'goal_duration' => 2.weeks.to_i
      })
      u = User.create
      g1 = UserGoal.process_new({
        template_id: t1.global_id
      }, {user: u, author: u})
      expect(g1.settings['author_id']).to eq(u.global_id)
      expect(g1.settings['template_id']).to eq(t1.global_id)
      expect(g1.advance_at.to_i).to eq((Time.now + 2.weeks).to_i)
      expect(g1.active).to eq(true)
      g1.advance_at = 2.hours.ago
      
      res = g1.advance!
      expect(res).to eq(true)
      expect(g1.active).to eq(false)
      expect(g1.settings['next_goal_id']).to_not eq(nil)
      g2 = UserGoal.find_by_global_id(g1.settings['next_goal_id'])
      expect(g2).to_not eq(nil)
      expect(g2.settings['template_id']).to eq(t2.global_id)
      expect(g2.settings['summary']).to eq('step 2')
      expect(g2.settings['description']).to eq('do stuff')
      expect(g2.settings['video']).to eq({'id' => '1212'})
      expect(g2.settings['prior_goal_id']).to eq(g1.global_id)
      expect(g2.advance_at.to_i).to eq((Time.now + 3.weeks).to_i)
      g2.advance_at = 2.hours.ago
      
      res = g2.advance!
      expect(res).to eq(true)
      expect(g2.active).to eq(false)
      expect(g2.settings['next_goal_id']).to eq(nil)
    end
    
    it "should notify of goal advancement"
    
    it "should notify if no goal to advance to"
  end
  
  describe "update_usage" do
    it "should only update if primary" do
      u = User.create
      g = UserGoal.create(:user => u)
      u.settings['primary_goal'] = {'id' => g.global_id}
      u.save
      now = Time.now.iso8601
      g.update_usage(now)
      expect(u.reload.settings['primary_goal']['last_tracked']).to eq(nil)
      
      g.primary = true
      g.save
      g.update_usage(now)
      expect(u.reload.settings['primary_goal']['last_tracked']).to eq(now)
    end
    
    it "should not update last_tracked if not more recent than the current setting" do
      u = User.create
      g = UserGoal.create(:user => u, :primary => true)
      now = Time.now.iso8601
      u.settings['primary_goal'] = {'id' => g.global_id, 'last_tracked' => now}
      u.save
      two_weeks_ago = 2.weeks.ago.iso8601
      g.update_usage(two_weeks_ago)
      expect(u.reload.settings['primary_goal']['last_tracked']).to eq(now)
    end
  end
end
