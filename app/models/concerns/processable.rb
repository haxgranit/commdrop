require 'sanitize'

module Processable
  extend ActiveSupport::Concern
  
  def process(params, non_user_params=nil)
    params = params.with_indifferent_access
    non_user_params = (non_user_params || {}).with_indifferent_access
    @processing_errors = []
    res = self.process_params(params.with_indifferent_access, non_user_params)
    if res == false
      @errored = true
      return false
    else
      self.save
    end
  end
  
  def processing_errors
    @processing_errors || []
  end
  
  def add_processing_error(str)
    @processing_errors ||= []
    @processing_errors << str
  end
  
  def errored?
    @errored || processing_errors.length > 0
  end
  
  def process_license(license)
    self.settings['license'] = OBF::Utils.parse_license(license);
  end
  
  def process_string(str)
    Sanitize.fragment(str)
  end
  
  def process_html(html)
    Sanitize.fragment(html, Sanitize::Config::RELAXED)
  end
  
  def generate_unique_key(suggestion)
    collision = nil
    if self.class == User
      collision = User.where(['lower(user_name) = ?', suggestion.downcase])[0]
    elsif self.class == Board
      suggestion = suggestion.downcase
      collision = Board.find_by(:key => suggestion)
    else
      raise "unknown class: #{self.class.to_s}"
    end
    
    if Coughdrop::RESERVED_ROUTES.include?(suggestion) || (collision && collision != self)
      # try something else
      trailing_number = suggestion.match(/_\d+$/)
      if trailing_number && trailing_number[0]
        trailing_number = trailing_number[0][1..-1].to_i
        suggestion = suggestion.sub(/_\d+$/, "_" + (trailing_number + 1).to_s)
      else
        suggestion += "_1"
      end
      generate_unique_key(suggestion)
    else
      suggestion
    end
  end
  
  def generate_user_name(suggestion=nil, downcased=true)
    suggestion ||= self.user_name || (self.settings && self.settings['name'])
    suggestion ||= (self.settings && self.settings['email'] && self.settings['email'].split(/@/)[0])
    suggestion ||= "person"
    suggestion = suggestion.downcase if downcased
    suggestion = clean_path(suggestion)
    generate_unique_key(suggestion)
  end

  def generate_board_key(suggestion=nil)
    self.settings ||= {}
    suggestion ||= self.key || self.settings['name'] || "board"
    suggestion = clean_path(suggestion.downcase)
    raise "user required" unless self.user && self.user.user_name
    full_suggestion = "#{self.user.user_name}/#{suggestion}"
    generate_unique_key(full_suggestion)
  end
  
  def clean_path(arg)
    self.class.clean_path(arg)
  end
  
  module ClassMethods
    def clean_path(arg)
      arg = (arg || "").strip
      arg = "_" unless arg.length > 0
      arg = "_" + arg if arg[0].match(/\d/)
      arg = arg.gsub(/\'/, '').gsub(/[^a-zA-Z0-9_-]+/, '-').sub(/-+$/, '').gsub(/-+/, '-')
      arg = arg * (3.0 / arg.length).ceil if arg.length < 3
      arg
    end
    
    def process_new(params, non_user_params=nil)
      obj = self.new
      obj.process(params, non_user_params)
      obj
    end
  end
end