module MetaRecord
  extend ActiveSupport::Concern
  
  def meta_record
    res = OpenStruct.new
    if self.class == Utterance
      json = JsonApi::Utterance.as_json(self)
      if json['show_user'] && json['user']
        res.title = (json['user']['name'] || json['user']['user_name']) + " said: \"" + json['sentence'] + "\""
      else
        res.title = "Someone said: \"" + json['sentence'] + "\""
      end
      res.summary = "That sentence came from using a speech app, which makes is easier for some people to communicate. Visit the site to learn more."
      res.image = URI.encode(json['image_url'])
      res.large_image = URI.encode(json['image_url']) if json['image_url']
      res.link = URI.encode(json['link'])
    elsif self.class == Board
      json = JsonApi::Board.as_json(self)
      res.title = json['name']
      res.summary = json['description']
      res.image = URI.encode(json['image_url'])
      res.link = URI.encode(json['link'])
    elsif self.class == User
      json = JsonApi::User.as_json(self)
      res.title = json['name']
      res.summary = json['description']
      res.image = URI.encode(json['avatar_url'])
      res.link = URI.encode(json['link'])
    end
    res.created = self.created_at.iso8601
    res.updated = self.updated_at.iso8601
    res
  end
end