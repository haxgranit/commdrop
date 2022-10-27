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
      expect(WordData).to receive(:query_translations).with([{:text => 'hat', :type => nil}], 'en', 'es').and_return([{:text => 'hat', :type => nil, :translation => 'cap'}])
      expect(WordData.translate('hat', 'en', 'es')).to eq('cap')
    end
    
    it "should persist found translations" do
      expect(WordData).to receive(:query_translations).with([{:text => 'hat', :type => nil}], 'en', 'es').and_return([{:text => 'hat', :type => nil, :translation => 'cap'}])
      expect(WordData.translate('hat', 'en', 'es')).to eq('cap')
      Worker.process_queues
      w = WordData.last
      expect(w.locale).to eq('es')
      expect(w.data).to eq({
        'word' => 'cap',
        'translations' => {'en' => 'hat'},
        'types' => ['noun']
      })
      w2 = WordData.where(:word => 'hat', :locale => 'en').first
      expect(w2).to_not eq(nil)
      expect(w2.data).to eq({
        'word' => 'hat',
        'translations' => {'es' => 'cap'},
        'types' => ['noun', 'verb', 'usu participle verb']
      })
    end
  end
  
  describe "query_translations" do
    it "should return an empty list of no search available" do
      ENV['GOOGLE_TRANSLATE_TOKEN'] = nil
      expect(Typhoeus).to_not receive(:get)
      res = WordData.query_translations([{text: 'hat'}], 'en', 'es')
      expect(res).to eq([])
    end
    
    it "should query translations" do
      ENV['GOOGLE_TRANSLATE_TOKEN'] = 'secrety'
      response = OpenStruct.new(body: {
        data: {
          translations: [
            {translatedText: 'top'},
            {translatedText: 'meow'}
          ]
        }
      }.to_json)
      expect(Typhoeus).to receive(:get).with('https://translation.googleapis.com/language/translate/v2?key=secrety&target=es&source=en&format=text&q=hat&q=cat').and_return(response)
      res = WordData.query_translations([{text: 'hat'}, {text: 'cat'}], 'en', 'es')
      expect(res).to eq([
        {text: 'hat', translation: 'top'},
        {text: 'cat', translation: 'meow'}
      ])
    end
    
    it "should only return results that have a translation" do
      ENV['GOOGLE_TRANSLATE_TOKEN'] = 'secrety'
      response = OpenStruct.new(body: {
        data: {
          translations: [
            {translatedText: 'top'},
            {translatedText: 'cat'}
          ]
        }
      }.to_json)
      expect(Typhoeus).to receive(:get).with('https://translation.googleapis.com/language/translate/v2?key=secrety&target=es&source=en&format=text&q=hat&q=cat').and_return(response)
      res = WordData.query_translations([{text: 'hat'}, {text: 'cat'}], 'en', 'es')
      expect(res).to eq([
        {text: 'hat', translation: 'top'}
      ])
    end
  end
  
  describe "translate_batch" do
    it "should translate a batch of words as well as possible" do
      a = WordData.create(:word => "troixlet", :locale => 'en', :data => {'a' => 'b', 'translations' => {'es' => 'trunket'}})
      b = WordData.create(:word => "runshkable", :locale => 'en', :data => {'a' => 'b', 'translations' => {'es-US' => 'rushef'}})
      expect(WordData).to receive(:query_translations).with([{:text => 'forshdeg'}, {:text => 'wilmerding'}], 'en', 'es-US').and_return([{:text => 'forshdeg', :type => nil, :translation => 'milnar'}])
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
  
  describe "core_list_for" do
    it "should return the default core list" do
      expect(WordData).to receive(:default_core_list).and_return('list!');
      expect(WordData.core_list_for(nil)).to eq('list!')
    end
  end
  
  describe "reachable_core_list_for" do
    it "should return a list of words" do
      u = User.create
      b = Board.create(:user => u)
      b.process({
        'buttons' => [
          {'id' => 1, 'label' => 'you'},
          {'id' => 2, 'label' => 'he'},
          {'id' => 3, 'label' => 'I'},
          {'id' => 4, 'label' => 'like'},
          {'id' => 5, 'label' => 'snooze'},
          {'id' => 6, 'label' => 'pretend'},
          {'id' => 7, 'label' => 'wonder'},
          {'id' => 8, 'label' => 'think'},
          {'id' => 9, 'label' => 'favorite'},
        ]
      })
      u.settings['preferences']['home_board'] = {'id' => b.global_id, 'key' => b.key}
      u.save
      Worker.process_queues
      Worker.process_queues
      expect(WordData.reachable_core_list_for(u)).to eq(["he", "i", "you", "favorite", "like", "pretend", "think"])
    end
    
    it "should return words available from the root board" do
      u = User.create
      b = Board.create(:user => u)
      b.process({
        'buttons' => [
          {'id' => 1, 'label' => 'you'},
          {'id' => 2, 'label' => 'he'},
          {'id' => 3, 'label' => 'I'},
          {'id' => 4, 'label' => 'like'},
          {'id' => 5, 'label' => 'snooze'},
          {'id' => 6, 'label' => 'pretend'},
          {'id' => 7, 'label' => 'wonder'},
          {'id' => 8, 'label' => 'think'},
          {'id' => 9, 'label' => 'favorite'},
        ]
      })
      u.settings['preferences']['home_board'] = {'id' => b.global_id, 'key' => b.key}
      u.save
      Worker.process_queues
      Worker.process_queues
      expect(WordData.reachable_core_list_for(u)).to eq(["he", "i", "you", "favorite", "like", "pretend", "think"])
    end
    
    it "should return words available from the sidebar" do
      u = User.create
      b = Board.create(:user => u)
      b.process({
        'buttons' => [
          {'id' => 1, 'label' => 'yes'},
          {'id' => 2, 'label' => 'no'},
          {'id' => 3, 'label' => 'I'},
          {'id' => 4, 'label' => 'like'},
          {'id' => 5, 'label' => 'snooze'},
          {'id' => 6, 'label' => 'pretend'},
          {'id' => 7, 'label' => 'wonder'},
          {'id' => 8, 'label' => 'think'},
          {'id' => 9, 'label' => 'favorite'},
        ]
      })
      u.settings['preferences']['home_board'] = {'id' => b.global_id, 'key' => b.key}
      u.save
      Worker.process_queues
      Worker.process_queues
      expect(WordData.reachable_core_list_for(u)).to eq(["i", "favorite", "like", "pretend", "think", "yes", "no"])
    end
    
    it "should not return words that aren't accessible, even if they're core words" do
      u = User.create
      b = Board.create(:user => u)
      b.process({
        'buttons' => [
          {'id' => 1, 'label' => 'you'},
          {'id' => 2, 'label' => 'bacon'},
          {'id' => 3, 'label' => 'radish'},
          {'id' => 4, 'label' => 'like'},
          {'id' => 5, 'label' => 'snooze'},
          {'id' => 6, 'label' => 'watercolor'},
          {'id' => 7, 'label' => 'wonder'},
          {'id' => 8, 'label' => 'splendid'},
          {'id' => 9, 'label' => 'favorite'},
        ]
      })
      u.settings['preferences']['home_board'] = {'id' => b.global_id, 'key' => b.key}
      u.save
      Worker.process_queues
      Worker.process_queues
      expect(WordData.reachable_core_list_for(u)).to eq(["you", "favorite", "like"])
    end
  end
end
