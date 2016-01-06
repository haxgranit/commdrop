require 'spec_helper'

describe Api::BoardsController, :type => :controller do
  describe "index" do
    it "should not require api token" do
      get :index
      expect(response).to be_success
    end
    
    it "should filter by user_id" do
      u = User.create(:settings => {:public => true})
      b = Board.create(:user => u, :public => true)
      b2 = Board.create(:user => u)
      get :index, :user_id => u.global_id, :public => true
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['board'].length).to eq(1)
      expect(json['board'][0]['id']).to eq(b.global_id)
    end
    
    it "should require view_detailed permissions when filtering by user_id" do
      u = User.create
      get :index, :user_id => u.global_id
      assert_unauthorized

      get :index, :user_id => u.global_id, :public => true
      assert_unauthorized
    end
    
    it "should require edit permissions when filtering by user_id unless public" do
      u = User.create(:settings => {:public => true})
      get :index, :user_id => u.global_id
      assert_unauthorized
      
      get :index, :user_id => u.global_id, :public => true
      expect(response).to be_success
    end
    
    it "should allow filtering by user_id and private if authorized" do
      token_user
      @user.settings['public'] = true
      @user.save
      b = Board.create(:user => @user, :public => true)
      b2 = Board.create(:user => @user)
      get :index, :user_id => @user.global_id, :private => true
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['board'].length).to eq(1)
      expect(json['board'][0]['id']).to eq(b2.global_id)
    end
    
    it "should return only personal or public boards if authorized" do
      token_user
      b1 = Board.create(:user => @user)
      u2 = User.create
      b2 = Board.create(:user => u2)
      u3 = User.create
      b3 = Board.create(:user => u3, :public => true)
      @user.settings['starred_board_ids'] = [b1.global_id, b2.global_id, b3.global_id]
      @user.save
      get :index, :user_id => @user.global_id, :starred => true
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['board'].length).to eq(2)
      expect(json['board'].map{|b| b['id'] }).to be_include(b1.global_id)
      expect(json['board'].map{|b| b['id'] }).to be_include(b3.global_id)
      expect(json['board'].map{|b| b['id'] }).not_to be_include(b2.global_id)
    end
    
    it "should always filter by public when user_id is not provided" do
      u = User.create(:settings => {:public => true})
      b = Board.create(:user => u, :public => true)
      b2 = Board.create(:user => u)
      get :index
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['board'].length).to eq(1)
      expect(json['board'][0]['id']).to eq(b.global_id)
    end
    
    it "should filter by a key" do
      u = User.create(:settings => {:public => true})
      b = Board.create(:user => u, :public => true)
      get :index, :key => b.key
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['board'].length).to eq(1)
      expect(json['board'][0]['id']).to eq(b.global_id)
    end
    
    it "should check for a user-owned board with the key name if valid access_token" do
      token_user
      @user.settings['public'] = true
      @user.save
      b = Board.create(:user => @user, :public => true)
      get :index, :key => b.key.split(/\//)[1]
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['board'].length).to eq(1)
      expect(json['board'][0]['id']).to eq(b.global_id)
    end
    
    it "should search by query string" do
      u = User.create(:settings => {:public => true})
      b = Board.create(:user => u, :public => true, :settings => {'name' => "one two three"})
      b2 = Board.create(:user => u, :public => true, :settings => {'name' => "four five six"})
      get :index, :q => "two"
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['board'].length).to eq(1)
      expect(json['board'][0]['id']).to eq(b.global_id)

      get :index, :q => "six"
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['board'].length).to eq(1)
      expect(json['board'][0]['id']).to eq(b2.global_id)
    end
    
    it "should search private boards by query string" do
      token_user
      b = Board.create(:user => @user, :settings => {'name' => "one two three"})
      b2 = Board.create(:user => @user, :settings => {'name' => "four five six"})
      get :index, :user_id => @user.global_id, :q => "two"
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['board'].length).to eq(1)
      expect(json['board'][0]['id']).to eq(b.global_id)

      get :index, :user_id => @user.global_id, :q => "six"
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['board'].length).to eq(1)
      expect(json['board'][0]['id']).to eq(b2.global_id)
    end
    
    it "should allow sorting by popularity or home_popularity" do
      u = User.create(:settings => {:public => true})
      b = Board.create(:user => u, :public => true)
      Board.where(:id => b.id).update_all({:home_popularity => 3, :popularity => 1})
      b2 = Board.create(:user => u, :public => true)
      Board.where(:id => b2.id).update_all({:home_popularity => 1, :popularity => 3})
      get :index, :sort => "home_popularity"
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['board'].length).to eq(2)
      expect(json['board'][0]['id']).to eq(b.global_id)
      expect(json['board'][1]['id']).to eq(b2.global_id)

      get :index, :sort => "popularity"
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['board'].length).to eq(2)
      expect(json['board'][0]['id']).to eq(b2.global_id)
      expect(json['board'][1]['id']).to eq(b.global_id)
    end
    
    it "should only show boards with some home_popularity score when sorting by that" do
      u = User.create(:settings => {:public => true})
      b = Board.create(:user => u, :public => true)
      Board.where(:id => b.id).update_all({:home_popularity => 3})
      b2 = Board.create(:user => u, :public => true)
      get :index, :sort => "home_popularity"
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['board'].length).to eq(1)
      expect(json['board'][0]['id']).to eq(b.global_id)
    end
    
    it "should include shared boards if the user has any in user-search results" do
      token_user
      u2 = User.create
      b = Board.create(:user => u2, :settings => {'name' => 'cool board'}, :public => true)
      b.share_with(@user)
      get :index, :user_id => @user.global_id, :q => 'cool', :include_shared => true
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['board'].length).to eq(1)
      expect(json['board'][0]['id']).to eq(b.global_id)
    end
    
    it "should include boards downstream of shared boards in user-search results if enabled" do
      token_user
      u2 = User.create
      b = Board.create(:user => u2, :settings => {'name' => 'cool board'}, :public => true)
      b.share_with(@user, true)
      b2 = Board.create(:user => u2, :settings => {'name' => 'awesome board'}, :public => true)
      b.settings['buttons'] = [
        {'id' => 1, 'load_board' => {'id' => b2.global_id, 'key' => b2.key}}
      ]
      b.save
      b3 = Board.create(:user => u2, :settings => {'name' => 'bodacious board'}, :public => true)
      b2.settings['buttons'] = [
        {'id' => 1, 'load_board' => {'id' => b3.global_id, 'key' => b3.key}}
      ]
      b2.save
      Worker.process_queues
      
      get :index, :user_id => @user.global_id, :q => 'bodacious', :include_shared => true
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['board'].length).to eq(1)
      expect(json['board'][0]['id']).to eq(b3.global_id)

      get :index, :user_id => @user.global_id, :q => 'board', :include_shared => true
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['board'].length).to eq(3)
      expect(json['board'].map{|b| b['id'] }.sort).to eq([b.global_id, b2.global_id, b3.global_id])
    end
    
    it "should not include boards downstream of shared boards in user-search results if by a different author" do
      token_user
      u2 = User.create
      u3 = User.create
      b = Board.create(:user => u2, :settings => {'name' => 'cool board'}, :public => true)
      b.share_with(@user, true)
      b2 = Board.create(:user => u3, :settings => {'name' => 'awesome board'}, :public => true)
      b.settings['buttons'] = [
        {'id' => 1, 'load_board' => {'id' => b2.global_id, 'key' => b2.key}}
      ]
      b.save
      b3 = Board.create(:user => u2, :settings => {'name' => 'bodacious board'}, :public => true)
      b2.settings['buttons'] = [
        {'id' => 1, 'load_board' => {'id' => b3.global_id, 'key' => b3.key}}
      ]
      b2.save
      Worker.process_queues
      
      get :index, :user_id => @user.global_id, :q => 'awesome', :include_shared => true
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['board'].length).to eq(0)

      get :index, :user_id => @user.global_id, :q => 'board', :include_shared => true
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['board'].length).to eq(2)
      expect(json['board'][0]['id']).to eq(b.global_id)
      expect(json['board'][1]['id']).to eq(b3.global_id)
    end
  end

  describe "show" do
    it "should not require api token" do
      u = User.create
      b = Board.create(:user => u, :public => true)
      get :show, :id => b.global_id
      expect(response).to be_success
    end
    
    it "should require existing object" do
      u = User.create
      b = Board.create(:user => u)
      get :show, :id => '1_19999'
      assert_not_found
    end

    it "should require authorization" do
      u = User.create
      b = Board.create(:user => u)
      get :show, :id => b.global_id
      assert_unauthorized
    end
    
    it "should return a json response" do
      token_user
      b = Board.create(:user => @user)
      get :show, :id => b.global_id
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['board']['id']).to eq(b.global_id)
    end
    
    it "should return deleted status if the information is allowed" do
      token_user
      b = Board.create(:user => @user)
      key = b.key
      b.destroy
      Worker.process_queues
      get :show, :id => key
      assert_not_found(key)
      json = JSON.parse(response.body)
      expect(json['deleted']).to eq(true)
    end
    
    it "should not return deleted status if not allowed" do
      token_user
      u = User.create
      b = Board.create(:user => u, :public => true)
      key = b.key
      b.destroy
      Worker.process_queues
      get :show, :id => key
      assert_not_found
      json = JSON.parse(response.body)
      expect(json['deleted']).to eq(nil)
    end
    
    it "should return never_existed status if allowed" do
      token_user
      u = User.create
      User.link_supervisor_to_user(@user, u)
      get :show, :id => "#{u.user_name}/bacon"
      assert_not_found("#{u.user_name}/bacon")
      json = JSON.parse(response.body)
      expect(json['deleted']).to eq(nil)
      expect(json['never_existed']).to eq(true)
    end
    
    it "should not return never_existed status if not allowed" do
      token_user
      u = User.create
      get :show, :id => "#{u.user_name}/bacon"
      assert_not_found
      json = JSON.parse(response.body)
      expect(json['deleted']).to eq(nil)
      expect(json['never_existed']).to eq(nil)
    end
  end
  
  describe "create" do
    it "should require api token" do
      post :create
      assert_missing_token
    end
    
    it "should create a new board" do
      token_user
      post :create, :board => {:name => "my board"}
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['board']['name']).to eq('my board')
    end
    
    it "should error gracefully on board creation fail" do
      expect_any_instance_of(Board).to receive(:process_params){|u| u.add_processing_error("bacon") }.and_return(false)
      token_user
      post :create, :board => {:name => "my board"}
      json = JSON.parse(response.body)
      expect(json['error']).to eq("board creation failed")
      expect(json['errors']).to eq(["bacon"])
    end
    
    it "should allow creating a board for a supervisee" do
      token_user
      com = User.create
      User.link_supervisor_to_user(@user, com, nil, true)
      post :create, :board => {:name => "my board", :for_user_id => com.global_id}
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['board']['name']).to eq('my board')
      expect(json['board']['user_name']).to eq(com.user_name)
    end
    
    it "should not allow creating a board for a random someone else" do
      token_user
      com = User.create
      post :create, :board => {:name => "my board", :for_user_id => com.global_id}
      assert_unauthorized
    end
    
    it "should not allow creating a board for a supervisee if you don't have edit privileges" do
      token_user
      com = User.create
      User.link_supervisor_to_user(@user, com, nil, false)
      post :create, :board => {:name => "my board", :for_user_id => com.global_id}
      assert_unauthorized
    end
  end
  
  describe "update" do
    it "should require api token" do
      put :update, :id => "1_1"
      assert_missing_token
    end
    
    it "should error on not found" do
      u = User.create
      token_user
      put :update, :id => "1_19999"
      assert_not_found
    end

    it "should require edit permissions" do
      u = User.create
      b = Board.create(:user => u)
      token_user
      put :update, :id => b.global_id
      assert_unauthorized
    end
    
    it "should update the board" do
      token_user
      b = Board.create(:user => @user)
      put :update, :id => b.global_id, :board => {:name => "cool board 2"}
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['board']['name']).to eq("cool board 2")
    end
    
    it "should allow linking to private boards with access permission" do
      token_user
      b = Board.create(:user => @user)
      b2 = Board.create(:user => @user)
      button = {:id => 123, :load_board => {:id => b2.global_id, :key => b2.key}}
      put :update, :id => b.global_id, :board => {:name => "cool board 2", :buttons => [button]}
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['board']['name']).to eq("cool board 2")
      expect(json['board']['buttons'].length).to eq(1)
      expect(json['board']['buttons'][0]['load_board']).to eq({'id' => b2.global_id, 'key' => b2.key})
    end
    
    it "should now allow linking to private boards without access permission" do
      token_user
      @u2 = User.create
      b = Board.create(:user => @user)
      b2 = Board.create(:user => @u2)
      button = {:id => 123, :load_board => {:id => b2.global_id, :key => b2.key}}
      put :update, :id => b.global_id, :board => {:name => "cool board 2", :buttons => [button]}
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['board']['name']).to eq("cool board 2")
      expect(json['board']['buttons'].length).to eq(1)
      expect(json['board']['buttons'][0]['load_board']).to eq(nil)
    end
    
    it "should error gracefully on board update fail" do
      expect_any_instance_of(Board).to receive(:process_params){|u| u.add_processing_error("bacon") }.and_return(false)
      token_user
      b = Board.create(:user => @user)
      put :update, :id => b.global_id, :board => {:name => "cool board 2"}
      json = JSON.parse(response.body)
      expect(json['error']).to eq("board update failed")
      expect(json['errors']).to eq(["bacon"])
    end
    
    it "should properly share with a second user" do
      token_user
      u2 = User.create
      u3 = User.create
      b = Board.create(:user => @user)
      b.share_with(u2)
      b = Board.find(b.id)
      @user = User.find(@user.id)
      
      put :update, :id => b.global_id, :board => {:sharing_key => "add_shallow-#{@user.user_name}"}
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['board']['shared_users'].length).to eq(2)
      
      b = Board.find(b.id)
      expect(b.shared_users.length).to eq(2)
    end
  end
  
  describe "star" do
    it "should require api token" do
      post :star, :board_id => "1_1"
      assert_missing_token
    end
    
    it "should error on not found" do
      token_user
      post :star, :board_id => "1_1"
      assert_not_found
    end
    
    it "should star the board and return a json response" do
      token_user
      b = Board.create(:user => @user)
      post :star, :board_id => b.global_id
      expect(response).to be_success
      expect(b.reload.settings['starred_user_ids']).to eq([@user.global_id])
      json = JSON.parse(response.body)
      expect(json).to eq({'starred' => true, 'stars' => 1})
    end
  end
  
  describe "unstar" do
    it "should require api token" do
      delete :star, :board_id => "1_1"
      assert_missing_token
    end

    it "should error on not found" do
      token_user
      delete :star, :board_id => "1_1"
      assert_not_found
    end

    it "should star the board and return a json response" do
      token_user
      b = Board.create(:user => @user, :settings => {'starred_user_ids' => [@user.global_id]})
      delete :unstar, :board_id => b.global_id
      expect(response).to be_success
      expect(b.reload.settings['starred_user_ids']).to eq([])
      json = JSON.parse(response.body)
      expect(json).to eq({'starred' => false, 'stars' => 0})
    end
  end
  
  describe "destroy" do
    it "should require api token" do
      delete :destroy, :id => "1_1"
      assert_missing_token
    end

    it "should error on not found" do
      token_user
      delete :destroy, :id => "1_1"
      assert_not_found
    end
    
    it "should require permission" do
      u = User.create
      b = Board.create(:user => u)
      token_user
      delete :destroy, :id => b.global_id
      assert_unauthorized
    end
    
    it "should delete the board and return a json response" do
      token_user
      b = Board.create(:user => @user)
      delete :destroy, :id => b.global_id
      expect(response).to be_success
      expect(Board.find_by(:id => b.id)).to eq(nil)
      json = JSON.parse(response.body)
      expect(json['board']['id']).to eq(b.global_id)
    end
  end
  
  describe "stats" do
    it "should require api token" do
      get :stats, :board_id => '1_1'
      assert_missing_token
    end
    
    it "should require permission" do
      token_user
      u = User.create
      b = Board.create(:user => u)
      get :stats, :board_id => b.global_id
      assert_unauthorized
    end
    
    it "should return basic stats" do
      token_user
      b = Board.new(:user => @user)
      expect(b).to receive(:generate_stats).and_return(nil)
      b.settings = {}
      b.settings['stars'] = 4
      b.settings['uses'] = 3
      b.settings['home_uses'] = 4
      b.settings['forks'] = 1
      b.save
      
      get :stats, :board_id => b.global_id
      expect(response).to be_success
      hash = JSON.parse(response.body)
      expect(hash['uses']).to eq(3)
    end
  end
  
  describe "download" do
    it "should not error on not found" do
      post :download, :board_id => "1_19999"
      assert_not_found
    end

    it "should not require api token" do
      u = User.create
      b = Board.create(:user => u, :public => true)
      post :download, :board_id => b.global_id
      expect(response).to be_success
    end
    
    it "should require permission" do
      u = User.create
      b = Board.create(:user => u)
      post :download, :board_id => b.global_id
      assert_unauthorized
    end
    
    it "should allow unauthenticated user to download if public"
    
    it "should return a progress record" do
      u = User.create
      b = Board.create(:user => u, :public => true)
      post :download, :board_id => b.global_id
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['progress']['id']).not_to eq(nil)
    end
  end
  
  describe "rename" do
    it "should require api token" do
      post :rename, :board_id => "1_1"
      assert_missing_token
    end
    
    it "should error on not found" do
      token_user
      post :rename, :board_id => "1_19999"
      assert_not_found
    end

    it "should require edit permissions" do
      u = User.create
      b = Board.create(:user => u)
      token_user
      post :rename, :board_id => b.global_id
      assert_unauthorized
    end
    
    it "should rename the board" do
      token_user
      b = Board.create(:user => @user)
      post :rename, :board_id => b.global_id, :old_key => b.key, :new_key => "#{@user.user_name}/bacon"
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json).to eq({'rename' => true, 'key' => "#{@user.user_name}/bacon"})
    end

    it "should require the correct old_key" do
      token_user
      b = Board.create(:user => @user)
      post :rename, :board_id => b.global_id, :old_key => b.key + "asdf", :new_key => "#{@user.user_name}/bacon"
      expect(response).not_to be_success
      json = JSON.parse(response.body)
      expect(json).not_to eq(nil)
      expect(json['error']).to eq('board rename failed')
    end
    
    it "should require a valid new_key" do
      token_user
      b = Board.create(:user => @user)
      post :rename, :board_id => b.global_id, :old_key => b.key
      expect(response).not_to be_success
      json = JSON.parse(response.body)
      expect(json).not_to eq(nil)
      expect(json['error']).to eq('board rename failed')
    end
    
    it "should report if there was a new_key name collision" do
      token_user
      b = Board.create(:user => @user)
      b2 = Board.create(:user => @user)
      post :rename, :board_id => b.global_id, :old_key => b.key, :new_key => b2.key
      expect(response).not_to be_success
      json = JSON.parse(response.body)
      expect(json).not_to eq(nil)
      expect(json['error']).to eq('board rename failed')
      expect(json['collision']).to eq(true)
    end
    
    it "should not allow changing the username prefix for the new_key" do
      token_user
      b = Board.create(:user => @user)
      post :rename, :board_id => b.global_id, :old_key => b.key, :new_key => "#{@user.user_name}x/bacon"
      expect(response).not_to be_success
      json = JSON.parse(response.body)
      expect(json).not_to eq(nil)
      expect(json['error']).to eq('board rename failed')
    end
  end
  
  describe "import" do
    it "should have specs for imports"
  end
  
  describe "unlink" do
    it "should require api token" do
      post :unlink
      assert_missing_token
    end
    
    it "should require a valid board" do
      token_user
      post :unlink, :board_id => 'asdf'
      assert_not_found
    end
    
    it "should require user edit permission" do
      token_user
      u = User.create
      b = Board.create(:user => u)
      post :unlink, :board_id => b.global_id, :user_id => u.global_id
      assert_unauthorized
    end
    
    it "should require delete permission to delete a board" do
      token_user
      u = User.create
      u2 = User.create
      b = Board.create(:user => u2)
      User.link_supervisor_to_user(@user, u, nil, true)
      post :unlink, :board_id => b.global_id, :user_id => u.global_id, :type => 'delete'
      assert_unauthorized
    end
    
    it "should delete a board if allowed" do
      token_user
      u = User.create
      b = Board.create(:user => u)
      User.link_supervisor_to_user(@user, u, nil, true)
      post :unlink, :board_id => b.global_id, :user_id => u.global_id, :type => 'delete'
      expect(response).to be_success
    end
    
    it "should unstar a board for the specified user" do
      token_user
      u = User.create
      b = Board.create(:user => u)
      b.star!(u, true)
      expect(b.starred_by?(u)).to eq(true)
      User.link_supervisor_to_user(@user, u, nil, true)
      post :unlink, :board_id => b.global_id, :user_id => u.global_id, :type => 'unstar'
      expect(response).to be_success
      expect(b.reload.starred_by?(u)).to eq(false)
    end
    
    it "should error on an unrecognized action" do
      token_user
      u = User.create
      b = Board.create(:user => u)
      b.star!(u, true)
      User.link_supervisor_to_user(@user, u, nil, true)
      post :unlink, :board_id => b.global_id, :user_id => u.global_id, :type => 'bacon'
      expect(response).not_to be_success
      json = JSON.parse(response.body)
      expect(json['error']).to eq('unrecognized type')
    end
    
    it "should unlink a shared board for the specified user" do
      token_user
      u = User.create
      b = Board.create(:user => u)
      b.share_with(@user)
      expect(b.shared_with?(@user)).to eq(true)
      post :unlink, :board_id => b.global_id, :user_id => @user.global_id, :type => 'unlink'
      expect(response).to be_success
      expect(b.reload.shared_with?(@user.reload)).to eq(false)
    end
  end
  
  describe "history" do
    it "should require an access token" do
      get :history, :board_id => "asdf/asdf"
      assert_missing_token
    end
    
    it "should require a valid board" do
      token_user
      get :history, :board_id => "asdf/asdf"
      assert_not_found
    end
    
    it "should require permission" do
      token_user
      u = User.create
      b = Board.create(:user => u)
      get :history, :board_id => b.key
      assert_unauthorized
    end
    
    with_versioning do
      it "should return a list of versions" do
        token_user
        PaperTrail.whodunnit = "user:#{@user.global_id}"
        b = Board.create(:user => @user, :settings => {'buttons' => []})
        get :history, :board_id => b.key
        expect(response).to be_success
        json = JSON.parse(response.body)
        expect(json['boardversion']).not_to eq(nil)
        expect(json['boardversion'].length).to eq(1)
        expect(json['boardversion'][0]['action']).to eq('create')
        expect(json['boardversion'][0]['modifier']['user_name']).to eq(@user.user_name)
      end
    
      it "should return a list of versions for a deleted board" do
        token_user
        PaperTrail.whodunnit = "user:#{@user.global_id}"
        b = Board.create(:user => @user, :settings => {'buttons' => []})
        key = b.key

        vs = b.versions.where('whodunnit IS NOT NULL')
        expect(vs.length).to eq(1)
        vs.update_all(:created_at => 5.seconds.ago)
        
        b.destroy

        vs = b.versions.where('whodunnit IS NOT NULL')
        expect(vs.length).to eq(2)
        
        get :history, :board_id => key
        expect(response).to be_success
        json = JSON.parse(response.body)
        expect(json['boardversion']).not_to eq(nil)
        expect(json['boardversion'].length).to eq(2)
        expect(json['boardversion'][0]['action']).to eq('destroy')
        expect(json['boardversion'][1]['action']).to eq('create')
        expect(json['boardversion'][1]['modifier']['user_name']).to eq(@user.user_name)
      end
    
      it "should not return a list of versions for a deleted board if not allowed" do
        token_user
        u = User.create
        b = Board.create(:user => u, :settings => {'buttons' => []}, :public => true)
        key = b.key
        b.destroy
        get :history, :board_id => key
        assert_unauthorized
      end
    end
  end
end
