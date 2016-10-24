require 'spec_helper'

RSpec.describe WordData, :type => :model do
  describe "find_word" do
    it "should find matching words" do
      WordData.create(:word => "troixlet", :locale => 'en', :data => {'a' => 'b'})
      WordData.create(:word => "runshkable", :locale => 'es', :data => {'b' => 'c'})
      expect(WordData.find_word('troixlet')).to eq({'a' => 'b'})
      expect(WordData.find_word('runshkable')).to eq(nil)
      expect(WordData.find_word('chuckxflem')).to eq(nil)
      expect(WordData.find_word('Troixlet')).to eq({'a' => 'b'})
      expect(WordData.find_word('Troixlet!!')).to eq({'a' => 'b'})
      expect(WordData.find_word('troixlet', 'es')).to eq(nil)
      expect(WordData.find_word('runshkable', 'es')).to eq({'b' => 'c'})
      expect(WordData.find_word('runshkABLE__', 'es')).to eq({'b' => 'c'})
      expect(WordData.find_word('runshkABLE ', 'es')).to eq(nil)
    end
  end
  
  describe "core_for" do
    it "should recognize core words for no user" do
      expect(WordData.core_for?("has", nil)).to eq(true)
      expect(WordData.core_for?("What", nil)).to eq(true)
      expect(WordData.core_for?("when?", nil)).to eq(true)
      expect(WordData.core_for?("that", nil)).to eq(true)
      expect(WordData.core_for?("always", nil)).to eq(true)
      expect(WordData.core_for?("bacon", nil)).to eq(false)
      expect(WordData.core_for?("asdf", nil)).to eq(false)
      expect(WordData.core_for?("awiulghuawihguwa", nil)).to eq(false)
      expect(WordData.core_for?("trinket", nil)).to eq(false)
    end
  end
  
  describe "generate_defaults" do
    it "should have generate defaults" do
      w = WordData.new
      w.generate_defaults
      expect(w.data).to eq({})
    end
  end
  
  describe "find_word_record" do
    it "should find the correct word" do
      a = WordData.create(:word => "troixlet", :locale => 'en', :data => {'a' => 'b'})
      b = WordData.create(:word => "runshkable", :locale => 'es', :data => {'b' => 'c'})
      expect(WordData.find_word_record('troixlet')).to eq(a)
      expect(WordData.find_word_record('runshkable')).to eq(nil)
      expect(WordData.find_word_record('chuckxflem')).to eq(nil)
      expect(WordData.find_word_record('Troixlet')).to eq(a)
      expect(WordData.find_word_record('Troixlet!!')).to eq(a)
      expect(WordData.find_word_record('troixlet', 'es')).to eq(nil)
      expect(WordData.find_word_record('runshkable', 'es')).to eq(b)
      expect(WordData.find_word_record('runshkABLE__', 'es')).to eq(b)
      expect(WordData.find_word_record('runshkABLE__', 'es-US')).to eq(b)
      expect(WordData.find_word_record('runshkABLE ', 'es')).to eq(nil)
    end
  end

  describe "translate" do
    it "should translate individual words" do
      expect(WordData).to receive(:query_translations).with([{:text => 'hat', :type => nil}]).and_return([{:text => 'hat', :type => nil, :translation => 'cap'}])
      expect(WordData.translate('hat', 'en', 'es')).to eq('cap')
    end
  end
#   def self.translate(text, source_lang, dest_lang, type=nil)
#     batch = translate_batch([{text: text, type: type}], source_lang, dest_lang)
#     batch[:translations][text]
#   end  

#   def self.query_translations(words)
#     res = []
#     missing.each do |obj|
#       text = obj[:text]
#       type = obj[:type]
#       obj[:translation] = text.reverse 
#       res << obj
#     end
#     res
#   end
  describe "translate_batch" do
    it "should translate a batch of words as well as possible" do
      a = WordData.create(:word => "troixlet", :locale => 'en', :data => {'a' => 'b', 'translations' => {'es' => 'trunket'}})
      b = WordData.create(:word => "runshkable", :locale => 'en', :data => {'a' => 'b', 'translations' => {'es-US' => 'rushef'}})
      expect(WordData).to receive(:query_translations).with([{:text => 'forshdeg'}, {:text => 'wilmerding'}]).and_return([{:text => 'forshdeg', :type => nil, :translation => 'milnar'}])
      res = WordData.translate_batch([
        {:text => 'troixlet'},
        {:text => 'runshkable'},
        {:text => 'forshdeg'},
        {:text => 'wilmerding'}
      ], 'en', 'es-US')
      expect(res[:source]).to eq('en')
      expect(res[:dest]).to eq('es-US')
      expect(res[:translations]).to eq({
        'troixlet' => 'trunket',
        'runshkable' => 'rushef',
        'forshdeg' => 'milnar'
      })
    end
  end

  describe "persist_translation" do
    it "should persist translations correctly" do
      b = WordData.create(:word => "runshkable", :locale => 'en', :data => {'a' => 'b', 'types' => ['something']})
      w = WordData.create(:word => 'railymop', :locale => 'es', :data => {'types' => ['verb']})
      WordData.persist_translation('runshkable', 'railymop', 'en', 'es-US', 'noun')
      expect(WordData.find_word_record('runshkable', 'en')).to eq(b)
      b.reload
      expect(b.data['translations']).to eq({'es' => 'railymop', 'es-US' => 'railymop'})
      w1 = WordData.find_word_record('railymop', 'es')
      expect(w1).to eq(w)
      expect(w1).to_not eq(nil)
      expect(w1.data['translations']).to eq({'en' => 'runshkable'})
      expect(w1.data['types']).to eq(['verb', 'noun', 'something'])
    end

    it "should use the original word type if needed as fallback" do
      b = WordData.create(:word => "runshkable", :locale => 'en', :data => {'a' => 'b', 'types' => ['something']})
      WordData.persist_translation('runshkable', 'railymop', 'en', 'es-US', nil)
      expect(WordData.find_word_record('runshkable', 'en')).to eq(b)
      b.reload
      expect(b.data['translations']).to eq({'es' => 'railymop', 'es-US' => 'railymop'})
      
      w1 = WordData.find_word_record('railymop', 'es-US')
      expect(w1).to_not eq(nil)
      expect(w1.data['translations']).to eq({'en' => 'runshkable'})
      expect(w1.data['types']).to eq(['something'])
    end
  end
end
