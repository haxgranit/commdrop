require 'stripe'

module Purchasing
  def self.subscription_event(request)
    Stripe.api_key = ENV['STRIPE_SECRET_KEY']
    json = JSON.parse(request.body.read) rescue nil
    event_id = json && json['id']
    event = event_id && Stripe::Event.retrieve(event_id) rescue nil
    if !event || !event['type']
      return {:data => {:error => "invalid parameters", :event_id => event_id}, :status => event_id ? 200 : 400}
    end
    data = {:valid => false, :type => event['type'], :event_id => event_id}
    object = event['data'] && event['data']['object']
    previous = event['data'] && event['data']['previous_attributes']
    if object
      if event['type'] == 'charge.succeeded'
        valid = object['metadata'] && object['metadata']['user_id'] && object['metadata']['plan_id']
        if valid
          time = 5.years.to_i
          User.subscription_event({
            'purchase' => true,
            'user_id' => object['metadata'] && object['metadata']['user_id'],
            'purchase_id' => object['id'],
            'customer_id' => object['customer'],
            'plan_id' => object['metadata'] && object['metadata']['plan_id'],
            'seconds_to_add' => time
          })
        end
        data = {:purchase => true, :purchase_id => object['id'], :valid => !!valid}
      elsif event['type'] == 'charge.failed'
        valid = object['metadata'] && object['metadata']['user_id']
        if valid
          User.subscription_event({
            'user_id' => object['metadata'] && object['metadata']['user_id'],
            'purchase_failed' => true
          })
        end
        data = {:purchase => false, :notified => true, :valid => !!valid}
      elsif event['type'] == 'charge.dispute.created'
        charge = Stripe::Charge.retrieve(object['id'])
        if charge
          valid = charge['metadata'] && charge['metadata']['user_id']
          if valid
            User.subscription_event({
              'user_id' => charge['metadata'] && charge['metadata']['user_id'],
              'chargeback_created' => true
            })
          end
          data = {:dispute => true, :notified => true, :valid => !!valid}
        end
      elsif event['type'] == 'customer.subscription.created'
        customer = Stripe::Customer.retrieve(object['customer'])
        valid = customer && customer['metadata'] && customer['metadata']['user_id'] && object['plan'] && object['plan']['id']
        if valid
          updated = User.subscription_event({
            'subscribe' => true,
            'user_id' => customer['metadata'] && customer['metadata']['user_id'],
            'customer_id' => object['customer'],
            'subscription_id' => object['id'],
            'plan_id' => object['plan'] && object['plan']['id']
          })
          if updated
            user = User.find_by_global_id(customer['metadata'] && customer['metadata']['user_id'])
            Purchasing.cancel_other_subscriptions(user, object['id']) if user
          end
        end
        data = {:subscribe => true, :valid => !!valid}
      elsif event['type'] == 'customer.subscription.updated'
        customer = Stripe::Customer.retrieve(object['customer'])
        valid = customer && customer['metadata'] && customer['metadata']['user_id']
        if object['status'] == 'unpaid' || object['status'] == 'canceled'
          if previous && previous['status'] && previous['status'] != 'unpaid' && previous['status'] != 'canceled'
            if valid
              User.subscription_event({
                'unsubscribe' => true,
                'user_id' => customer['metadata'] && customer['metadata']['user_id'],
                'customer_id' => object['customer'],
                'subscription_id' => object['id']
              })
            end
            data = {:unsubscribe => true, :valid => !!valid}
          end
        elsif object['status'] == 'active'
          if valid
            updated = User.subscription_event({
              'subscribe' => true,
              'user_id' => customer['metadata'] && customer['metadata']['user_id'],
              'customer_id' => object['customer'],
              'subscription_id' => object['id'],
              'plan_id' => object['plan'] && object['plan']['id']
            })
            if updated
              user = User.find_by_global_id(customer['metadata'] && customer['metadata']['user_id'])
              Purchasing.cancel_other_subscriptions(user, object['id']) if user
            end
          end
          data = {:subscribe => true, :valid => !!valid}
        end
      elsif event['type'] == 'customer.subscription.deleted'
        customer = Stripe::Customer.retrieve(object['customer'])
        valid = customer && customer['metadata'] && customer['metadata']['user_id']
        if valid
          User.subscription_event({
            'unsubscribe' => true,
            'user_id' => customer['metadata'] && customer['metadata']['user_id'],
            'customer_id' => object['customer'],
            'subscription_id' => object['id']
          })
        end
        data = {:unsubscribe => true, :valid => !!valid}
      elsif event['type'] == 'ping'
        data = {:ping => true, :valid => true}
      end
    end
    {:data => data, :status => 200}
  end
  
  def self.add_token_summary(token)
    token['summary'] = "Unknown Card"
    brand = token['card'] && token['card']['brand']
    last4 = token['card'] && token['card']['last4']
    exp_year = token['card'] && token['card']['exp_year']
    exp_month = token['card'] && token['card']['exp_month']
    if brand && last4
      token['summary'] = brand + " card ending in " + last4
      if exp_year && exp_month
        token['summary'] += " (exp #{exp_month}/#{exp_year})"
      end
    end
    token['summary']
  end

  def self.purchase(user, token, type)
    # TODO: record basic card information ("Visa ending in 4242" for references)
    user && user.log_subscription_event({:log => 'purchase initiated'})
    Stripe.api_key = ENV['STRIPE_SECRET_KEY']
    if type.match(/^slp_/) && type.match(/free/)
      user.update_subscription({
        'subscribe' => true,
        'subscription_id' => 'free',
        'customer_id' => 'free',
        'plan_id' => 'slp_monthly_free'
      })
      Purchasing.cancel_other_subscriptions(user, 'all')
      return {success: true, type: type}
    end
    user && user.log_subscription_event({:log => 'paid subscription'})
    amount = type.sub(/_plus_trial/, '').split(/_/)[-1].to_i
    valid_amount = true
    description = type
    if type.match(/^slp_monthly/)
      valid_amount = false unless [3, 4, 5].include?(amount)
      description = "supporter monthly subscription $#{amount}"
    elsif type.match(/^slp_long_term/)
      valid_amount = false unless [50, 100, 150].include?(amount)
      description = "supporter long-term purchase $#{amount}"
    elsif type.match(/^monthly/)
      valid_amount = false unless [3, 4, 5, 6, 7, 8, 9, 10].include?(amount)
      description = "communicator monthly subscription $#{amount}"
    elsif type.match(/^long_term/)
      valid_amount = false unless [100, 150, 200, 250, 300].include?(amount)
      description = "communicator long-term purchase $#{amount}"
    else
      return {success: false, error: "unrecognized purchase type, #{type}"}
    end
    if !valid_amount
      user && user.log_subscription_event({:error => true, :log => 'invalid_amount'})
      return {success: false, error: "#{amount} not valid for type #{type}"}
    end
    plan_id = type
    add_token_summary(token)
    begin
      if type.match(/long_term/)
        user && user.log_subscription_event({:log => 'long-term - creating charge'})
        charge = Stripe::Charge.create({
          :amount => (amount * 100),
          :currency => 'usd',
          :source => token['id'],
          :description => description,
          :metadata => {
            'user_id' => user.global_id,
            'plan_id' => plan_id
          }
        })
        time = 5.years.to_i
        user && user.log_subscription_event({:log => 'persisting subscription update'})
        User.subscription_event({
          'purchase' => true,
          'user_id' => user.global_id,
          'purchase_id' => charge['id'],
          'customer_id' => charge['customer'],
          'token_summary' => token['summary'],
          'plan_id' => plan_id,
          'seconds_to_add' => time
        })
        cancel_other_subscriptions(user, 'all')
      else
        user && user.log_subscription_event({:log => 'monthly subscription'})
        customer = nil
        if user.settings['subscription'] && user.settings['subscription']['customer_id'] && user.settings['subscription']['customer_id'] != 'free'
          user && user.log_subscription_event({:log => 'retrieving existing customer'})
          customer = Stripe::Customer.retrieve(user.settings['subscription']['customer_id']) rescue nil
        end
        if customer
          user && user.log_subscription_event({:log => 'new subscription for existing customer'})
          sub = customer.subscriptions.create({
            :plan => plan_id,
            :source => token['id']
          })
          user && user.log_subscription_event({:log => 'persisting subscription update'})
          updated = User.subscription_event({
            'subscribe' => true,
            'user_id' => user.global_id,
            'subscription_id' => sub['id'],
            'customer_id' => sub['customer'],
            'token_summary' => token['summary'],
            'plan_id' => plan_id
          })
          Purchasing.cancel_other_subscriptions(user, sub['id']) if updated
        else
          user && user.log_subscription_event({:log => 'creating new customer'})
          customer = Stripe::Customer.create({
            :metadata => {
              'user_id' => user.global_id
            },
            :plan => plan_id,
            :source => token['id']
          })
          sub = customer.subscriptions['data'].detect{|s| s['status'] == 'active' }
          user && user.log_subscription_event({:log => 'persisting subscription update'})
          updated = User.subscription_event({
            'subscribe' => true,
            'user_id' => user.global_id,
            'subscription_id' => sub['id'],
            'customer_id' => customer['id'],
            'token_summary' => token['summary'],
            'plan_id' => plan_id
          })
          Purchasing.cancel_other_subscriptions(user, sub['id']) if updated
        end
      end
    rescue Stripe::CardError => err
      json = err.json_body
      err = json[:error]
      user && user.log_subscription_event({:error => 'stripe card_exception', :json => json})
      return {success: false, error: err[:code]}
    rescue => err
      type = (err.respond_to?('[]') && err[:type])
      code = (err.respond_to?('[]') && err[:code]) || 'unknown'
      user && user.log_subscription_event({:error => 'other_exception', :err => err.to_s})
      return {success: false, error: 'unexpected_error', error_message: err.to_s, error_type: type, error_code: code}
    end
    {success: true, type: type}
  end
  
  def self.purchase_gift(token, opts)
    user = opts['user_id'] && User.find_by_global_id(opts['user_id'])
    Stripe.api_key = ENV['STRIPE_SECRET_KEY']
    type = opts['type'] || ""
    amount = type.split(/_/)[-1].to_i
    valid_amount = true
    description = type
    seconds = 5.years.to_i
    if type.match(/^long_term_custom/)
      valid_amount = false unless amount > 100 && (amount % 50) == 0
      description = "gift purchase $#{amount}"
    elsif type.match(/^long_term/)
      valid_amount = false unless [150, 200, 250, 300].include?(amount)
      description = "gift purchase $#{amount}"
    else
      return {success: false, error: "unrecognized purchase type, #{type}"}
    end    
    if !valid_amount
      return {success: false, error: "#{amount} not valid for type #{type}"}
    end
    add_token_summary(token)
    begin
      charge = Stripe::Charge.create({
        :amount => (amount * 100),
        :currency => 'usd',
        :source => token['id'],
        :description => description,
        :metadata => {
          'giver_id' => user && user.global_id,
          'giver_email' => opts['email'],
          'plan_id' => type
        }
      })
      gift = GiftPurchase.process_new({}, {
        'giver' => user, 
        'email' => opts['email'],
        'customer_id' => charge['customer'],
        'token_summary' => token['summary'],
        'plan_id' => type,
        'purchase_id' => charge['id'],
        'seconds' => seconds
      })
    rescue Stripe::CardError => err
      json = err.json_body
      err = json[:error]
      return {success: false, error: err[:code]}
    rescue => err
      type = (err.respond_to?('[]') && err[:type])
      code = (err.respond_to?('[]') && err[:code]) || 'unknown'
      return {success: false, error: 'unexpected_error', error_message: err.to_s, error_type: type, error_code: code}
    end
    {success: true, type: type}
  end
  
  def self.redeem_gift(code, user)
    gift = GiftPurchase.where(:active => true, :code => code).first
    if !user
      return {success: false, error: "user required"}
    end
    if !gift
      return {success: false, error: "code doesn't match any available gifts"}
    end
    if !gift.settings || gift.settings['seconds_to_add'].to_i <= 0
      return {success: false, error: "gift has no time to add"}
    end
    gift.active = false
    gift.settings['receiver_id'] = user.global_id
    gift.settings['redeemed_at'] = Time.now.iso8601
    gift.save
    
    res = User.subscription_event({
      'user_id' => user.global_id,
      'purchase' => true,
      'plan_id' => 'gift_code',
      'gift_id' => gift.global_id,
      'seconds_to_add' => gift.settings['seconds_to_add'].to_i
    })
    if res
      {success: true, redeemed: true, code: code}
    else
      {success: false, error: "unexpected_error"}
    end
  end
  
  def self.unsubscribe(user)
    return false unless user
    cancel_other_subscriptions(user, 'all')
    User.subscription_event({
      'unsubscribe' => true,
      'user_id' => user.global_id,
      'customer_id' => user.settings['subscription']['customer_id'],
      'subscription_id' => user.settings['subscription']['subscription_id']
    })
  end
  
  def self.cancel_other_subscriptions(user, except_subscription_id)
    return false unless user
    Stripe.api_key = ENV['STRIPE_SECRET_KEY']
    begin
      customer_id = user.settings['subscription']['customer_id']
      customer = Stripe::Customer.retrieve(customer_id) if customer_id
      if customer
        customer.subscriptions.all.each do |sub|
          if sub['id'] == except_subscription_id && except_subscription_id != 'all'
          else
            sub.delete
          end
        end
      else
        return false
      end    
    rescue => e
      return false
    end
    true
  end
  
  def self.pause_subscription(user)
    # API call
    return false
  end
  
  def self.resume_subscription(user)
    # API call
    return false
  end
end