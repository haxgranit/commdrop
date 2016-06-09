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
  
  def self.core_for?(word, user)
    default_core_list.include?(word.downcase.sub(/[^\w]+$/, ''))
  end
  
  def self.default_core_list
    @@default_core_list ||= nil
    return @@default_core_list if @@default_core_list
    json = JSON.parse(File.read('./lib/core_lists.json')) rescue nil
    if json
      @@default_core_list = json[0]['words']
    end
    @@default_core_list ||= []
    @@default_core_list
  end
end
