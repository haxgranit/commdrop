require 'spec_helper'

describe ApplicationController, :type => :controller do
  controller do
    def index; render :text => "ok"; end
  end
  
  describe "set_host" do
    it "should set the host for API responses" do
      get :index
      expect(JsonApi::Json.current_host).to eq("http://test.host")
    end
  end
  
  describe "check_api_token" do
    it "should find by user and device for the specified token" do
      u = User.create
      d = Device.create(:user => u)
      get :index, :access_token => d.token, :check_token => true
      expect(assigns[:api_device]).to eq(d)
      expect(assigns[:api_user]).to eq(u)
      expect(response).to be_success
    end
    
    it "should set correct whodunnit" do
      u = User.create
      d = Device.create(:user => u)
      get :index, :access_token => d.token, :check_token => true
      expect(PaperTrail.whodunnit).to eq("user:#{u.global_id}")
    end
    
    it "should check for the token as a query parameter" do
      u = User.create
      d = Device.create(:user => u)
      get :index, :access_token => d.token, :check_token => true
      expect(assigns[:api_device]).to eq(d)
      expect(assigns[:api_user]).to eq(u)
      expect(response).to be_success
    end
    
    it "should check for the token as an http header" do
      u = User.create
      d = Device.create(:user => u)
      request.headers['Authorization'] = "Bearer #{d.token}"
      get :index, :check_token => true
      expect(assigns[:api_device]).to eq(d)
      expect(assigns[:api_user]).to eq(u)
      expect(response).to be_success
    end
    
    it "should return an error if a token is provided but invalid" do
      get :index, :access_token => "abcdef", :check_token => true
      expect(assigns[:api_device]).to eq(nil)
      expect(assigns[:api_user]).to eq(nil)
      expect(response).not_to be_success
      json = JSON.parse(response.body)
      expect(json['error']).to eq('Invalid token')
      expect(json['token']).to eq('abcdef')
    end
    
    it "should not error if no token parameter is sent" do
      get :index, :check_token => true
      expect(assigns[:api_device]).to eq(nil)
      expect(assigns[:api_user]).to eq(nil)
      expect(response).to be_success
    end
  end
  
  describe "log_api_call" do
    it "should log the event" do
      expect(ApiCall).to receive(:log) do |token, user, request, response, time|
        expect(token).to eq(nil)
        expect(user).to eq(nil)
        expect(request.path).not_to eq(nil)
        expect(response.code).to eq('200')
        expect(time).to eq(nil)
      end
      get :index
      
      token_user
      expect(ApiCall).to receive(:log) do |token, user, request, response, time|
        expect(token).to eq(@device.token)
        expect(user).to eq(@user)
        expect(request.path).not_to eq(nil)
        expect(response.code).to eq('200')
        expect(time).not_to eq(nil)
        expect(time).to be < 1000
      end
      get :index
    end
  end
#   def log_api_call
#     time = @time ? (Time.now - @time) : nil
#     ApiCall.log(@token, @api_user, request, response, time)
#     true
#   end
  
  describe "user_for_paper_trail" do
    it "should return user information if there is a user" do
      u = User.create
      d = Device.create(:user => u)
      get :index, :access_token => d.token, :check_token => true
      expect(controller.user_for_paper_trail).to eq("user:#{u.global_id}")
    end
    
    it "should return ip address if no user" do
      get :index
      expect(controller.user_for_paper_trail).to eq("unauthenticated:0.0.0.0")
    end
  end
  
  describe "replace_helper_params" do
    it "should replace self with user id only if there's a user" do
      get :index, :id => 'self', :user_id => 'self', :author_id => 'self'
      expect(controller.params['id']).to eq('self')
      expect(controller.params['user_id']).to eq('self')
      expect(controller.params['author_id']).to eq('self')
      
      u = User.create
      d = Device.create(:user => u)
      get :index, :id => 'self', :user_id => 'self', :author_id => 'self', :access_token => d.token, :check_token => true
      expect(assigns[:api_user]).to eq(u)
      expect(controller.params['id']).to eq(u.global_id)
      expect(controller.params['user_id']).to eq(u.global_id)
      expect(controller.params['author_id']).to eq(u.global_id)
    end

    it "should replace my_org with user's managed org id only if there's a user" do
      o = Organization.create
      get :index, :id => 'my_org', :user_id => 'my_org', :author_id => 'my_org'
      expect(controller.params['id']).to eq('my_org')
      expect(controller.params['user_id']).to eq('my_org')
      expect(controller.params['author_id']).to eq('my_org')
      
      u = User.create
      d = Device.create(:user => u.reload)
      u.settings['manager_for'] = {'9' => {'full_manager' => true}}
      get :index, :id => 'my_org', :user_id => 'my_org', :author_id => 'my_org', :access_token => d.token, :check_token => true
      expect(assigns[:api_user]).to eq(u)
      expect(controller.params['id']).to eq('my_org')
      expect(controller.params['user_id']).to eq('my_org')
      expect(controller.params['author_id']).to eq('my_org')

      u = User.create
      o.add_manager(u.user_name, true)
      d = Device.create(:user => u.reload)
      get :index, :id => 'my_org', :user_id => 'my_org', :author_id => 'my_org', :access_token => d.token, :check_token => true
      expect(assigns[:api_user]).to eq(u)
      expect(controller.params['id']).to eq(o.global_id)
      expect(controller.params['user_id']).to eq(o.global_id)
      expect(controller.params['author_id']).to eq(o.global_id)
    end
  end
  
  describe "require_api_token" do
    controller do
      before_filter :require_api_token, :only => [:index]
      def index; render :text => "ok"; end
    end
    it "should error if no token parameter is sent" do
      get :index, :check_token => true
      expect(assigns[:api_device]).to eq(nil)
      expect(assigns[:api_user]).to eq(nil)
      assert_missing_token
    end
    
    it "should not error if token is sent" do
      u = User.create
      d = Device.create(:user => u)
      get :index, :access_token => d.token, :check_token => true
      expect(assigns[:api_device]).to eq(d)
      expect(assigns[:api_user]).to eq(u)
      expect(response).to be_success
    end
  end
  
  describe "api_error" do
    controller do
      before_filter :require_api_token, :only => [:index]
      def index; render :text => "ok"; end
    end
    it "should return a correct status code by default" do
      get :index, :check_token => true
      expect(response).not_to be_success
      expect(response.code).to eq("400")
      json = JSON.parse(response.body)
      expect(json['status']).to eq(400)
    end
    
    it "should return a success code if X-Has-AppCache header is set" do
      request.headers['X-Has-AppCache'] = "true"
      get :index, :check_token => true
      expect(response).to be_success
      expect(response.code).to eq("200")
      json = JSON.parse(response.body)
      expect(json['status']).to eq(400)
    end
    
    it "should return a success code if nocache=1 is set" do
      get :index, :check_token => true, :nocache => 1
      expect(response).to be_success
      expect(response.code).to eq("200")
      json = JSON.parse(response.body)
      expect(json['status']).to eq(400)
    end
    
  end

  describe "allowed?" do
    controller do
      def index; 
        @user = User.find_by(:id => params[:id])
        return unless allowed?(@user, 'edit')
        render :text => "ok"; 
      end
    end
    
    it "should not intercept if permission succeeds" do
      u = User.create
      d = Device.create(:user => u)
      get :index, :id => u.id, :access_token => d.token, :check_token => true
      expect(response).to be_success
    end
    
    it "should error gracefully if permission fails" do
      u = User.create
      u2 = User.create
      d = Device.create(:user => u)
      get :index, :id => u2.id, :access_token => d.token, :check_token => true
      assert_unauthorized
    end
    
    it "should error gracefully with nil object" do
      u = User.create
      d = Device.create(:user => u)
      get :index, :id => u.id + 1, :access_token => d.token, :check_token => true
      assert_unauthorized
    end
  end

  describe "exists?" do
    controller do
      def index; 
        @user = User.find_by(:id => params[:id])
        return unless exists?(@user, params[:ref_id])
        render :text => "ok"; 
      end
    end
    
    it "should not intercept if permission succeeds" do
      u = User.create
      get :index, :id => u.id
      expect(response).to be_success
    end
    
    it "should error gracefully if not found" do
      u = User.create
      get :index, :id => u.id + 1
      assert_not_found
    end
    
    it "should error include ref id if provided" do
      u = User.create
      get :index, :id => u.id + 1, :ref_id => "bacon"
      assert_not_found("bacon")
    end
  end
  
  describe "set_browser_token_header" do
    controller do
      def index 
        set_browser_token_header
        render :text => "ok"
      end
    end
    
    it "should set a valid token header" do
      get :index
      expect(response.headers['BROWSER_TOKEN']).not_to eq(nil)
      expect(Security.valid_browser_token?(response.headers['BROWSER_TOKEN'])).to eq(true)
    end
  end
end

