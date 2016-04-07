class WordData < ActiveRecord::Base
  include SecureSerialize
  secure_serialize :data
  replicated_model  
  
  def self.find_word(text, locale='en')
    return nil if text && text.match(/^[\+\:]/)
    word = self.find_by(:word => text.downcase, :locale => locale)
    word ||= self.find_by(:word => text.downcase.gsub(/[^A-Za-z0-9'\s]/, ''), :locale => locale)
    word && word.data
  end
end
