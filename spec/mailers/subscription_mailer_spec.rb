require "spec_helper"

describe SubscriptionMailer, :type => :mailer do
  describe "one_day_until_expiration" do
    it "should generate the correct message" do
      u = User.create(:settings => {'name' => 'fred', 'email' => 'fred@example.com'})
      m = SubscriptionMailer.one_day_until_expiration(u.global_id)
      expect(m.to).to eq([u.settings['email']])
      expect(m.subject).to eq("CoughDrop - Subscription Notice")
      
      html = message_body(m, :html)
      expect(html).to match(/set to expire/)
      expect(html).to match(/#{u.expires_at.to_s(:long_ordinal)}/)
      expect(html).to match(/<b>#{u.settings['name']}<\/b>/)
      
      text = message_body(m, :text)
      expect(text).to match(/set to expire/)
      expect(text).to match(/#{u.expires_at.to_s(:long_ordinal)}/)
      expect(text).to match(/"#{u.settings['name']}"/)
    end
  end
  
  describe "expiration_approaching" do
    it "should generate the correct message" do
      u = User.create(:expires_at => Date.parse('June 1, 2015'), :settings => {'email' => 'fred@example.com'})
      m = SubscriptionMailer.expiration_approaching(u.global_id)
      expect(m.to).to eq([u.settings['email']])
      expect(m.subject).to eq("CoughDrop - Subscription Notice")
      
      html = message_body(m, :html)
      expect(html).to match(/#{u.user_name}/)
      expect(html).to match(/#{u.expires_at.to_s(:long_ordinal)}/)
      expect(html).to match(/to be updated soon/)
      
      text = message_body(m, :text)
      expect(text).to match(/#{u.user_name}/)
      expect(text).to match(/#{u.expires_at.to_s(:long_ordinal)}/)
      expect(text).to match(/to be updated soon/)
    end
  end
  
  describe "one_week_until_expiration" do
    it "should generate the correct message" do
      u = User.create(:settings => {'name' => 'fred', 'email' => 'fred@example.com'})
      m = SubscriptionMailer.one_week_until_expiration(u.global_id)
      expect(m.to).to eq([u.settings['email']])
      expect(m.subject).to eq("CoughDrop - Subscription Notice")
      
      html = message_body(m, :html)
      expect(html).to match(/about to expire/)
      expect(html).to match(/#{u.expires_at.to_s(:long_ordinal)}/)
      expect(html).to match(/<b>#{u.settings['name']}<\/b>/)
      
      text = message_body(m, :text)
      expect(text).to match(/about to expire/)
      expect(text).to match(/#{u.expires_at.to_s(:long_ordinal)}/)
      expect(text).to match(/"#{u.settings['name']}"/)
    end
  end
  
  describe "purchase_bounced" do
    it "should generate the correct message" do
      u = User.create(:settings => {'name' => 'fred', 'email' => 'fred@example.com'})
      m = SubscriptionMailer.purchase_bounced(u.global_id)
      expect(m.to).to eq([u.settings['email']])
      expect(m.subject).to eq("CoughDrop - Problem with your Subscription")
      
      html = message_body(m, :html)
      expect(html).to match(/there was an unexpected problem/)
      expect(html).to match(/<b>#{u.settings['name']}<\/b>/)
      
      text = message_body(m, :text)
      expect(text).to match(/there was an unexpected problem/)
      expect(text).to match(/"#{u.settings['name']}"/)
    end  end
  
  describe "purchase_confirmed" do
    it "should generate the correct message" do
      u = User.create(:settings => {'name' => 'fred', 'email' => 'fred@example.com'})
      m = SubscriptionMailer.purchase_confirmed(u.global_id)
      expect(m.to).to eq([u.settings['email']])
      expect(m.subject).to eq("CoughDrop - Subscription Confirmed")
      
      html = message_body(m, :html)
      expect(html).to match(/Thank you for subscribing to CoughDrop/)
      expect(html).to match(/<b>#{u.settings['name']}<\/b>/)
      
      text = message_body(m, :text)
      expect(text).to match(/Thank you for subscribing to CoughDrop/)
      expect(text).to match(/"#{u.settings['name']}"/)
    end  end
  
  describe "subscription_expired" do
    it "should generate the correct message" do
      u = User.create(:settings => {'name' => 'fred', 'email' => 'fred@example.com'})
      m = SubscriptionMailer.subscription_expired(u.global_id)
      expect(m.to).to eq([u.settings['email']])
      expect(m.subject).to eq("CoughDrop - Subscription Expired")
      
      html = message_body(m, :html)
      expect(html).to match(/account will no longer have premium account access/)
      expect(html).to match(/<b>#{u.settings['name']}<\/b>/)
      
      text = message_body(m, :text)
      expect(text).to match(/account will no longer have premium account access/)
      expect(text).to match(/"#{u.settings['name']}"/)
    end
  end
  
  describe "new_subscription" do
    it "should generate the correct message" do
      ENV['NEW_REGISTRATION_EMAIL'] = "nobody@example.com"
      u = User.create(:settings => {'name' => 'fred', 'email' => 'fred@example.com'})
      m = SubscriptionMailer.new_subscription(u.global_id)
      expect(m.to).to eq(["nobody@example.com"])
      expect(m.subject).to eq("CoughDrop - New Subscription")
      
      html = m.body.to_s
      expect(html).to match(/just updated their CoughDrop subscription/)
      expect(html).to match(/#{u.user_name}<\/a>/)
    end  
  end
 
  describe "subscription_pause_failed" do
    it "should generate the correct message" do
      ENV['SYSTEM_ERROR_EMAIL'] = "nobody@example.com"
      u = User.create(:settings => {'name' => 'fred', 'email' => 'fred@example.com'})
      m = SubscriptionMailer.subscription_pause_failed(u.global_id)
      expect(m.to).to eq(["nobody@example.com"])
      expect(m.subject).to eq("CoughDrop - Subscription Pause Failed")
      
      html = message_body(m, :html)
      expect(html).to match(/problem trying to pause the subscription/)
      expect(html).to match(/<b>#{u.settings['name']}<\/b>/)
      
      text = message_body(m, :text)
      expect(text).to match(/problem trying to pause the subscription/)
      expect(text).to match(/"#{u.settings['name']}"/)
    end  
  end
  
  describe "subscription_resume_failed" do
    it "should generate the correct message" do
      u = User.create(:settings => {'name' => 'fred', 'email' => 'fred@example.com'})
      m = SubscriptionMailer.subscription_resume_failed(u.global_id)
      expect(m.to).to eq([u.settings['email']])
      expect(m.subject).to eq("CoughDrop - Subscription Needs Attention")
      
      html = message_body(m, :html)
      expect(html).to match(/tried to auto-resume the subscription/)
      expect(html).to match(/<b>#{u.settings['name']}<\/b>/)
      
      text = message_body(m, :text)
      expect(text).to match(/tried to auto-resume the subscription/)
      expect(text).to match(/"#{u.settings['name']}"/)
    end
  end
  
  describe "chargeback_created" do
    it "should generate the correct message" do
      ENV['SYSTEM_ERROR_EMAIL'] = "nobody@example.com"
      u = User.create(:settings => {'name' => 'fred', 'email' => 'fred@example.com'})
      m = SubscriptionMailer.chargeback_created(u.global_id)
      expect(m.to).to eq(["nobody@example.com"])
      expect(m.subject).to eq("CoughDrop - Chargeback Created")
      
      html = message_body(m, :html)
      expect(html).to match(/chargeback event for a purchase triggered/)
      expect(html).to match(/<b>#{u.settings['name']}<\/b>/)
      
      text = message_body(m, :text)
      expect(text).to match(/chargeback event for a purchase triggered/)
      expect(text).to match(/"#{u.settings['name']}"/)
    end
  end
  
  describe "subscription_expiring" do
    it "should generate the correct message" do
      u = User.create(:settings => {'name' => 'fred', 'email' => 'fred@example.com'})
      m = SubscriptionMailer.subscription_expiring(u.global_id)
      expect(m.to).to eq([u.settings['email']])
      expect(m.subject).to eq("CoughDrop - Subscription Needs Attention")
      
      html = message_body(m, :html)
      expect(html).to match(/an error handling the current subscription/)
      expect(html).to match(/<b>#{u.settings['name']}<\/b>/)
      
      text = message_body(m, :text)
      expect(text).to match(/an error handling the current subscription/)
      expect(text).to match(/"#{u.settings['name']}"/)
    end
  end

  describe "gift_created" do
    it "should generate the correct message" do
      giver = User.create(:settings => {'email' => 'fred@example.com'})
      gift = GiftPurchase.process_new({}, {
        'giver' => giver,
        'email' => 'bob@example.com',
        'seconds' => 2.years.to_i
      })
      m = SubscriptionMailer.gift_created(gift.global_id)
      expect(m.to).to eq(['bob@example.com'])
      expect(m.subject).to eq("CoughDrop - Gift Created")

      html = message_body(m, :html)
      expect(html).to match(/purchasing CoughDrop as a gift for someone else/)
      expect(html).to match(/<b>#{gift.code}<\/b>/)
      expect(html).to match(/2 years/)
      
      text = message_body(m, :text)
      expect(text).to match(/purchasing CoughDrop as a gift for someone else/)
      expect(text).to match(/"#{gift.code}"/)
      expect(text).to match(/2 years/)
    end
  end
  
  describe "gift_redeemed" do
    it "should generate the correct message" do
      giver = User.create(:settings => {'email' => 'fred@example.com'})
      recipient = User.create(:settings => {'email' => 'susan@example.com'})
      
      gift = GiftPurchase.process_new({}, {
        'giver' => giver,
        'email' => 'bob@example.com',
        'seconds' => 4.years.to_i
      })
      gift.settings['receiver_id'] = recipient.global_id
      gift.save
      
      m = SubscriptionMailer.gift_redeemed(gift.global_id)
      expect(m.to).to eq(['bob@example.com'])
      expect(m.subject).to eq("CoughDrop - Gift Redeemed")

      html = message_body(m, :html)
      expect(html).to match(/notice that the gift you purchased/)
      expect(html).to match(/<b>#{gift.code}<\/b>/)
      expect(html).to match(/4 years/)
      
      text = message_body(m, :text)
      expect(text).to match(/notice that the gift you purchased/)
      expect(text).to match(/"#{gift.code}"/)
      expect(text).to match(/4 years/)
    end
  end
  
  describe "gift_seconds_added" do
    it "should generate the correct message" do
      giver = User.create(:settings => {'email' => 'fred@example.com'})
      recipient = User.create(:settings => {'email' => 'susan@example.com'})
      
      gift = GiftPurchase.process_new({}, {
        'giver' => giver,
        'email' => 'bob@example.com',
        'seconds' => 3.years.to_i
      })
      gift.settings['receiver_id'] = recipient.global_id
      gift.save
      
      m = SubscriptionMailer.gift_seconds_added(gift.global_id)
      expect(m.to).to eq(['susan@example.com'])
      expect(m.subject).to eq("CoughDrop - Gift Purchase Received")

      html = message_body(m, :html)
      expect(html).to match(/you recently redeemed a gift code/)
      expect(html).to match(/<b>#{gift.code}<\/b>/)
      expect(html).to match(/3 years/)
      
      text = message_body(m, :text)
      expect(text).to match(/you recently redeemed a gift code/)
      expect(text).to match(/"#{gift.code}"/)
      expect(text).to match(/3 years/)
    end
  end
  
  describe "gift_updated" do
    it "should generate the creation message when specified" do
      ENV['NEW_REGISTRATION_EMAIL'] = "nobody@example.com"
      giver = User.create(:settings => {'email' => 'fred@example.com'})
      recipient = User.create(:settings => {'email' => 'susan@example.com'})
      
      gift = GiftPurchase.process_new({}, {
        'giver' => giver,
        'email' => 'bob@example.com',
        'seconds' => 3.years.to_i
      })
      gift.save
      
      m = SubscriptionMailer.gift_updated(gift.global_id, 'purchase')
      expect(m.to).to eq(['nobody@example.com'])
      expect(m.subject).to eq("CoughDrop - Gift Purchased")

      html = m.body.to_s
      expect(html).to match(/Giver: #{giver.user_name}/)
      expect(html).to_not match(/Recipient:/)
      expect(html).to match(/<b>#{gift.code}<\/b>/)
      expect(html).to match(/Duration: 3 years/)
    end
    
    it "should generate the redeemed message when specified" do
      ENV['NEW_REGISTRATION_EMAIL'] = "nobody@example.com"
      giver = User.create(:settings => {'email' => 'fred@example.com'})
      recipient = User.create(:settings => {'email' => 'susan@example.com'})
      
      gift = GiftPurchase.process_new({}, {
        'email' => 'bob@example.com',
        'seconds' => 3.years.to_i
      })
      gift.settings['receiver_id'] = recipient.global_id
      gift.save
      
      m = SubscriptionMailer.gift_updated(gift.global_id, 'redeem')
      expect(m.to).to eq(['nobody@example.com'])
      expect(m.subject).to eq("CoughDrop - Gift Redeemed")

      html = m.body.to_s
      expect(html).to match(/Giver: bob@example.com/)
      expect(html).to match(/Recipient: #{recipient.user_name}/)
      expect(html).to match(/<b>#{gift.code}<\/b>/)
      expect(html).to match(/Duration: 3 years/)
    end
  end
end