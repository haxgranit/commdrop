require 'spec_helper'

describe Api::ButtonSetsController, :type => :controller do
  before(:each) do
    @pre_env = ENV['REMOTE_EXTRA_DATA']
  end
  after(:each) do
    ENV['REMOTE_EXTRA_DATA'] = @pre_env
  end
  
  describe "show" do
    it "should not require api token" do
      get :show, params: {:id => 'asdf'}
      assert_not_found('asdf')
    end
    
    it "should require existing object" do
      token_user
      get :show, params: {:id => '1_19999'}
      assert_not_found('1_19999')
    end

    it "should require authorization" do
      token_user
      u = User.create
      b = Board.create(:user => u)
      bs = BoardDownstreamButtonSet.update_for(b.global_id)
      get :show, params: {:id => b.global_id}
      assert_unauthorized
    end
    
    it "should return a json response" do
      token_user
      b = Board.create(:user => @user)
      bs = BoardDownstreamButtonSet.update_for(b.global_id)
      get :show, params: {:id => b.global_id}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json['buttonset']['id']).to eq(b.global_id)
      expect(json['buttonset']['key']).to eq(b.key)
    end
  end
  
  describe "index" do
    it "should require api token" do
      get :index
      assert_missing_token
    end
    
    it "should require valid user" do
      token_user
      get :index, params: {:user_id => 'asdf'}
      assert_not_found('asdf')
    end
    
    it "should require authorization" do
      token_user
      u = User.create
      get :index, params: {:user_id => u.global_id}
      assert_unauthorized
    end
    
    it "should return a paginated list" do
      token_user
      b = Board.create(:user => @user)
      bs = BoardDownstreamButtonSet.update_for(b.global_id)
      @user.settings['preferences']['home_board'] = {'id' => b.global_id}
      @user.save
      get :index, params: {:user_id => @user.global_id}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json['buttonset'].length).to eq(1)
      expect(json['buttonset'][0]['id']).to eq(b.global_id)
      expect(json['meta']['offset']).to eq(0)
    end
  end

  describe "generate" do
    it "should require an api token" do
      post :generate, params: {'id' => 'asdf'}
      assert_missing_token
    end

    it "should require a valid board" do
      token_user
      post :generate, params: {'id' => 'asdf'}
      assert_not_found('asdf')
    end

    it "should require permissions" do
      token_user
      u = User.create
      b = Board.create(user: u)
      post :generate, params: {'id' => b.global_id}
      assert_unauthorized
    end

    it "should return exists message if true, including URL" do
      token_user
      b = Board.create(user: @user, :settings => {'full_set_revision' => 'asdf'})
      BoardDownstreamButtonSet.update_for(b.global_id,true)
      b.reload
      expect(Board).to receive(:find_by_path).with(b.global_id).and_return(b)
      bs = b.board_downstream_button_set
      expect(b).to receive(:board_downstream_button_set).and_return(bs)
      expect(bs).to receive(:extra_data_private_url).and_return("asdf")
      post :generate, params: {'id' => b.global_id}
      json = assert_success_json
      expect(json).to eq({'exists' => true, 'id' => b.global_id, 'url' => 'asdf'})
    end

    it "should return a progress response if not yet generated" do
      token_user
      b = Board.create(user: @user)
      post :generate, params: {'id' => b.global_id}
      json = assert_success_json
      expect(json['progress']).to_not eq(nil)
      p = Progress.find_by_global_id(json['progress']['id'])
      expect(p.settings['class']).to eq('BoardDownstreamButtonSet')
      expect(p.settings['method']).to eq('generate_for')
      expect(p.settings['arguments']).to eq([b.global_id, @user.global_id])
    end

    it "should return a progress response if exists but no valid url for the given user" do
      token_user
      u = User.create
      b = Board.create(user: u)
      b2 = Board.create(user: u)
      b.share_with(@user)
      @user.reload
      b.process({'buttons' => [{'id' => 1, 'label' => 'hat', 'load_board' => {'id' => b2.global_id, 'key' => b2.key}}]}, {user: u})
      b2.process({'buttons' => [{'id' => 2, 'label' => 'scat'}]}, {user: u})
      Worker.process_queues
      Worker.process_queues
      expect(b.reload.settings['downstream_board_ids']).to eq([b2.global_id])

      BoardDownstreamButtonSet.update_for(b.global_id, true)
      b.reload
      bs = b.board_downstream_button_set
      expect(bs).to_not eq(nil)
      expect(bs.data['board_ids']).to eq([b.global_id, b2.global_id])
      expect(Board).to receive(:find_by_path).with(b.global_id).and_return(b)
      expect(b).to receive(:board_downstream_button_set).and_return(bs)
      expect(bs).to_not receive(:extra_data_private_url)
      post :generate, params: {'id' => b.global_id}
      json = assert_success_json
      expect(json['progress']).to_not eq(nil)
      p = Progress.find_by_global_id(json['progress']['id'])
      expect(p.settings['class']).to eq('BoardDownstreamButtonSet')
      expect(p.settings['method']).to eq('generate_for')
      expect(p.settings['arguments']).to eq([b.global_id, @user.global_id])
    end

    it "should return a url on progress completion" do
      token_user
      b = Board.create(user: @user, :settings => {'full_set_revision' => 'aaaa'})
      BoardDownstreamButtonSet.update_for(b.global_id, true)
      post :generate, params: {'id' => b.global_id}
      json = assert_success_json
      expect(json['progress']).to_not eq(nil)
      p = Progress.find_by_global_id(json['progress']['id'])
      expect(p.settings['class']).to eq('BoardDownstreamButtonSet')
      expect(p.settings['method']).to eq('generate_for')
      expect(p.settings['arguments']).to eq([b.global_id, @user.global_id])
      expect(Board).to receive(:find_by_global_id).with(b.global_id).and_return(b)
      bs = b.reload.board_downstream_button_set
      expect(bs).to_not eq(nil)
      expect(b).to receive(:board_downstream_button_set).and_return(bs)
      expect(bs).to receive(:url_for).with(@user, 'aaaa').and_return("asdf")
      Progress.perform_action(p.id)
      expect(p.reload.settings['result']).to eq({'success' => true, 'url' => 'asdf'})
    end
  end
end
