class Utterance < ActiveRecord::Base
  include GlobalId
  include Processable
  include Permissions
  include MetaRecord
  include SecureSerialize
  include Async
  protect_global_id
  
  belongs_to :user
  before_save :generate_defaults
  after_save :generate_preview_later
  
  add_permissions('view') { true }
  add_permissions('view', 'edit') {|user| self.user_id == user.id || (self.user && self.user.allows?(user, 'edit')) }
  has_paper_trail :only => [:data, :user_id]
  secure_serialize :data

  def generate_defaults
    self.data ||= {}
    if self.data['button_list']
      self.data['image_url'] ||= self.data['button_list'].map{|b| b['image'] }.compact.first
    end
    self.data['image_url'] ||= "https://s3.amazonaws.com/opensymbols/libraries/noun-project/Person-08e6d794b0.svg"
    self.data['show_user'] ||= false
    true
  end
  
  def generate_preview
    url = SentencePic.generate(self)
    self.data ||= {}
    self.data['large_image_url_attempted'] = true
    self.data['large_image_url'] = url
    self.save
  end
  
  def generate_preview_later
    if self.data && !self.data['large_image_url_attempted']
      self.schedule(:generate_preview)
    end
    true
  end
  
  def process_params(params, non_user_params)
    raise "user required" unless self.user || non_user_params[:user]
    self.user = non_user_params[:user] if non_user_params[:user]
    self.data ||= {}
    self.data['button_list'] = params['button_list'] if params['button_list'] # TODO: process this for real
    self.data['sentence'] = params['sentence'] if params['sentence'] # TODO: process this for real
    self.data['image_url'] = params['image_url'] if params['image_url']
    self.data['show_user'] = params['show_user'] if params['show_user']
  end
end
