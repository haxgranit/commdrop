class SecureJson
  def self.load(str)
    return nil unless str
    salt, secret = str.split(/--/, 2)
    JSON.load(Security.decrypt(secret, salt, "secure_json"))
  end
  
  def self.dump(obj)
    json = JSON.dump(obj)
    res = encrypted_dump(json)
    res
  end
  
  def self.encrypted_dump(json)
    secret, salt = Security.encrypt(json, "secure_json")
    salt + "--" + secret
  end
end
