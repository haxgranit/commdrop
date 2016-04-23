require 'spec_helper'

describe BoardsController, :type => :controller do
  describe "index" do
    it "should render" do
      get "index"
      expect(response).to be_success
    end
  end
  
  describe "cache" do
    it "should render" do
      get "cache"
      expect(response).to be_success
    end
  end
  
  describe "about" do
    it "should render" do
      get "about"
      expect(response).to be_success
      expect(assigns[:meta_record]).not_to eq(nil)
    end
  end
  
  describe "board" do
    it "should set a meta attribute if public" do
      u = User.create
      b = Board.create(:user => u, :public => true)
      meta = b.meta_record
      expect_any_instance_of(Board).to receive(:meta_record).and_return(meta)
      get :board, :id => b.key
      expect(response).to be_success
    end

    it "should not set a meta attribute if private" do
      u = User.create
      b = Board.create(:user => u)
      meta = b.meta_record
      expect_any_instance_of(Board).to_not receive(:meta_record)
      get :board, :id => b.key
      expect(response).to be_success
    end
    
    it "should redirect when old key found" do
      u = User.create
      b = Board.create(:user => u)
      OldKey.create(:type => 'board', :key => 'bob/fred', :record_id => b.global_id)
      get :board, :id => 'bob/fred'
      expect(response).to be_redirect
      expect(response.location).to match(/\/#{b.key}$/)
    end
  end
  
  describe "user" do
    it "should set a meta attribute" do
      u = User.create(:settings => {'public' => true})
      meta = u.meta_record
      expect_any_instance_of(User).to receive(:meta_record).and_return(meta)
      get :user, :id => u.global_id
      expect(response).to be_success
    end

    it "should redirect when old key found" do
      u = User.create
      OldKey.create(:type => 'user', :key => 'bobfred', :record_id => u.global_id)
      get :user, :id => 'bobfred'
      expect(response).to be_redirect
      expect(response.location).to match(/\/#{u.user_name}$/)
    end
  end
  
  describe "icon" do
    it "should redirect to the icon's url" do
      u = User.create
      b = Board.create(:user => u)
      get :icon, :id => b.global_id
      expect(response).to be_redirect
      expect(response.location).to eq(b.icon_url_or_fallback)
    end
  end
  
  describe "utterance" do
    it "should render templates, right now it's rendering empty string in tests"
    
    it "should load the utterance record" do
      u = Utterance.create(:data => {:sentence => "ok guys"})
      get :utterance, :id => u.global_id
#      response.should be_success
    end
    
    it "should set a meta attribute" do
      u = Utterance.create(:data => {:sentence => "ok guys"})
      meta = u.meta_record
      expect_any_instance_of(Utterance).to receive(:meta_record).and_return(meta)
      get :utterance, :id => u.global_id
      expect(response).to be_success
      expect(assigns[:meta_record]).not_to eq(nil)
#      response.body.should match(/meta name="twitter:description" content="ok guys"/)
    end
  end
end
