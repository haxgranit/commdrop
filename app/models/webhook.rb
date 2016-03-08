class Webhook < ActiveRecord::Base
  include Async
  include SecureSerialize
  secure_serialize :settings
  belongs_to :user
  before_save :generate_defaults
  
  def generate_defaults
    self.settings ||= {}
    self.settings['notifications'] ||= {}
    true
  end
    
  def self.get_record_code(record)
    raise "record must be saved" unless record.id
    record_code = record.class.to_s + ":" + (record.respond_to?(:global_id) ? record.global_id : record.id)
  end
  
  def self.register(user, record, options)
    if !options[:callback] ||!options[:callback].match(/^http/)
      # callback provided by user must be a valid url
      return nil
    end
    register_internal(user, record, options)
  end
  
  def self.register_internal(user, record, options)
    record_code = get_record_code(record)
    webhook = Webhook.find_or_initialize_by(:user_id => user.id, :record_code => record_code)
    webhook.settings ||= {}
    webhook.settings['notifications'] ||= {}
    notifications = webhook.settings['notifications'][options[:notification_type]] || []
    callback = notifications.detect{|n| n['callback'] == options[:callback] }
    if !callback
      callback = {
        'token' => Security.nonce("confirmation code for #{record_code}"),
        'callback' => options[:callback]
      }
      notifications << callback
    end
    webhook.settings['notifications'][options[:notification_type]] = notifications
    webhook.save
    callback['token']
  end
  
  def self.notify_all(record, notification_type, additional_args=nil)
    record_code = get_record_code(record)
    self.schedule(:notify_all_with_code, record_code, notification_type, additional_args)
  end
  
  def self.notify_all_with_code(record_code, notification_type, additional_args)
    record = find_record(record_code)
    if record
      record.default_listeners(notification_type).each do |notifiable_code|
        notifiable = find_record(notifiable_code)
        notifiable.handle_notification(notification_type, record, additional_args) if notifiable && notifiable.respond_to?(:handle_notification)
      end
      if record.respond_to?(:additional_listeners)
        record.additional_listeners(notification_type, additional_args).each do |notifiable_code|
          notifiable = find_record(notifiable_code)
          notifiable.handle_notification(notification_type, record, additional_args) if notifiable && notifiable.respond_to?(:handle_notification)
        end
      end
    end
    Webhook.where(:record_code => record_code).each{|h| h.notify(notification_type) }
  end
  
  def notify(notification_type)
    callbacks = self.settings['notifications'][notification_type] || []
    callbacks.each do |callback|
      if callback['callback'].match(/^http/)
        url = callback['callback'].split(/#/)[0]
        Typhoeus.post(url, body: {webhook_token: callback['token']})
      else
        self.internal_notify(callback['callback'], notification_type)
      end
    end
    # if matching notification_type, then notify
    # if callback_url, post to it
    # if internal callback, send method
    #    for example, when board's downstream changes, it should be
    #    updating all the users who have that board as their home board,
    #    this mechanism seems like a clean place to do that.
    # if user has push notification, use whatever service we pick
  end
  
  def self.find_record(record_code)
    return nil unless record_code
    klass, global_id = record_code.split(/:/)
    klass = klass.constantize
    klass.respond_to?(:find_by_global_id) ? klass.find_by_global_id(global_id) : klass.find_by(:id => global_id)
  end

  def generate_message(notification_type)
    "alert"
  end
  
  def internal_notify(callback, notification_type)
    if callback == 'push_notification'
      # self.user.increment_counter(self.notification_type)
      # push to whatever service we use (include Google Cloud Notify for Chrome extension)
      self.user.devices.each do |device|
        message = generate_message(notification_type)
        #if device.mobile?
          # push to notification service
        #elsif device.chrome?
          # http://developer.chrome.com/apps/pushMessaging
          # http://developer.chrome.com/apps/gcm_server
          # limited to 256 bytes (yeesh)
          
          # http://developer.android.com/google/gcm/gs.html
          # http://developer.chrome.com/apps/cloudMessagingV2
        #end
      end
    end
  end
end
