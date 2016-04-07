class GiftPurchase < ActiveRecord::Base
  include Permissions
  include GlobalId
  include SecureSerialize
  include Processable
  secure_serialize :settings
  before_save :generate_defaults
  after_create :notify_of_creation
  replicated_model  
  
  add_permissions('view') { self.active == true }

  def self.find_by_code(code)
    code = code.downcase.gsub(/o/, '0')
    gift = GiftPurchase.where(:code => code, :active => true).first
  end
  
  def generate_defaults
    self.settings ||= {}
    self.active = true if self.active == nil
    if !self.code
      code = nil
      length = 5
      while !code || GiftPurchase.where(:active => true, :code => code).count > 0
        code = Security.nonce('gift_code')[0, length.floor]
        length += 0.3
      end
      self.code = code
    end
    true
  end
  
  def notify_of_creation
    if self.settings && self.settings['giver_email']
      SubscriptionMailer.schedule_delivery(:gift_created, self.global_id)
    end
    true
  end
  
  def duration
    time = {}
    left = self.settings && self.settings['seconds_to_add']
    return "no time specified" unless left && left > 0
    units = [[1.year.to_i, 'year'], [1.day.to_i, 'day'], [1.hour.to_i, 'hour'], [1.minute.to_i, 'minute']]
    units.each do |seconds, unit|
      while left >= seconds
        time[unit] = (time[unit] || 0) + 1
        left -= seconds
      end
    end
    res = []
    units.each do |seconds, unit|
      if time[unit] && time[unit] > 0
        str = "#{time[unit]} #{unit}"
        str += "s" if time[unit] > 1
        res << str
      end
    end
    res.join(", ")
  end
  
  def receiver
    id = self.settings && self.settings['receiver_id']
    User.find_by_global_id(id)
  end
  
  def giver
    id = self.settings && self.settings['giver_id']
    User.find_by_global_id(id)
  end
  
  def process_params(params, non_user_params)
    self.settings ||= {}
    self.settings['giver_email'] = params['email'] if params['email']
    self.settings['giver_email'] = non_user_params['email'] if non_user_params['email']
    if non_user_params['giver']
      self.settings['giver_id'] = non_user_params['giver'].global_id
    end
    ['customer_id', 'token_summary', 'plan_id', 'purchase_id'].each do |arg|
      self.settings[arg] = non_user_params[arg] if non_user_params[arg]
    end
    self.settings['seconds_to_add'] = non_user_params['seconds'].to_i if non_user_params['seconds']
  end
  
  def self.process_subscription_token(token, opts)
    Purchasing.purchase_gift(token, opts)
  end
  
  def self.redeem(code, user)
    Purchasing.redeem_gift(code, user)
  end
end
