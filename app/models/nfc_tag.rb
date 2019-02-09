class NfcTag < ApplicationRecord
  include SecureSerialize
  include GlobalId
  include Processable

  protect_global_id

  before_save :generate_defaults
  secure_serialize :data
  belongs_to :user

  def generate_defaults
    self.data ||= {}
    self.nonce ||= GoSecure.nonce('nfc_tag_secure_nonce')[0, 10]
    self.public ||= false
    true
  end

  def process_params(params, non_user_params)
    raise 'user required' unless non_user_params['user']
    self.generate_defaults
    
    self.data['button'] = params['button'] if params['button']
    self.data['label'] = params['label'] if params['label']
    self.tag_id = params['tag_id'] if params['tag_id']
    self.public = params['public'] if params['public'] != nil
    self.user ||= non_user_params['user']
    true
  end

  # TODO: remove old tags if they are no longer accessible:
  # - they are private and there is a newer one for the same user
  # TODO: track the last time they are downloaded/used and flush eventually
end
