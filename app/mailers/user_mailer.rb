class UserMailer < ActionMailer::Base
  include General
  default from: "CoughDrop <brian@coughdropaac.com>"
  layout 'email'
  
  def self.bounce_email(email)
    hash = User.generate_email_hash(email)
    users = User.where(:email_hash => hash)
    users.each do |user|
      user.settings['email_disabled'] = true
      user.save
    end
  end
  
  def new_user_registration(user_id)
    @user = User.find_by_global_id(user_id)
    if ENV['NEW_REGISTRATION_EMAIL']
      mail(to: ENV['NEW_REGISTRATION_EMAIL'], subject: "CoughDrop - New User Registration", reply_to: @user.settings['email'])
    end
  end

  def password_changed(user_id)
    @user = User.find_by_global_id(user_id)
    mail_message(@user, "Password Changed")
  end
  
  def email_changed(user_id)
    @user = User.find_by_global_id(user_id)
    mail_message(@user, "Email Changed")
    @old_email = true
    mail_message(@user, "Email Changed", 'email_changed_prior_address')
  end
  
  def confirm_registration(user_id)
    @user = User.find_by_global_id(user_id)
    mail_message(@user, "Welcome!")
  end
  
  def login_no_user(email)
    @email = email
    mail(to: email, subject: "CoughDrop - Login Help")
  end
  
  def forgot_password(user_ids)
    @users = User.find_all_by_global_id(:id => user_ids)
    @user = @users.first if @users.length == 1
    mail_message(@user, "Forgot Password Confirmation")
  end
  
  def log_message(user_id, log_id)
    @user = User.find_by_global_id(user_id)
    @log = LogSession.find_by_global_id(log_id)
    @author = @log.author
    @target = @log.user
    mail_message(@user, "New Message")
  end
  
  def usage_reminder(user_id)
    @user = User.find_by_global_id(user_id)
    
    @logging_disabled = !@user.settings['preferences']['logging']
    @no_recent_activity = @user.devices.all?{|d| d.updated_at < 4.days.ago}
    @no_home_board = @user.settings['preferences']['home_board']
    @supporter_no_supervisees = @user.settings['preferences']['role'] == 'supporter' && @user.supervised_user_ids.empty?
    @no_subscription = @user.grace_period?

    mail_message(@user, "Checking In")
  end
  
  def utterance_share(opts)
    @user = User.find_by_global_id(opts['sharer_id'])
    @message = opts['message'] || "no message"
    mail(to: opts['to'], subject: opts['subject'], reply_to: @user.settings['email'])
  end
  
  def organization_assigned(user_id, org_id)
    @user = User.find_by_global_id(user_id)
    @org = Organization.find_by_global_id(org_id)
    mail_message(@user, "Organization Sponsorship Added")
  end
  
  def organization_unassigned(user_id, org_id)
    @user = User.find_by_global_id(user_id)
    @org = Organization.find_by_global_id(org_id)
    mail_message(@user, "Organization Sponsorship Removed")
  end
end
