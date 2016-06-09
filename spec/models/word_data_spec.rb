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
end
