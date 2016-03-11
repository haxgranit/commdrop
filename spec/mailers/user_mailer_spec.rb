require "spec_helper"

describe UserMailer, :type => :mailer do
  describe "schedule_delivery" do
    it "should schedule deliveries" do
      UserMailer.schedule_delivery('confirm_registration', 4)
      expect(Worker.scheduled?(UserMailer, :deliver_message, 'confirm_registration', 4)).to eq(true)
    end
  end
  
  describe "bounce_email" do
    it "should not error on no results" do
      expect { UserMailer.bounce_email(nil) }.not_to raise_error
      expect { UserMailer.bounce_email("bob.miller@example.com") }.not_to raise_error
    end
    it "should set email as disabled for any matching emails" do
      u = User.create(:settings => {'email' => 'bob.miller@example.com'})
      UserMailer.bounce_email("bob.miller@example.com")
      expect(u.reload.settings['email_disabled']).to eq(true)

      u2 = User.create(:settings => {'email' => 'bob.miller@example.com'})
      u3 = User.create(:settings => {'email' => 'bob.miller@example.com'})
      UserMailer.bounce_email("bob.miller@example.com")
      expect(u2.reload.settings['email_disabled']).to eq(true)
      expect(u3.reload.settings['email_disabled']).to eq(true)
    end
  end

  describe "deliver_message" do
    it "should deliver the correct message" do
      obj = Object.new
      expect(obj).to receive(:deliver)
      expect(UserMailer).to receive(:confirm_registration).with(5).and_return(obj)
      UserMailer.deliver_message('confirm_registration', 5)

      obj = Object.new
      expect(obj).to receive(:deliver)
      expect(UserMailer).to receive(:forgot_password).with([5, 6]).and_return(obj)
      UserMailer.deliver_message('forgot_password', [5, 6])
    end
  end
  
  describe "confirm_registration" do
    it "should find the correct user" do
      u = User.create
      expect_any_instance_of(User).to receive(:named_email).and_return("bob@example.com")
      m = UserMailer.confirm_registration(u.global_id)
      expect(m.subject).to eq("CoughDrop - Welcome!")
      expect(m.to).to eq(["bob@example.com"])
      html = message_body(m, :html)
      expect(html).to match(/Welcome to CoughDrop!/)
      expect(html).to match(/<b>#{u.user_name}<\/b>/)
      text = message_body(m, :text)
      expect(text).to match(/Welcome to CoughDrop!/)
      expect(text).to match(/\"#{u.user_name}\"/)
    end
  end
  
  describe "forgot_password" do
    it "should find the correct user" do
      u = User.create
      expect_any_instance_of(User).to receive(:named_email).and_return("bob@example.com")
      m = UserMailer.forgot_password([u.global_id])
      expect(m.subject).to eq("CoughDrop - Forgot Password Confirmation")
      expect(m.to).to eq(["bob@example.com"])
      html = message_body(m, :html)
      expect(html).to match(/password reset/)
      expect(html).to match(/<b>#{u.user_name}<\/b>/)
      text = message_body(m, :text)
      expect(text).to match(/password reset/)
      expect(text).to match(/\"#{u.user_name}\"/)
    end
  end
  
  describe "login_no_user" do
    it "should send a message" do
      m = UserMailer.login_no_user('bacon@example.com')
      expect(m.subject).to eq("CoughDrop - Login Help")
      expect(m.to).to eq(["bacon@example.com"])
      html = message_body(m, :html)
      expect(html).to match(/sign up for a free trial/)
      expect(html).to match(/<b>bacon@example.com<\/b>/)
      text = message_body(m, :text)
      expect(text).to match(/sign up for a free trial/)
      expect(text).to match(/\"bacon@example.com\"/)
    end
  end
  
  describe "password_changed" do
    it "should find the correct user" do
      u = User.create
      expect_any_instance_of(User).to receive(:named_email).and_return("bob@example.com")
      m = UserMailer.password_changed(u.global_id)
      expect(m.subject).to eq("CoughDrop - Password Changed")
      expect(m.to).to eq(["bob@example.com"])
      html = message_body(m, :html)
      expect(html).to match(/password change/)
      expect(html).to match(/<b>#{u.user_name}<\/b>/)
      
      text = message_body(m, :text)
      expect(text).to match(/password change/)
      expect(text).to match(/\"#{u.user_name}\"/)
    end
  end
  
  describe "email_changed" do
    it "should email both addresses" do
      u = User.create
      expect_any_instance_of(User).to receive(:named_email).and_return("bob@example.com")
      expect_any_instance_of(User).to receive(:prior_named_email).and_return("fred@example.com")
      m = UserMailer.email_changed(u.global_id)
      expect(m.subject).to eq("CoughDrop - Email Changed")
      expect(m.to).to eq(["fred@example.com"])
      html = message_body(m, :html)
      expect(html).to match(/email address change/)
      expect(html).to match(/<b>#{u.user_name}<\/b>/)
      
      text = message_body(m, :text)
      expect(text).to match(/email address change/)
      expect(text).to match(/"#{u.user_name}"/)
    end
  end
  
  describe "log_message" do
    it "should email the right address" do
      u = User.create
      d = Device.create(:user => u)
      l = LogSession.create(:user => u, :author => u, :device => d)
      l.data['note'] = {'text' => "you are my friend"}
      l.save
      expect_any_instance_of(User).to receive(:named_email).and_return("bob@example.com")
      m = UserMailer.log_message(u.global_id, l.global_id)
      expect(m.subject).to eq("CoughDrop - New Message")
      expect(m.to).to eq(["bob@example.com"])
      
      html = message_body(m, :html)
      expect(html).to match(/just posted a message/)
      expect(html).to match(/you are my friend/)
      
      text = message_body(m, :text)
      expect(text).to match(/just posted a message/)
      expect(text).to match(/you are my friend/)
    end
    
    it "should not email anyone if the email is disabled" do
      u = User.create
      d = Device.create(:user => u)
      l = LogSession.create(:user => u, :author => u, :device => d)
      u.settings['email_disabled'] = true
      u.save
      m = UserMailer.log_message(u.global_id, l.global_id)
      expect(m.subject).to eq(nil)
    end
  end
  
  describe "new_user_registration" do
    it "should use the ENV recipient address" do
      u = User.create
      ENV['NEW_REGISTRATION_EMAIL'] = 'asdf@example.com'
      m = UserMailer.new_user_registration(u.global_id)
      expect(m.to).to eq(['asdf@example.com'])
    end
    
    it "should generate a message" do
      u = User.create
      ENV['NEW_REGISTRATION_EMAIL'] = 'asdf@example.com'
      m = UserMailer.new_user_registration(u.global_id)
      expect(m.subject).to eq('CoughDrop - New User Registration')
      html = message_body(m, :html)
      expect(html).to match(/just signed up/)
      expect(html).to match(/#{u.user_name}/)
      
      text = message_body(m, :text)
      expect(text).to match(/just signed up/)
      expect(html).to match(/#{u.user_name}/)
    end
  end
  
  describe "organization_assigned" do
    it "generate the correct message" do
      u = User.create(:settings => {'name' => 'fred', 'email' => 'fred@example.com'})
      o = Organization.create
      m = UserMailer.organization_assigned(u.global_id, o.global_id)
      expect(m.to).to eq(['fred@example.com'])
      expect(m.subject).to eq("CoughDrop - Organization Sponsorship Added")
      
      html = message_body(m, :html)
      expect(html).to match(/added you to their list of supported users/)
      expect(html).to match(/<b>fred<\/b>/)
      expect(html).to match(/<b>#{o.settings['name']}<\/b>/)
      
      text = message_body(m, :text)
      expect(text).to match(/added you to their list of supported users/)
      expect(text).to match(/"fred"/)
      expect(text).to match(/"#{o.settings['name']}"/)
    end
  end
  
  describe "organization_unassigned" do
    it "should generate the correct message" do
      u = User.create(:settings => {'name' => 'fred', 'email' => 'fred@example.com'})
      o = Organization.create
      m = UserMailer.organization_unassigned(u.global_id, o.global_id)
      expect(m.to).to eq(['fred@example.com'])
      expect(m.subject).to eq("CoughDrop - Organization Sponsorship Removed")
      
      html = message_body(m, :html)
      expect(html).to match(/was just removed from the supported list by an organization/)
      expect(html).to match(/<b>fred<\/b>/)
      expect(html).to match(/<b>#{o.settings['name']}<\/b>/)
      
      text = message_body(m, :text)
      expect(text).to match(/was just removed from the supported list by an organization/)
      expect(text).to match(/"fred"/)
      expect(text).to match(/"#{o.settings['name']}"/)
    end
  end
  
  describe "usage_reminder" do
    it "should generate a message to the specified user" do
      u = User.create(:settings => {'name' => 'stacy', 'email' => 'stacy@example.com'})
      m = UserMailer.usage_reminder(u.global_id)
      expect(m.to).to eq(['stacy@example.com'])
      expect(m.subject).to eq("CoughDrop - Checking In")

      html = message_body(m, :html)
      expect(html).to match(/Hello again/)
      
      text = message_body(m, :text)
      expect(text).to match(/Hello again/)
    end
    
    it "should include logging notes only if logging is disabled" do
      u = User.create(:settings => {'name' => 'stacy', 'email' => 'stacy@example.com'})
      m = UserMailer.usage_reminder(u.global_id)
      expect(m.to).to eq(['stacy@example.com'])
      expect(m.subject).to eq("CoughDrop - Checking In")

      html = message_body(m, :html)
      expect(html).to match(/Hello again/)
      expect(html).to match(/reporting and logging built-in/)
      
      text = message_body(m, :text)
      expect(text).to match(/Hello again/)
      expect(text).to match(/reporting and logging built-in/)
      
      u.settings['preferences']['logging'] = true
      u.save
      m = UserMailer.usage_reminder(u.global_id)
      expect(m.to).to eq(['stacy@example.com'])
      expect(m.subject).to eq("CoughDrop - Checking In")

      html = message_body(m, :html)
      expect(html).to match(/Hello again/)
      expect(html).not_to match(/reporting and logging built-in/)
      
      text = message_body(m, :text)
      expect(text).to match(/Hello again/)
      expect(text).not_to match(/reporting and logging built-in/)
    end
    
    it "should include supervision notes only if appropriate" do
      u = User.create(:settings => {'name' => 'stacy', 'email' => 'stacy@example.com'})
      m = UserMailer.usage_reminder(u.global_id)
      expect(m.to).to eq(['stacy@example.com'])
      expect(m.subject).to eq("CoughDrop - Checking In")

      html = message_body(m, :html)
      expect(html).to match(/Hello again/)
      expect(html).to match(/haven't had much chance/)
      
      text = message_body(m, :text)
      expect(text).to match(/Hello again/)
      expect(text).not_to match(/signed up as a supervisor/)
      expect(text).to match(/haven't had much chance/)
      
      u.settings['preferences']['role'] = 'supporter'
      u.save
      m = UserMailer.usage_reminder(u.global_id)
      expect(m.to).to eq(['stacy@example.com'])
      expect(m.subject).to eq("CoughDrop - Checking In")

      html = message_body(m, :html)
      expect(html).to match(/Hello again/)
      expect(html).to match(/signed up as a supervisor/)
      expect(html).not_to match(/haven't had much chance/)
      
      text = message_body(m, :text)
      expect(text).to match(/Hello again/)
      expect(text).to match(/signed up as a supervisor/)
      expect(text).not_to match(/haven't had much chance/)
      
      u2 = User.create
      User.link_supervisor_to_user(u, u2)
      m = UserMailer.usage_reminder(u.global_id)
      expect(m.to).to eq(['stacy@example.com'])
      expect(m.subject).to eq("CoughDrop - Checking In")

      html = message_body(m, :html)
      expect(html).to match(/Hello again/)
      expect(html).not_to match(/signed up as a supervisor/)
      expect(html).to match(/haven't had much chance/)
      
      text = message_body(m, :text)
      expect(text).to match(/Hello again/)
      expect(text).not_to match(/signed up as a supervisor/)
      expect(text).to match(/haven't had much chance/)
    end
    
    it "should include subscription notes only of not subscribed" do
      u = User.create(:settings => {'name' => 'stacy', 'email' => 'stacy@example.com'})
      m = UserMailer.usage_reminder(u.global_id)
      expect(m.to).to eq(['stacy@example.com'])
      expect(m.subject).to eq("CoughDrop - Checking In")

      html = message_body(m, :html)
      expect(html).to match(/Hello again/)
      expect(html).to match(/keep using CoughDrop/)
      
      text = message_body(m, :text)
      expect(text).to match(/Hello again/)
      expect(text).to match(/keep using CoughDrop/)
      
      u.expires_at = nil
      u.save
      m = UserMailer.usage_reminder(u.global_id)
      expect(m.to).to eq(['stacy@example.com'])
      expect(m.subject).to eq("CoughDrop - Checking In")

      html = message_body(m, :html)
      expect(html).to match(/Hello again/)
      expect(html).not_to match(/keep using CoughDrop/)
      
      text = message_body(m, :text)
      expect(text).to match(/Hello again/)
      expect(text).not_to match(/keep using CoughDrop/)      
    end
  end
  
  describe "utterance_share" do
    it "should generate a message to the intended user" do
      u = User.create(:settings => {'name' => 'stacy', 'email' => 'stacy@example.com'})
      m = UserMailer.utterance_share({'sharer_id' => u.global_id, 'message' => 'bacon', 'to' => 'fred@example.com', 'subject' => 'something'})
      
      expect(m.to).to eq(['fred@example.com'])
      expect(m.subject).to eq("something")

      html = message_body(m, :html)
      expect(html).to match(/bacon/)
      
      text = message_body(m, :text)
      expect(text).to match(/bacon/)
    end
  end
  
  it "should have a default reply-to of noreply@mycoughdrop.com"
  it "should have specs for the mailer erb templates"
end
