class SubscriptionMailer < ActionMailer::Base
  include General
  default from: ENV['DEFAULT_EMAIL_FROM']
  layout 'email'
  
  def chargeback_created(user_id)
    @user = User.find_by_global_id(user_id)
    if ENV['SYSTEM_ERROR_EMAIL']
      mail(to: ENV['SYSTEM_ERROR_EMAIL'], subject: "CoughDrop - Chargeback Created")
    end
  end

  def subscription_pause_failed(user_id)
    @user = User.find_by_global_id(user_id)
    if ENV['SYSTEM_ERROR_EMAIL']
      mail(to: ENV['SYSTEM_ERROR_EMAIL'], subject: "CoughDrop - Subscription Pause Failed")
    end
  end

  def new_subscription(user_id)
    @user = User.find_by_global_id(user_id)
    d = @user.devices[0]
    ip = d && d.settings['ip_address']
    @location = nil
    if ip && ENV['IPSTACK_KEY']
      url = "http://api.ipstack.com/#{ip}?access_key=#{ENV['IPSTACK_KEY']}"
      begin
        res = Typhoeus.get(url)
        json = JSON.parse(res.body)
        @location = json && "#{json['city']}, #{json['region_name']}, #{json['country_code']}"
      rescue => e
      end
    end
    @subscription = @user.subscription_hash
    if ENV['NEW_REGISTRATION_EMAIL']
      subj = "CoughDrop - New Subscription"
      if @user.purchase_credit_duration > 1.week
        subj = "CoughDrop - Updated Subscription"
      end
      mail(to: ENV['NEW_REGISTRATION_EMAIL'], subject: subj)
    end
  end
  
  def subscription_resume_failed(user_id)
    @user = User.find_by_global_id(user_id)
    mail_message(@user, "Subscription Needs Attention")
  end
  
  def purchase_bounced(user_id)
    @user = User.find_by_global_id(user_id)
    mail_message(@user, "Problem with your Subscription")
  end
  
  def purchase_confirmed(user_id)
    @user = User.find_by_global_id(user_id)
    mail_message(@user, "Purchase Confirmed")
  end
  
  def expiration_approaching(user_id)
    @user = User.find_by_global_id(user_id)
    mail_message(@user, @user && @user.grace_period? ? "Trial Ending" : "Billing Notice")
  end
  
  def one_day_until_expiration(user_id)
    @user = User.find_by_global_id(user_id)
    mail_message(@user, @user && @user.grace_period? ? "Trial Ending" : "Billing Notice")
  end
  
  def one_week_until_expiration(user_id)
    @user = User.find_by_global_id(user_id)
    mail_message(@user, @user && @user.grace_period? ? "Trial Ending" : "Billing Notice")
  end
  
  def subscription_expired(user_id)
    @user = User.find_by_global_id(user_id)
    mail_message(@user, "Subscription Expired")
  end

  def subscription_expiring(user_id)
    @user = User.find_by_global_id(user_id)
    mail_message(@user, "Subscription Needs Attention")
  end
  
  def gift_created(gift_id)
    @gift = GiftPurchase.find_by_global_id(gift_id)
    subject = "CoughDrop - Gift Created"
    subject = "CoughDrop - Bulk Purchase" if @gift.bulk_purchase?
    email = @gift.bulk_purchase? ? @gift.settings['email'] : @gift.settings['giver_email']
    mail(to: email, subject: subject)
  end
  
  def gift_redeemed(gift_id)
    @gift = GiftPurchase.find_by_global_id(gift_id)
    @recipient = @gift.receiver
    mail(to: @gift.settings['giver_email'], subject: "CoughDrop - Gift Redeemed")
  end
  
  def gift_seconds_added(gift_id)
    @gift = GiftPurchase.find_by_global_id(gift_id)
    @recipient = @gift.receiver
    mail_message(@recipient, "Gift Purchase Received")
  end
  
  def gift_updated(gift_id, action)
    @action_type = "Purchased"
    @action_type = "Redeemed" if action == 'redeem'
    @gift = GiftPurchase.find_by_global_id(gift_id)
    subject = "CoughDrop - Gift #{@action_type}"
    subject = "CoughDrop - Bulk Purchase" if @gift.bulk_purchase?
    if ENV['NEW_REGISTRATION_EMAIL']
      mail(to: ENV['NEW_REGISTRATION_EMAIL'], subject: subject)
    end
  end

  def extras_purchased(user_id)
    @user = User.find_by_global_id(user_id)
    mail_message(@user, "Premium Symbols Access Purchased")
  end

  def deletion_warning(user_id, attempts)
    @user = User.find_by_global_id(user_id)
    @attempt = attempts
    mail_message(@user, "Account Deletion Notice")
  end

  def account_deleted(user_id)
    @user = User.find_by_global_id(user_id)
    mail_message(@user, "Account Deleted")
  end
end
