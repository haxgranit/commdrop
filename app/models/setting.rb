class Setting < ActiveRecord::Base
  replicated_model  

  def self.set(key, value)
    setting = self.find_or_initialize_by(:key => key)
    setting.value = value
    setting.save
    value
  end
  
  def self.get(key)
    setting = self.find_by(:key => key)
    setting && setting.value
  end
end
