require 'spec_helper'

describe SecureJson do
  describe "load" do
    it "should not error on nil value" do
      expect(SecureJson.load(nil)).to eq(nil)
    end
    
    it "should error on malformed string" do
      expect{SecureJson.load("bob")}.to raise_error(OpenSSL::Cipher::CipherError)
    end
    
    it "should properly decode stored values" do
      json = {a: 1}
      e = Security.encrypt(json.to_json, "secure_json").reverse.join("--")
      expect(SecureJson.load(e)).to eq({"a" => 1})
    end
  end
  
  describe "dump" do
    it "should not error on nil value" do
      str = SecureJson.dump(nil)
      salt, secret = str.split(/--/, 2)
      expect(Security.decrypt(secret, salt, 'secure_json')).to eq('null')
    end
    
    it "should properly encode a hash" do
      h = {a: 1, b: [2, 3], c: {d: 4}}
      str = SecureJson.dump(h)
      salt, secret = str.split(/--/, 2)
      expect(Security.decrypt(secret, salt, 'secure_json')).to eq(h.to_json)
    end
  end
end
