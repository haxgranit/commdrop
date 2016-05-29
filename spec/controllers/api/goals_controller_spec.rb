require 'spec_helper'

describe Api::GoalsController, type: :controller do
  describe "index" do
    it "should not require api token" do
      get :index, :template_header => 1
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['goal']).to eq([])
    end
    
    it "should list template_header goals" do
      g = UserGoal.create(:template_header => true)
      get :index, :template_header => 1
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['goal'].length).to eq(1)
      expect(json['goal'][0]['id']).to eq(g.global_id)
    end
    
    it "should require permission for user goals" do
      u = User.create
      token_user
      get :index, :user_id => u.global_id
      assert_unauthorized
    end
    
    it "should list user goals if authorized" do
      token_user
      g = UserGoal.create(:user => @user)
      get :index, :user_id => @user.global_id
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['goal'].length).to eq(1)
      expect(json['goal'][0]['id']).to eq(g.global_id)
    end
    
    it "should paginate results" do
      token_user
      50.times do |i|
        UserGoal.create(:user => @user)
      end
      get :index, :user_id => @user.global_id
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['goal'].length).to eq(25)
      expect(json['meta']['more']).to eq(true)
    end
  end
  
  describe "show" do
    it "should require api token" do
      get :show, :id => 'asdf'
      assert_missing_token
    end
    
    it "should require valid record" do
      token_user
      get :show, :id => 'asdf'
      assert_not_found('asdf')
    end
    
    it "should require permission" do
      token_user
      u = User.create
      g = UserGoal.create(:user => u)
      get :show, :id => g.global_id
      assert_unauthorized
    end
    
    it "should return goal" do
      token_user
      g = UserGoal.create(:user => @user)
      get :show, :id => g.global_id
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['goal']['id']).to eq(g.global_id)
    end
  end

  describe "create" do
    it "should require api token" do
      post :create
      assert_missing_token
    end
    
    it "should require valid user_id" do
      token_user
      post :create, :goal => {'user_id' => 'asdf'}
      assert_not_found('asdf')
    end
    
    it "should require permission" do
      token_user
      u = User.create
      post :create, :goal => {'user_id' => u.global_id}
      assert_unauthorized
    end
    
    it "should create goal" do
      token_user
      post :create, :goal => {'user_id' => @user.global_id, 'summary' => 'cool goal'}
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['goal']['id']).to_not be_nil
      expect(json['goal']['summary']).to eq('cool goal')
    end
  end

  describe "update" do
    it "should require api token" do
      put :update, :id => 'asdf'
      assert_missing_token
    end
    
    it "should require existing record" do
      token_user
      put :update, :id => 'asdf'
      assert_not_found('asdf')
    end
    
    it "should require permission" do
      token_user
      u = User.create
      g = UserGoal.create(:user => u)
      put :update, :id => g.global_id
      assert_unauthorized
    end
    
    it "should update the record" do
      token_user
      g = UserGoal.create(:user => @user)
      put :update, :id => g.global_id, :goal => {'summary' => 'better goal'}
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['goal']['id']).to eq(g.global_id)
      expect(json['goal']['summary']).to eq('better goal')
    end
    
    it "should allow those with non-edit permissions to comment but nothing else" do
      token_user
      u = User.create
      User.link_supervisor_to_user(@user, u, nil, false)
      g = UserGoal.create(:user => u)
      put :update, :id => g.global_id, :goal => {'summary' => 'dumb name', 'comment' => {'text' => 'hey yo'}}
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['goal']['summary']).to eq('user goal')
      expect(json['goal']['comments'].length).to eq(1)
      expect(json['goal']['comments'][0]['text']).to eq('hey yo')
      expect(json['goal']['comments'][0]['user']['user_name']).to eq(@user.user_name)
    end
  end

#   def destroy
#     goal = UserGoal.find_by_global_id(params['id'])
#     return unless exists?(goal)
#     return unless allowed?(goal, 'edit')
# 
#     goal.destroy
#     render json: JsonApi::Board.as_json(board, :wrapper => true).to_json
#   end
  describe "destroy" do
    it "should require api token" do
      delete :destroy, :id => 'asdf'
      assert_missing_token
    end
    
    it "should require existing record" do
      token_user
      delete :destroy, :id => 'asdf'
      assert_not_found('asdf')
    end
    
    it "should require permission" do
      token_user
      u = User.create
      User.link_supervisor_to_user(@user, u, nil, false)
      g = UserGoal.create(:user => u)
      delete :destroy, :id => g.global_id
      assert_unauthorized
    end
    
    it "should delete the record" do
      token_user
      u = User.create
      User.link_supervisor_to_user(@user, u, nil, true)
      g = UserGoal.create(:user => u)
      delete :destroy, :id => g.global_id
      expect(response).to be_success
      json = JSON.parse(response.body)
      expect(json['goal']['id']).to eq(g.global_id)
      expect(UserGoal.find_by_global_id(g.global_id)).to eq(nil)
    end
  end
end
