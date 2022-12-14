require 'spec_helper'

describe SessionController, :type => :controller do
  # The oauth flow here is 
  # 1. A user comes to :oauth, we render the login page
  # 2. A user puts in their credentials, this gets POSTed to :oauth_login
  # 3. If the login succeeds, we redirect to the success page
  #    (either on their server, or :oauth_local)
  # 3.1 If the user rejects, we redirect the same way
  # 4. The server makes a call to :oauth_token to exchange the code for a real token
  
  describe "oauth" do
    it "should not require api token" do
      k = DeveloperKey.create(:redirect_uri => DeveloperKey.oob_uri)
      post :oauth, params: {:client_id => k.key, :redirect_uri => DeveloperKey.oob_uri}
      expect(response).to be_successful
    end
    
    it "should error if the redirect_uri isn't valid" do
      k = DeveloperKey.create(:redirect_uri => DeveloperKey.oob_uri)
      post :oauth, params: {:client_id => k.key, :redirect_uri => "http://www.example.com"}
      expect(response).to be_successful
      expect(assigns[:error]).to eq("bad_redirect_uri")
    end
    
    it "should error if the developer key is invalid" do
      post :oauth, params: {:client_id => "abcdef"}
      expect(response).to be_successful
      expect(assigns[:error]).to eq("invalid_key")
    end
    
    it "should stash to redis and render the login page if correct" do
      k = DeveloperKey.create(:redirect_uri => DeveloperKey.oob_uri)
      post :oauth, params: {:client_id => k.key, :redirect_uri => DeveloperKey.oob_uri, :scope => 'bacon'}
      expect(assigns[:app_name]).to eq("the application")
      expect(assigns[:app_icon]).not_to eq(nil)
      expect(assigns[:code]).not_to eq(nil)
      expect(response).to be_successful
      str = RedisInit.default.get("oauth_#{assigns[:code]}")
      expect(str).not_to eq(nil)
      json = JSON.parse(str)
      expect(json['app_name']).to eq('the application')
      expect(json['scope']).to eq('bacon')
      expect(json['user_id']).to eq(nil)
    end

    it "should not allow setting the scope to full" do
      k = DeveloperKey.create(:redirect_uri => DeveloperKey.oob_uri)
      post :oauth, params: {:client_id => k.key, :redirect_uri => DeveloperKey.oob_uri, :scope => 'full'}
      expect(assigns[:app_name]).to eq("the application")
      expect(assigns[:app_icon]).not_to eq(nil)
      expect(assigns[:code]).not_to eq(nil)
      expect(response).to be_successful
      str = RedisInit.default.get("oauth_#{assigns[:code]}")
      expect(str).not_to eq(nil)
      json = JSON.parse(str)
      expect(json['app_name']).to eq('the application')
      expect(json['scope']).to eq('')
      expect(json['user_id']).to eq(nil)
    end
    
    it "should allow requesting multiple valid scopes" do
      k = DeveloperKey.create(:redirect_uri => DeveloperKey.oob_uri)
      post :oauth, params: {:client_id => k.key, :redirect_uri => DeveloperKey.oob_uri, :scope => 'read_profile:basic_supervision'}
      expect(assigns[:app_name]).to eq("the application")
      expect(assigns[:app_icon]).not_to eq(nil)
      expect(assigns[:code]).not_to eq(nil)
      expect(response).to be_successful
      str = RedisInit.default.get("oauth_#{assigns[:code]}")
      expect(str).not_to eq(nil)
      json = JSON.parse(str)
      expect(json['app_name']).to eq('the application')
      expect(json['scope']).to eq('read_profile:basic_supervision')
      expect(json['user_id']).to eq(nil)
    end
  end
  
  def key_with_stash(user=nil, redirect_uri=nil)
    @key = DeveloperKey.create(:redirect_uri => (redirect_uri || DeveloperKey.oob_uri))
    @config = {
      'scope' => 'something',
      'redirect_uri' => @key.redirect_uri
    }
    if user
      @config['user_id'] = user.id.to_s
    end
    @code = "abcdefg"
    RedisInit.default.set("oauth_#{@code}", @config.to_json)
  end
  
  describe "oauth_login" do
    
    it "should not require api token" do
      key_with_stash
      post :oauth_login, params: {:code => @code, :reject => true}
      expect(response).to be_redirect
    end
    
    it "should error when nothing found in redis" do
      post :oauth_login, params: {:code => "abc"}
      expect(response).not_to be_successful
      expect(assigns[:error]).to eq('code_not_found')
    end
    
    it "should error when password is invalid" do
      key_with_stash
      post :oauth_login, params: {:code => @code, :username => "bob", :password => "bob"}
      expect(response).not_to be_successful
      expect(assigns[:error]).to eq('invalid_login')
    end
    
    it "should redirect to redirect_uri for the developer on reject" do
      key_with_stash
      post :oauth_login, params: {:code => @code, :reject => true}
      expect(response).to be_redirect
      expect(response.location).to match(/\/oauth2\/token\/status\?error=access_denied/)

      key_with_stash(nil, "http://www.example.com/oauth")
      post :oauth_login, params: {:code => @code, :reject => true}
      expect(response).to be_redirect
      expect(response.location).to match(/http:\/\/www\.example\.com\/oauth\?error=access_denied/)

      key_with_stash(nil, "http://www.example.com/oauth?a=bcd")
      post :oauth_login, params: {:code => @code, :reject => true}
      expect(response).to be_redirect
      expect(response.location).to match(/http:\/\/www\.example\.com\/oauth\?a=bcd&error=access_denied/)
    end
    
    it "should update redis stash to include the user on success" do
      key_with_stash
      u = User.new
      u.generate_password("bacon")
      u.save
      post :oauth_login, params: {:code => @code, :username => u.user_name, :password => "bacon"}
      expect(response).to be_redirect
      
      str = RedisInit.default.get("oauth_#{@code}")
      expect(str).not_to eq(nil)
      json = JSON.parse(str)
      expect(json['user_id']).to eq(u.id.to_s)
    end
    
    it "should redirect to redirect_uri for the developer on success" do
      u = User.new
      u.generate_password("bacon")
      u.save

      key_with_stash
      post :oauth_login, params: {:code => @code, :username => u.user_name, :password => "bacon"}
      expect(response).to be_redirect
      expect(response.location).to match(/\/oauth2\/token\/status\?code=\w+/)

      key_with_stash(nil, "http://www.example.com/oauth")
      post :oauth_login, params: {:code => @code, :username => u.user_name, :password => "bacon"}
      expect(response).to be_redirect
      expect(response.location).to match(/http:\/\/www\.example\.com\/oauth\?code=\w+/)

      key_with_stash(nil, "http://www.example.com/oauth?a=bcde")
      post :oauth_login, params: {:code => @code, :username => u.user_name, :password => "bacon"}
      expect(response).to be_redirect
      expect(response.location).to match(/http:\/\/www\.example\.com\/oauth\?a=bcde&code=\w+/)
    end
    
    it "should update the device scopes" do
      u = User.new
      u.generate_password("bacon")
      u.save

      key_with_stash
      post :oauth_login, params: {:code => @code, :username => u.user_name, :password => "bacon"}
      expect(response).to be_redirect
      expect(response.location).to match(/\/oauth2\/token\/status\?code=\w+/)

      str = RedisInit.default.get("oauth_#{@code}")
      expect(str).not_to eq(nil)
      json = JSON.parse(str)
      expect(json['scope']).to eq('something')
      expect(json['user_id']).to eq(u.id.to_s)
    end

    it "should allow authorizing with an approve token from an existing user session" do
      u = User.new
      u.generate_password("bacon")
      u.save

      key_with_stash

      d = Device.create(:user => u, :developer_key_id => 0, :device_key => 'asdf')
      token = d.tokens[0]

      post :oauth_login, params: {:code => @code, :username => u.user_name, :approve_token => token}
      expect(response).to be_redirect
      expect(response.location).to match(/\/oauth2\/token\/status\?code=\w+/)
    end
  end
  
  describe "oauth_token" do
    it "should not require api token"
    
    it "should fail on invalid developer key" do
      post :oauth_token
      expect(response).not_to be_successful
      json = JSON.parse(response.body)
      expect(json['error']).to eq('invalid_key')
    end
    
    it "should fail on invalid developer secret" do
      u = User.create
      key_with_stash(u)
      post :oauth_token, params: {:client_id => @key.key}
      expect(response).not_to be_successful
      json = JSON.parse(response.body)
      expect(json['error']).to eq('invalid_secret')
    end
    
    it "should fail when token flow not persisted to redis" do
      @key = DeveloperKey.create(:redirect_uri => DeveloperKey.oob_uri)
      post :oauth_token, params: {:client_id => @key.key, :client_secret => @key.secret}
      expect(response).not_to be_successful
      json = JSON.parse(response.body)
      expect(json['error']).to eq('code_not_found')
    end
    
    it "should fail when user is missing from redis stash" do
      key_with_stash
      post :oauth_token, params: {:code => @code, :client_id => @key.key, :client_secret => @key.secret}
      expect(response).not_to be_successful
      json = JSON.parse(response.body)
      expect(json['error']).to eq('token_not_ready')
    end

    it "should generate a new token for the user's device and return a json response" do
      u = User.create
      key_with_stash(u)
      post :oauth_token, params: {:code => @code, :client_id => @key.key, :client_secret => @key.secret}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json['user_name']).to eq(u.user_name)
      d = Device.find_by_global_id(json['access_token'])
      expect(d).not_to eq(nil)
      expect(d.developer_key).to eq(@key)
      expect(d.user).to eq(u)
    end
    
    it "should create a device for the user if not there yet" do
      u = User.create
      key_with_stash(u)
      expect(Device.count).to eq(0)
      post :oauth_token, params: {:code => @code, :client_id => @key.key, :client_secret => @key.secret}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json['user_name']).to eq(u.user_name)
      d = Device.find_by_global_id(json['access_token'])
      expect(d).not_to eq(nil)
      expect(d.developer_key).to eq(@key)
      expect(d.user).to eq(u)
    end
    
    it "should clear the data from redis on token exchange to prevent replay attacks" do
      u = User.create
      key_with_stash(u)
      expect(Device.count).to eq(0)
      post :oauth_token, params: {:code => @code, :client_id => @key.key, :client_secret => @key.secret}
      expect(response).to be_successful
      expect(RedisInit.default.get("oauth_#{@code}")).to eq(nil)
    end
    
    it "should set specified scopes for the device" do
      u = User.create
      key_with_stash(u)
      @config['scope'] = 'read_profile'
      RedisInit.default.set("oauth_#{@code}", @config.to_json)

      expect(Device.count).to eq(0)
      post :oauth_token, params: {:code => @code, :client_id => @key.key, :client_secret => @key.secret}
      expect(response).to be_successful
      expect(RedisInit.default.get("oauth_#{@code}")).to eq(nil)
      expect(Device.count).to eq(1)
      d = Device.last
      expect(d.permission_scopes).to eq(['read_profile'])
    end
    
    it "should allow settings multiple whitelisted scopes" do
      u = User.create
      key_with_stash(u)
      @config['scope'] = 'read_profile:basic_supervision'
      RedisInit.default.set("oauth_#{@code}", @config.to_json)

      expect(Device.count).to eq(0)
      post :oauth_token, params: {:code => @code, :client_id => @key.key, :client_secret => @key.secret}
      expect(response).to be_successful
      expect(RedisInit.default.get("oauth_#{@code}")).to eq(nil)
      expect(Device.count).to eq(1)
      d = Device.last
      expect(d.permission_scopes).to eq(['read_profile', 'basic_supervision'])
    end

    it "should not set non-whitelisted scopes for the device" do
      u = User.create
      key_with_stash(u)

      expect(Device.count).to eq(0)
      post :oauth_token, params: {:code => @code, :client_id => @key.key, :client_secret => @key.secret}
      expect(response).to be_successful
      expect(RedisInit.default.get("oauth_#{@code}")).to eq(nil)
      expect(Device.count).to eq(1)
      d = Device.last
      expect(d.permission_scopes).to eq([])
    end
  end

  describe "oauth_token_refresh" do
    it "should ask for refresh on old tokens" do
      token_user
      @device.settings['keys'][-1]['last_timestamp'] = 6.months.ago.to_i  
      @device.save!
      get :token_check, params: {:access_token => @device.tokens[0]}
      json = assert_success_json
      expect(json['authenticated']).to eq(false)
      expect(json['expired']).to eq(true)
      expect(json['can_refresh']).to eq(true)
    end

    it "should allow refreshing an integration token" do
      token_user
      k = DeveloperKey.create
      @device.developer_key_id = k.id
      @device.save!
      token, refresh = @device.tokens
      post :oauth_token_refresh, params: {'access_token' => token, 'refresh_token' => refresh, 'client_id' => k.key, 'client_secret' => k.secret}
      json = assert_success_json
      expect(json['access_token']).to_not eq(token)
      expect(json['refresh_token']).to eq(refresh)
      expect(@device.reload.settings['keys'].length).to eq(2)
      expect(@device.settings['keys'][0]['timestamp']).to eq(@device.settings['keys'][1]['timestamp'])
      expect(@device.settings['keys'][0]['expire_at']).to be > Time.now.to_i
      expect(@device.settings['keys'][0]['expire_at']).to be < 10.minutes.from_now.to_i
    end

    it "should not allow refreshing a non-integration token" do
      token_user
      k = DeveloperKey.create
      token, refresh = @device.tokens
      post :oauth_token_refresh, params: {'access_token' => token, 'refresh_token' => refresh, 'client_id' => k.key, 'client_secret' => k.secret}
      assert_error('invalid_token')
    end

    it "should error on invalid token" do
      token_user
      k = DeveloperKey.create
      token, refresh = @device.tokens
      post :oauth_token_refresh, params: {'access_token' => 'asdf', 'refresh_token' => refresh, 'client_id' => k.key, 'client_secret' => k.secret}
      assert_error('Missing user')
    end

    it "should error on invalid refresh token" do
      token_user
      k = DeveloperKey.create
      @device.developer_key_id = k.id
      @device.save!
      token, refresh = @device.tokens
      post :oauth_token_refresh, params: {'access_token' => token, 'refresh_token' => 'whatever', 'client_id' => k.key, 'client_secret' => k.secret}
      assert_error('Invalid refresh token')
    end

    it "should error on invalid developer key" do
      token_user
      k = DeveloperKey.create
      @device.developer_key_id = k.id
      @device.save!
      token, refresh = @device.tokens
      post :oauth_token_refresh, params: {'access_token' => token, 'refresh_token' => refresh, 'client_id' => 'xxx', 'client_secret' => k.secret}
      assert_error('invalid_key')
    end

    it "should error on invalid developer secret" do
      token_user
      k = DeveloperKey.create
      @device.developer_key_id = k.id
      @device.save!
      token, refresh = @device.tokens
      post :oauth_token_refresh, params: {'access_token' => token, 'refresh_token' => refresh, 'client_id' => k.key, 'client_secret' => 'secret'}
      assert_error('invalid_secret')
    end

    it "should error on mismatched developer key id" do
      token_user
      k = DeveloperKey.create
      token, refresh = @device.tokens
      post :oauth_token_refresh, params: {'access_token' => token, 'refresh_token' => refresh, 'client_id' => k.key, 'client_secret' => k.secret}
      assert_error('invalid_token')
    end
  end

  describe "oauth_logout" do
    it "should require api token" do
      post :oauth_logout
      assert_missing_token
    end
    it "should log out the device" do
      token_user
      post :oauth_logout
      expect(response).to be_successful
      expect(response.body).to eq({logout: true}.to_json)
      expect(@device.reload.settings['keys']).to eq([])
    end
  end

  describe "oauth_local" do
    it "should not require api token" do
      get :oauth_local
      expect(response).to be_successful
    end
  end

  describe "token" do
    it "should not require api token" do
      token = GoSecure.browser_token
      u = User.new(:user_name => "fred")
      u.generate_password("seashell")
      u.save
      post :token, params: {:grant_type => 'password', :client_id => 'browser', :client_secret => token, :username => 'fred', :password => 'seashell'}
      expect(response).to be_successful
    end
    
    it "should set browser token header" do
      post :token
      expect(response.headers['BROWSER_TOKEN']).not_to eq(nil)
    end
    
    it "should allow logging in with username and password only when browser_token is provided" do
      token = GoSecure.browser_token
      u = User.new(:user_name => "fred")
      u.generate_password("seashell")
      u.save
      post :token, params: {:grant_type => 'password', :client_id => 'browser', :client_secret => token, :username => 'fred', :password => 'seashell'}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json['user_name']).to eq('fred')
      expect(json['token_type']).to eq('bearer')
      expect(json['access_token']).not_to eq(nil)
      d = Device.find_by_global_id(json['access_token'])
      expect(d).not_to eq(nil)
      expect(d.developer_key_id).to eq(0)
      expect(d.user).to eq(u)
    end
    
#     it "should not respect expired browser token" do
#       token = 15.days.ago.strftime('%Y%j')
#       token += '-' + GoSecure.sha512(token, 'browser_token')
#       expect(GoSecure.valid_browser_token_signature?(token)).to eq(true)
#       expect(GoSecure.valid_browser_token?(token)).to eq(false)
#       u = User.new(:user_name => "fred")
#       u.generate_password("seashell")
#       u.save
#       post :token, :grant_type => 'password', :client_id => 'browser', :client_secret => token, :username => 'fred', :password => 'seashell'
#       expect(response).not_to be_successful
#       json = JSON.parse(response.body)
#       expect(json['error']).to eq('Invalid authentication attempt')
#     end
    
    it "should error on invalid login attempt" do
      token = GoSecure.browser_token
      u = User.new(:user_name => "fred")
      u.generate_password("seashell")
      u.save
      post :token, params: {:grant_type => 'password', :client_id => 'browser', :client_secret => token, :username => 'fred', :password => 'seashells'}
      expect(response).not_to be_successful
      json = JSON.parse(response.body)
      expect(json['error']).to eq('Invalid authentication attempt')

      post :token, params: {:grant_type => 'password', :client_id => 'browser', :client_secret => token, :username => 'fredx', :password => 'seashell'}
      expect(response).not_to be_successful
      json = JSON.parse(response.body)
      expect(json['error']).to eq('Invalid authentication attempt')
    end
    
    it "should return a json response" do
      token = GoSecure.browser_token
      u = User.new(:user_name => "fred")
      u.generate_password("seashell")
      u.save
      post :token, params: {:grant_type => 'password', :client_id => 'browser', :client_secret => token, :username => 'fred', :password => 'seashell'}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json['user_name']).to eq('fred')
    end
    
    it "should match on accidental capitalization" do
      token = GoSecure.browser_token
      u = User.new(:user_name => "fred")
      u.generate_password("seashell")
      u.save
      post :token, params: {:grant_type => 'password', :client_id => 'browser', :client_secret => token, :username => 'Fred', :password => 'seashell'}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json['user_name']).to eq('fred')
    end
    
    it "should match on email address" do
      token = GoSecure.browser_token
      u = User.new(:user_name => "fred", :settings => {'email' => 'fred@example.com'})
      u.generate_password("seashell")
      u.save
      post :token, params: {:grant_type => 'password', :client_id => 'browser', :client_secret => token, :username => 'fred@example.com', :password => 'seashell'}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json['user_name']).to eq('fred')
    end
    
    it "should not match on email address if more than one user has the same email" do
      token = GoSecure.browser_token
      u = User.new(:user_name => "fred", :settings => {'email' => "fred@example.com"})
      u.generate_password("seashell")
      u.save
      u2 = User.create(:user_name => "fred2", :settings => {:email => "fred@example.com"})
      post :token, params: {:grant_type => 'password', :client_id => 'browser', :client_secret => token, :username => 'fred@example.com', :password => 'seashells'}
      expect(response).not_to be_successful
      json = JSON.parse(response.body)
      expect(json['error']).to eq('Invalid authentication attempt')
    end
    
    it "should create a browser device for the user if not already defined" do
      token = GoSecure.browser_token
      u = User.new(:user_name => "fred")
      u.generate_password("seashell")
      u.save
      expect(Device.count).to eq(0)
      request.headers['X-INSTALLED-COUGHDROP'] = 'false'
      post :token, params: {:grant_type => 'password', :client_id => 'browser', :client_secret => token, :username => 'fred', :password => 'seashell'}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json['access_token']).not_to eq(nil)
      expect(Device.count).to eq(1)
      d = Device.find_by_global_id(json['access_token'])
      expect(d).not_to eq(nil)
      expect(d.token_type).to eq(:browser)
      expect(d.developer_key_id).to eq(0)
      expect(d.default_device?).to eq(true)
      expect(d.user).to eq(u)
    end
    
    it "should use provided ip address and mobile flag" do
      token = GoSecure.browser_token
      u = User.new(:user_name => "fred")
      u.generate_password("seashell")
      u.save
      expect(Device.count).to eq(0)
      post :token, params: {:grant_type => 'password', :client_id => 'browser', :client_secret => token, :username => 'fred', :password => 'seashell', :mobile => 'true'}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json['access_token']).not_to eq(nil)
      expect(Device.count).to eq(1)
      d = Device.find_by_global_id(json['access_token'])
      expect(d).not_to eq(nil)
      expect(d.developer_key_id).to eq(0)
      expect(d.default_device?).to eq(true)
      expect(d.user).to eq(u)
      expect(d.settings['ip_address']).to eq('0.0.0.0')
      expect(d.settings['mobile']).to eq(true)
    end
    
    it "should create a new browser device for the user if specified" do
      token = GoSecure.browser_token
      u = User.new(:user_name => "fred")
      u.generate_password("seashell")
      u.save
      expect(Device.count).to eq(0)
      post :token, params: {:grant_type => 'password', :client_id => 'browser', :client_secret => token, :username => 'fred', :password => 'seashell', :device_id => "1.235532 Cool Browser"}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json['access_token']).not_to eq(nil)
      expect(Device.count).to eq(1)
      d = Device.find_by_global_id(json['access_token'])
      expect(d).not_to eq(nil)
      expect(d.developer_key_id).to eq(0)
      expect(d.user).to eq(u)
      expect(d.settings['name']).to eq("Cool Browser")
      expect(d.default_device?).to eq(false)
      expect(d.system_generated?).to eq(true)
    end
    
    it "should use the existing browser device for the user if already defined" do
      token = GoSecure.browser_token
      u = User.new(:user_name => "fred")
      u.generate_password("seashell")
      u.save
      d = Device.create(:user => u, :device_key => 'default', :developer_key_id => 0)
      d.generate_token!
      expect(Device.count).to eq(1)
      post :token, params: {:grant_type => 'password', :client_id => 'browser', :client_secret => token, :username => 'fred', :password => 'seashell'}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json['access_token']).not_to eq(nil)
      expect(Device.count).to eq(1)
      d2 = Device.find_by_global_id(json['access_token'])
      expect(d2).to eq(d)
    end

    it "should handle long_token for browser" do
      token = GoSecure.browser_token
      u = User.new(:user_name => "fred")
      u.generate_password("seashell")
      u.save
      d = Device.create(:user => u, :device_key => 'default', :developer_key_id => 0)
      d.generate_token!
      expect(Device.count).to eq(1)
      request.headers['X-INSTALLED-COUGHDROP'] = 'false'
      post :token, params: {:grant_type => 'password', :client_id => 'browser', :long_token => true, :client_secret => token, :username => 'fred', :password => 'seashell'}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json['access_token']).not_to eq(nil)
      expect(Device.count).to eq(1)
      d2 = Device.find_by_global_id(json['access_token'])
      expect(d2).to eq(d)
      expect(d.reload.token_type).to eq(:browser)
      expect(d.settings['long_token']).to eq(true)
      expect(d.settings['long_token_set']).to eq(nil)
    end

    it "should handle no long_token for browser" do
      token = GoSecure.browser_token
      u = User.new(:user_name => "fred")
      u.generate_password("seashell")
      u.save
      d = Device.create(:user => u, :device_key => 'default', :developer_key_id => 0)
      d.settings['browser'] = true
      d.generate_token!
      expect(Device.count).to eq(1)
      post :token, params: {:grant_type => 'password', :client_id => 'browser', :client_secret => token, :username => 'fred', :password => 'seashell'}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json['access_token']).not_to eq(nil)
      expect(Device.count).to eq(1)
      d2 = Device.find_by_global_id(json['access_token'])
      expect(d2).to eq(d)
      expect(d.reload.token_type).to eq(:browser)
      expect(d.settings['long_token']).to eq(false)
      expect(d.settings['long_token_set']).to eq(nil)
    end

    it "should handle long_token for app" do
      token = GoSecure.browser_token
      u = User.new(:user_name => "fred")
      u.generate_password("seashell")
      u.save
      d = Device.create(:user => u, :device_key => 'default', :developer_key_id => 0)
      d.generate_token!
      expect(Device.count).to eq(1)
      request.headers['X-INSTALLED-COUGHDROP'] = 'true'
      post :token, params: {:grant_type => 'password', :client_id => 'browser', :long_token => true, :client_secret => token, :username => 'fred', :password => 'seashell'}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json['access_token']).not_to eq(nil)
      expect(Device.count).to eq(1)
      d2 = Device.find_by_global_id(json['access_token'])
      expect(d2).to eq(d)
      expect(d.reload.token_type).to eq(:app)
      expect(d.settings['long_token']).to eq(true)
      expect(d.settings['long_token_set']).to eq(nil)
    end

    it "should handle no long_token for app" do
      token = GoSecure.browser_token
      u = User.new(:user_name => "fred")
      u.generate_password("seashell")
      u.save
      d = Device.create(:user => u, :device_key => 'default', :developer_key_id => 0)
      d.settings['app'] = true
      d.generate_token!
      expect(Device.count).to eq(1)
      post :token, params: {:grant_type => 'password', :client_id => 'browser', :client_secret => token, :username => 'fred', :password => 'seashell'}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json['access_token']).not_to eq(nil)
      expect(Device.count).to eq(1)
      d2 = Device.find_by_global_id(json['access_token'])
      expect(d2).to eq(d)
      expect(d.reload.token_type).to eq(:app)
      expect(d.settings['long_token']).to eq(false)
      expect(d.settings['long_token_set']).to eq(nil)
    end

    it "should note a user name change if the password is correct" do
      token = GoSecure.browser_token
      u = User.new(:user_name => "fred")
      u.generate_password("seashell")
      u.rename_to('freddy')
      u.save
      post :token, params: {:grant_type => 'password', :client_id => 'browser', :client_secret => token, :username => 'fred', :password => 'seashell'}
      expect(response).to_not be_successful
      json = JSON.parse(response.body)
      expect(json['error']).to eq('User name was changed')
      expect(json['user_name']).to eq('freddy')
    end
    
    it "should not note a user name change if the password is incorrect" do
      token = GoSecure.browser_token
      u = User.new(:user_name => "fred")
      u.generate_password("seashell")
      u.rename_to('freddy')
      u.save
      post :token, params: {:grant_type => 'password', :client_id => 'browser', :client_secret => token, :username => 'fred', :password => 'seashells'}
      expect(response).to_not be_success
      json = JSON.parse(response.body)
      expect(json['error']).to eq('Invalid authentication attempt')
    end
    
    it "should throttle to prevent brute force attacks" do
      token = GoSecure.browser_token
      u = User.new(:user_name => "fred")
      u.generate_password("seashell")
      u.save
      10.times do 
        post :token, params: {:grant_type => 'password', :client_id => 'browser', :client_secret => token, :username => 'fred', :password => 'seashell'}
        expect(response).to be_successful
        json = JSON.parse(response.body)
        expect(json['user_name']).to eq('fred')
      end
    end
    
    it "should include permissions scopes in the response" do
      token = GoSecure.browser_token
      u = User.new(:user_name => "fred", :settings => {'email' => 'fred@example.com'})
      u.generate_password("seashell")
      u.save
      post :token, params: {:grant_type => 'password', :client_id => 'browser', :client_secret => token, :username => 'fred@example.com', :password => 'seashell'}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json['scopes']).to eq(['full'])
    end

    it "should make a valid token for an eval login" do
      token = GoSecure.browser_token
      u = User.new(:user_name => "fred", :settings => {'email' => 'fred@example.com'})
      u.subscription_override('eval')
      u.generate_password("seashell")
      u.save
      expect(u.billing_state).to eq(:eval_communicator)
      post :token, params: {:device_id => 'asdf1', :grant_type => 'password', :client_id => 'browser', :client_secret => token, :username => 'fred@example.com', :password => 'seashell'}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json['token_type']).to eq('bearer')
    end

    it "should make a temporary token for a second eval login" do
      token = GoSecure.browser_token
      u = User.new(:user_name => "fred", :settings => {'email' => 'fred@example.com'})
      u.subscription_override('eval')
      u.generate_password("seashell")
      u.save
      expect(u.billing_state).to eq(:eval_communicator)
      post :token, params: {:device_id => 'asdf1', 'installed_app' => 'true', :grant_type => 'password', :client_id => 'browser', :client_secret => token, :username => 'fred@example.com', :password => 'seashell'}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json['token_type']).to eq('bearer')
      d = Device.last
      expect(d.token_type).to eq(:app)

      post :token, params: {:device_id => 'asdf2', 'installed_app' => 'true', :grant_type => 'password', :client_id => 'browser', :client_secret => token, :username => 'fred@example.com', :password => 'seashell'}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json['temporary_device']).to eq(true)
    end

    it "should not count temporary tokens when checking if already logged-in for an eval login" do
      token = GoSecure.browser_token
      u = User.new(:user_name => "fred", :settings => {'email' => 'fred@example.com'})
      u.subscription_override('eval')
      u.generate_password("seashell")
      u.save
      expect(u.billing_state).to eq(:eval_communicator)
      post :token, params: {:device_id => 'asdf1', 'installed_app' => 'true', :grant_type => 'password', :client_id => 'browser', :client_secret => token, :username => 'fred@example.com', :password => 'seashell'}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json['token_type']).to eq('bearer')
      d = Device.last
      expect(d.token_type).to eq(:app)

      post :token, params: {:device_id => 'asdf2', 'installed_app' => 'true', :grant_type => 'password', :client_id => 'browser', :client_secret => token, :username => 'fred@example.com', :password => 'seashell'}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json['temporary_device']).to eq(true)

      d.destroy
      post :token, params: {:device_id => 'asdf3', 'installed_app' => 'true', :grant_type => 'password', :client_id => 'browser', :client_secret => token, :username => 'fred@example.com', :password => 'seashell'}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json['temporary_device']).to_not eq(true)
    end
  end

  describe "token_check" do
    it "should not require api token" do
      get :token_check
      expect(response).to be_successful
    end
    
    it "should set the browser token header" do
      get :token_check
      expect(response.headers['BROWSER_TOKEN']).not_to eq(nil)
    end
    
    it "should check for a valid api token and respond accordingly" do
      get :token_check
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json['authenticated']).to eq(false)
      
      token_user
      get :token_check, params: {:access_token => @device.tokens[0]}
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json['authenticated']).to eq(true)
      expect(json['user_name']).to eq(@user.user_name)
      
      device = Device.find(@device.id)
      expect(device.settings).not_to eq(nil)
      expect(device.settings).not_to eq("null")
      expect(device.settings['keys'][0]['value']).to eq(@device.tokens[0])
    end

    it "should error correctly (honor skip_on_token_check) on expired or invalid tokens" do
      token_user
      d = @user.devices[0]
      d.settings['disabled'] = true
      d.save
      get :token_check, params: {:access_token => @device.tokens[0]}
      expect(response).to be_successful
      expect(assigns[:cached]).to eq(nil)
      json = JSON.parse(response.body)
      expect(json['authenticated']).to eq(false)
    end

    it "should used cached values on repeat requests" do
      token_user
      get :token_check, params: {:access_token => @device.tokens[0]}
      expect(response).to be_successful
      expect(assigns[:cached]).to eq(nil)
      json = JSON.parse(response.body)
      expect(json['authenticated']).to eq(true)
      expect(json['user_name']).to eq(@user.user_name)

      get :token_check, params: {:access_token => @device.tokens[0]}
      expect(assigns[:cached]).to eq(true)
      expect(response).to be_successful
      json = JSON.parse(response.body)
      expect(json['authenticated']).to eq(true)
      expect(json['user_name']).to eq(@user.user_name)
    end

    it "should notify if the token is expired" do
      token_user
      token = @device.tokens[0]
      @device.settings['keys'][-1]['timestamp'] = 10.years.ago.to_i  
      @device.settings['long_token'] = false
      @device.save!
      expect(@device.token_timeout).to eq(28.days.to_i)
      get :token_check, params: {:access_token => token}
      json = assert_success_json
      expect(json['authenticated']).to eq(false)
      expect(json['expired']).to eq(true)
      expect(json['can_refresh']).to eq(nil)
    end

    it "should notify if the token has been inactive too long" do
      token_user
      @device.settings['keys'][-1]['last_timestamp'] = 6.months.ago.to_i  
      @device.save!
      get :token_check, params: {:access_token => @device.tokens[0]}
      json = assert_success_json
      expect(json['authenticated']).to eq(false)
      expect(json['expired']).to eq(true)
      expect(json['can_refresh']).to eq(true)
    end
  end

  describe "auth_admin" do
    it "should require an api tokne" do
      post :auth_admin
      json = assert_success_json
      expect(json['success']).to eq(false)
    end

    it "should require admin role" do
      token_user
      post :auth_admin
      json = assert_success_json
      expect(json['success']).to eq(false)
    end

    it "should set a cookie and return success" do
      token_user
      @user.settings['admin'] = true
      @user.save
      post :auth_admin
      json = assert_success_json
      expect(json['success']).to eq(true)
      expect(response.cookies['admin_token']).to_not eq(nil)
      user_id = Permissable.permissions_redis.get("/admin/auth/#{response.cookies['admin_token']}")
      expect(user_id).to eq(@user.global_id)
    end
  end
end
