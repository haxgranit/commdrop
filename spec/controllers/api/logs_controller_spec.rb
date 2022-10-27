require 'spec_helper'

describe Api::LogsController, :type => :controller do
  describe "index" do
    it "should require api token" do
      get :index
      assert_missing_token
    end
    
    it "should return unauthorized unless edit permissions allowed" do
      u = User.create
      token_user
      get :index, :user_id => u.global_id
      assert_unauthorized
    end
    
    it "should return a list of logs" do
      token_user
      LogSession.process_new({
        :events => [
          {'timestamp' => 4.seconds.ago.to_i, 'type' => 'button', 'button' => {'label' => 'ok', 'board' => {'id' => '1_1'}}},
          {'timestamp' => 3.seconds.ago.to_i, 'type' => 'button', 'button' => {'label' => 'never mind', 'board' => {'id' => '1_1'}}}
        ]
      }, {:user => @user, :device => @device, :author => @user})
      get :index, :user_id => @user.global_id
      json = JSON.parse(response.body)
      expect(json['log'].length).to eq(1)
    end
    
    it "should paginate long results" do
      token_user
      (JsonApi::Log::DEFAULT_PAGE + 1).times do |i|
        LogSession.process_new({
          :events => [
            {'timestamp' => i.days.ago.to_i, 'type' => 'button', 'button' => {'label' => 'ok', 'board' => {'id' => '1_1'}}},
            {'timestamp' => (i.days.ago + 10).to_i, 'type' => 'button', 'button' => {'label' => 'never mind', 'board' => {'id' => '1_1'}}}
          ]
        }, {:user => @user, :device => @device, :author => @user})
      end
      get :index, :user_id => @user.global_id
      json = JSON.parse(response.body)
      expect(json['log'].length).to eq(JsonApi::Log::DEFAULT_PAGE)
      expect(json['meta']['next_url']).not_to eq(nil)
    end
    
    it "should return supervisee sessions when requested" do
      users = [User.create, User.create, User.create]
      token_user
      users.each_with_index do |u, idx|
        User.link_supervisor_to_user(@user, u) unless idx == 2
        d = Device.create(:user => u)
        3.times do |i|
          LogSession.process_new({
            :events => [
              {'timestamp' => (i.days.ago + i).to_i, 'type' => 'button', 'button' => {'label' => 'ok', 'board' => {'id' => '1_1'}}},
              {'timestamp' => (i.days.ago + 100).to_i, 'type' => 'button', 'button' => {'label' => 'never mind', 'board' => {'id' => '1_1'}}}
            ]
          }, {:user => u, :device => d, :author => u})
        end
      end
      Worker.process_queues
      expect(@user.reload.supervisees.length).to eq(2)
      get :index, :user_id => @user.global_id, :supervisees => true
      json = JSON.parse(response.body)
      expect(json['log'].length).to eq(6)
      expect(json['log'][0]['author']['id']).to eq(users[0].global_id)
      expect(json['log'][1]['author']['id']).to eq(users[1].global_id)
      expect(json['log'][2]['author']['id']).to eq(users[0].global_id)
      expect(json['meta']['next_url']).to eq(nil)
    end
    
    it "should filter by query parameters" do
      token_user
      geo = ClusterLocation.create(:user => @user, :cluster_type => 'geo')
      ip = ClusterLocation.create(:user => @user, :cluster_type => 'ip_address')
      l1 = LogSession.process_new({
        :events => [
          {'timestamp' => 3.weeks.ago.to_i, 'type' => 'button', 'button' => {'label' => 'ok', 'board' => {'id' => '1_1'}}}
        ]
      }, {:user => @user, :device => @device, :author => @user})
      l1.geo_cluster_id = geo.id
      l1.ip_cluster_id = ip.id
      l1.save
      l2 = LogSession.process_new({
        :events => [
          {'timestamp' => 1.week.ago.to_i, 'type' => 'button', 'button' => {'label' => 'ok', 'board' => {'id' => '1_1'}}}
        ]
      }, {:user => @user, :device => @device, :author => @user})
      l2.geo_cluster_id = geo.id
      l2.save
      l3 = LogSession.process_new({
        :events => [
          {'timestamp' => 1.day.ago.to_i, 'type' => 'button', 'button' => {'label' => 'ok', 'board' => {'id' => '1_1'}}}
        ]
      }, {:user => @user, :device => @device, :author => @user})
      l3.ip_cluster_id = ip.id
      l3.save 

      get :index, :user_id => @user.global_id, :start => 2.weeks.ago.to_s, :end => 1.day.from_now.to_s, :device_id => @device.global_id
      json = JSON.parse(response.body)
      expect(json['log'].length).to eq(2)
      expect(json['log'].map{|l| l['id'] }).to eq([l3.global_id, l2.global_id])
      
      get :index, :user_id => @user.global_id, :device_id => "abc"
      json = JSON.parse(response.body)
      expect(json['log'].length).to eq(0)

      get :index, :user_id => @user.global_id, :end => 3.days.ago.to_s
      json = JSON.parse(response.body)
      expect(json['log'].length).to eq(2)
      expect(json['log'].map{|l| l['id'] }).to eq([l2.global_id, l1.global_id])

      get :index, :user_id => @user.global_id, :location_id => geo.global_id
      json = JSON.parse(response.body)
      expect(json['log'].length).to eq(2)
      expect(json['log'].map{|l| l['id'] }).to eq([l2.global_id, l1.global_id])

      get :index, :user_id => @user.global_id, :location_id => ip.global_id
      json = JSON.parse(response.body)
      expect(json['log'].length).to eq(2)
      expect(json['log'].map{|l| l['id'] }).to eq([l3.global_id, l1.global_id])
    end
    
    it "should include query parameters in api next_url" do
      token_user
      (JsonApi::Log::DEFAULT_PAGE + 1).times do |i|
        LogSession.process_new({
          :events => [
            {'timestamp' => i.days.ago.to_i, 'type' => 'button', 'button' => {'label' => 'ok', 'board' => {'id' => '1_1'}}},
            {'timestamp' => (i.days.ago + 10).to_i, 'type' => 'button', 'button' => {'label' => 'never mind', 'board' => {'id' => '1_1'}}}
          ]
        }, {:user => @user, :device => @device, :author => @user})
      end
      get :index, :user_id => @user.global_id, :start => 2.weeks.ago.to_s
      json = JSON.parse(response.body)
      expect(json['log'].length).to eq(JsonApi::Log::DEFAULT_PAGE)
      expect(json['meta']['next_url']).to match(/user_id=/)
      expect(json['meta']['next_url']).to match(/start=/)
      expect(json['meta']['next_url']).not_to match(/end=/)
      expect(json['meta']['next_url']).not_to match(/device_id=/)
      expect(json['meta']['next_url']).not_to match(/location_id=/)
    end
    
#     user = User.find_by_path(params['user_id'])
#     return unless allowed?(user, 'supervise')
#     user_ids = [user.id]
#     user_ids = [] if params['supervisees']
#     if params['supervisees']
#       user_ids += user.supervisees.map(&:id)
#     end
#     user_ids = user_ids.uniq
#     
#     options = {:start => params['start'], :end => params['end']}
#     Stats.sanitize_find_options!(options)
#     logs = LogSession.where({:user_id => user_ids}).where.not({:started_at => nil})
#     params['type'] ||= 'all'
#     if params['type'] != 'all'
#       logs = logs.where(:log_type => params['type'])
#     end
#     if params['goal_id']
#       goal = UserGoal.find_by_global_id(params['goal_id'])
#       if goal && goal.user == user
#         logs = logs.where(:goal_id => goal.id)
#       else
#         logs = logs.where(:id => 0)
#       end
#     end
    it "should filter by goal_id" do
      token_user
      g = UserGoal.create(:user => @user)
      LogSession.process_new({
        :goal_id => g.global_id,
        :events => [
          {'timestamp' => 4.seconds.ago.to_i, 'type' => 'button', 'button' => {'label' => 'ok', 'board' => {'id' => '1_1'}}},
          {'timestamp' => 3.seconds.ago.to_i, 'type' => 'button', 'button' => {'label' => 'never mind', 'board' => {'id' => '1_1'}}}
        ]
      }, {:user => @user, :device => @device, :author => @user})
      LogSession.process_new({
        :goal_id => g.global_id,
        :events => [
          {'timestamp' => 8.seconds.ago.to_i, 'type' => 'button', 'button' => {'label' => 'ok', 'board' => {'id' => '1_1'}}},
          {'timestamp' => 7.seconds.ago.to_i, 'type' => 'button', 'button' => {'label' => 'never mind', 'board' => {'id' => '1_1'}}}
        ]
      }, {:user => @user, :device => @device, :author => @user})
      LogSession.process_new({
        :goal_id => g.global_id,
        :events => [
          {'timestamp' => 18.seconds.ago.to_i, 'type' => 'button', 'button' => {'label' => 'ok', 'board' => {'id' => '1_1'}}},
          {'timestamp' => 17.seconds.ago.to_i, 'type' => 'button', 'button' => {'label' => 'never mind', 'board' => {'id' => '1_1'}}}
        ]
      }, {:user => @user, :device => @device, :author => @user})
      get :index, :user_id => @user.global_id, :goal_id => g.global_id
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['log'].length).to eq(3)
    end
    
    it "should return nothing for goal_id that doesn't match user" do
      token_user
      u = User.create
      g = UserGoal.create(:user => u)
      
      LogSession.process_new({
        :goal_id => g.global_id,
        :events => [
          {'timestamp' => 4.seconds.ago.to_i, 'type' => 'button', 'button' => {'label' => 'ok', 'board' => {'id' => '1_1'}}},
          {'timestamp' => 3.seconds.ago.to_i, 'type' => 'button', 'button' => {'label' => 'never mind', 'board' => {'id' => '1_1'}}}
        ]
      }, {:user => u, :device => @device, :author => @user})
      LogSession.process_new({
        :goal_id => g.global_id,
        :events => [
          {'timestamp' => 8.seconds.ago.to_i, 'type' => 'button', 'button' => {'label' => 'ok', 'board' => {'id' => '1_1'}}},
          {'timestamp' => 7.seconds.ago.to_i, 'type' => 'button', 'button' => {'label' => 'never mind', 'board' => {'id' => '1_1'}}}
        ]
      }, {:user => u, :device => @device, :author => @user})
      LogSession.process_new({
        :goal_id => g.global_id,
        :events => [
          {'timestamp' => 18.seconds.ago.to_i, 'type' => 'button', 'button' => {'label' => 'ok', 'board' => {'id' => '1_1'}}},
          {'timestamp' => 17.seconds.ago.to_i, 'type' => 'button', 'button' => {'label' => 'never mind', 'board' => {'id' => '1_1'}}}
        ]
      }, {:user => u, :device => @device, :author => @user})

      get :index, :user_id => @user.global_id, :goal_id => g.global_id
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['log'].length).to eq(0)
    end
  end

  
  describe "create" do
    it "should require api token" do
      post :create, {}
      assert_missing_token
    end
    
    it "should return unauthorized unless edit permissions allowed" do
      u = User.create
      token_user
      post :create, :user_id => u.global_id
      assert_unauthorized
    end
    
    it "should generate a log result and return it" do
      token_user
      post :create, :log => {:events => [{'timestamp' => 5.hours.ago.to_i, 'type' => 'button', 'button' => {'label' => 'cool', 'board' => {'id' => '1_1'}}}]}
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['log']['pending']).to eq(true)
      Worker.process_queues
      log = LogSession.last
      expect(log.data['event_summary']).to eq('cool')
    end

    it "should try to extract and canonicalize the ip address" do
      token_user
      request.env['HTTP_X_FORWARDED_FOR'] = "8.7.6.5"
      post :create, :log => {:events => [{'timestamp' => 5.hours.ago.to_i, 'type' => 'button', 'button' => {'label' => 'cool', 'board' => {'id' => '1_1'}}}]}
      expect(response).to be_success
      Worker.process_queues
      s = LogSession.last
      json = JSON.parse(response.body)
      expect(json['log']['pending']).to eq(true)
      expect(s.data['event_summary']).to eq('cool')
      expect(s.data['ip_address']).to eq("0000:0000:0000:0000:0000:ffff:0807:0605")
    end
    
    it "should error gracefully on log update fail" do
      expect_any_instance_of(LogSession).to receive(:process_params){|u| u.add_processing_error("bacon") }.and_return(false)
      token_user
      post :create, :log => {:events => [{'timestamp' => 5.hours.ago.to_i, 'type' => 'button', 'button' => {'label' => 'cool', 'board' => {'id' => '1_1'}}}]}
      Worker.process_queues
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['log']['pending']).to eql(true)
    end
  end
  
  describe "update" do
    it "should require api token" do
      put 'update', :id => '1234'
      assert_missing_token
    end
    
    it "should require permission" do
      token_user
      u = User.create
      d = Device.create(:user => u)
      log = LogSession.create(:user => u, :author => u, :device => d)
      put 'update', :id => log.global_id
      assert_unauthorized
    end
    
    it "should call process with :update_only flag" do
      token_user
      d = Device.create(:user => @user)
      log = LogSession.create(:user => @user, :author => @user, :device => d)
      expect_any_instance_of(LogSession).to receive(:process_params).with({}, hash_including(:update_only => true))
      put 'update', :id => log.global_id, 'log' => {}
      expect(response).to be_success
    end
    
    it "should update notes" do
      token_user
      d = Device.create(:user => @user)
      now = 1415689201
      params = {
        'events' => [
          {'id' => 'abc', 'type' => 'button', 'button' => {'label' => 'I', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 10, },
          {'id' => 'qwe', 'type' => 'button', 'button' => {'label' => 'like', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 8},
          {'id' => 'wer', 'type' => 'button', 'button' => {'label' => 'ok go', 'board' => {'id' => '1_1'}}, 'timestamp' => now}
        ]
      }
      log = LogSession.process_new(params, {
        :user => @user,
        :author => @user,
        :device => d
      })
      expect(log.data['events'].map{|e| e['id'] }).to eql(['abc', 'qwe', 'wer'])
      expect(log.data['events'].map{|e| e['notes'] }).to eql([nil, nil, nil])
      
      params = {
        'events' => [
          {'id' => 'abc', 'type' => 'button', 'button' => {'label' => 'I', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 10, 'notes' => [
            {'note' => 'ok cool'}
          ]},
          {'id' => 'qwe', 'type' => 'button', 'button' => {'label' => 'like', 'board' => {'id' => '1_1'}}, 'timestamp' => now - 8},
          {'id' => 'wer', 'type' => 'button', 'button' => {'label' => 'ok go', 'board' => {'id' => '1_1'}}, 'timestamp' => now, 'notes' => [
            {'note' => 'that is good'}
          ]}
        ]
      }
      put 'update', :id => log.global_id, 'log' => params
      expect(response).to be_success
      json = JSON.parse(response.body)
      
      expect(json['log']['events'].length).to eql(3)

      notes = json['log']['events'][0]['notes']
      expect(notes.length).to eql(1);
      note = notes[0]
      expect(note['note']).to eql('ok cool')
      expect(note['author']).to eql({
        'id' => @user.global_id,
        'user_name' => @user.user_name
      })

      note = json['log']['events'][2]['notes'][0]
      expect(note['note']).to eql('that is good')
      expect(note['author']).to eql({
        'id' => @user.global_id,
        'user_name' => @user.user_name
      })
    end
  end
  
  describe "lam" do
    it "should not require api token" do
      get 'lam', :log_id => '1234'
      expect(response).to be_success
    end
    
    it "should error gracefully on not found" do
      get 'lam', :log_id => '1234'
      expect(response).to be_success
      expect(response.body).to eql("Not found")
      
      u = User.create
      d = Device.create
      log = LogSession.create(:user => u, :device => d, :author => u)
      get 'lam', :log_id => log.global_id
      expect(response).to be_success
      expect(response.body).to eql("Not found")
    end
    
    it "should render a LAM file on success" do
      u = User.create
      d = Device.create
      log = LogSession.create(:user => u, :device => d, :author => u)
      get 'lam', :log_id => log.global_id, :nonce => log.data['nonce']
      expect(response).to be_success
      expect(response.body).to match(/CAUTION/)
      expect(response.body).to match(/LAM Version 2\.00/)
    end
  end

  describe "import" do
    it "should require an api token" do
      post 'import', :user_id => 'asdf'
      assert_missing_token
    end
    
    it "should error if the user doesn't exist" do
      token_user
      post 'import', :user_id => 'asdf'
      assert_not_found('asdf')
    end
    
    it "should require authorization" do
      token_user
      u = User.create
      post 'import', :user_id => u.global_id
      assert_unauthorized
    end
    
    it "should error if no content provided" do
      token_user
      post 'import', :user_id => @user.global_id
      expect(response).to_not be_success
      json = JSON.parse(response.body)
      expect(json['error']).to eq('missing content for import')
    end
    
    it "should process the data" do
      token_user
      expect(Stats).to receive(:process_lam).with('some content', @user).and_return([{}])
      post 'import', :user_id => @user.global_id, :content => "some content"
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['log']).to_not eq(nil)
    end
  end
end
