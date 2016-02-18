module Permissions
  extend ActiveSupport::Concern
  
  included do
    cattr_accessor :permissions_lookup
    cattr_accessor :allow_cached_permissions
    self.permissions_lookup = []
  end
  
  def cache_key(prefix=nil)
    id = self.id || 'nil'
    updated = (self.updated_at || Time.now).to_f
    key = "#{self.class.to_s}#{id}-#{updated}:#{RedisInit.cache_token}"
    if prefix
      key = prefix + "/" + key
    end
    key
  end
  
  def set_cached(prefix, data, expires=nil)
    expires ||= 30.minutes.to_i
    RedisInit.permissions.setex(self.cache_key(prefix), expires, data.to_json)
  end
  
  def get_cached(prefix)
    cache_string = RedisInit.permissions.get(self.cache_key(prefix))
    cache = nil
    if cache_string
      cache = JSON.parse(cache_string) rescue nil
    end
    cache
  end
  
  def allows?(user, action)
    if self.class.allow_cached_permissions
      # check for an existing result keyed off the record's id and updated_at
      permissions = permissions_for(user)
      
      return permissions[action] == true
    end
    
    self.class.permissions_lookup.each do |actions, block|
      next unless actions.include?(action.to_s)
      next if block.arity == 1 && !user
      res = instance_exec(user, &block)
      return true if res == true
    end
    false
  end
  
  def permissions_for(user)
    if self.class.allow_cached_permissions
      cache_key = (user && user.cache_key) || "nobody"
      permissions = get_cached("permissions-for/#{cache_key}")
      return permissions if permissions
    end

    granted_permissions = {
      'user_id' => (user && user.global_id)
    }.with_indifferent_access
    self.class.permissions_lookup.each do |actions, block|
      already_granted = granted_permissions.keys
      next if block.arity == 1 && !user
      next if actions - already_granted == []
      if instance_exec(user, &block)
        actions.each do |action|
          granted_permissions[action] = true
        end
      end
    end
    # cache the result with a 30-minute expiration keyed off the id and updated_at
    set_cached("permissions-for/#{cache_key}", granted_permissions) if self.class.allow_cached_permissions
    granted_permissions
  end
  
  module ClassMethods
    def cache_permissions
      self.allow_cached_permissions = true
    end
    
    def add_permissions(*actions, &block)
      self.permissions_lookup << [actions.map(&:to_s), block]
    end
  end
end