module Sharing
  extend ActiveSupport::Concern
  
  def process_share(sharing_key)
    action, user_name = sharing_key.split(/-/, 2)
    user = User.find_by_path(user_name)
    if !user
      add_processing_error("user #{user_name} not found while trying to share")
      return false
    end
    if action == 'add_deep'
      return self.share_with(user, true)
    elsif action == 'add_shallow'
      res = self.share_with(user, false)
      return res
    elsif action == 'add_edit_deep'
      return self.share_with(user, true, true)
    elsif action == 'add_edit_shallow'
      return self.share_with(user, false, true)
    elsif action == 'remove'
      return self.unshare_with(user)
    end
    true
  end
  
  def author?(user)
    self.author_ids.include?(user.global_id)
  end
  
  def author_ids(plus_downstream_editing=false)
    author = self.user
    res = []
    res << author.global_id if author
    if author && author.settings && author.settings['boards_i_shared'] && author.settings['boards_i_shared'][self.global_id]
      author.settings['boards_i_shared'][self.global_id].each do |share|
        if plus_downstream_editing
          res << share['user_id'] if share['allow_editing'] && share['include_downstream'] && !share['pending']
        else
          res << share['user_id'] if share['allow_editing']
        end
      end
    end
    res
  end
  
  def share_with(user, include_downstream=false, allow_editing=false)
    share_or_unshare(user, true, :include_downstream => include_downstream, :allow_editing => allow_editing)
  end
  
  def shared_by?(user)
    !!(user.settings['boards_i_shared'] && user.settings['boards_i_shared'][self.global_id] && user.settings['boards_i_shared'][self.global_id].length > 0)
  end
  
  def share_or_unshare(user, do_share, args={})
    include_downstream = !!args[:include_downstream]
    allow_editing = !!args[:allow_editing]
    pending = false
    if allow_editing && include_downstream
      pending = args[:pending_allow_editing] == nil ? true : !!args[:pending_allow_editing]
    end
    author = self.user
    raise "user required" unless user
    user = author if author.id == user.id
    author.settings ||= {}
    author.settings['boards_i_shared'] ||= {}
    list = [] + (author.settings['boards_i_shared'][self.global_id] || []).select{|share| share['user_id'] != user.global_id }
    if do_share
      list << {
        'user_id' => user.global_id,
        'user_name' => user.user_name,
        'include_downstream' => include_downstream,
        'allow_editing' => allow_editing,
        'pending' => !!pending
      }
    end
    author.settings['boards_i_shared'][self.global_id] = list
    
    user.settings ||= {}
    list = [] + (user.settings['boards_shared_with_me'] || []).select{|share| share['board_id'] != self.global_id }
    if do_share
      list << {
        'board_id' => self.global_id,
        'board_key' => self.key,
        'include_downstream' => include_downstream,
        'allow_editing' => allow_editing,
        'pending' => !!pending
      }
    end
    user.settings['boards_shared_with_me'] = list
    author.save
    user.save
    true
  end
  
  def approve_downstream_share_with(user)
    share_or_unshare(user, true, :include_downstream => true, :allow_editing => true, :pending_allow_editing => false)
  end
  
  def unshare_with(user)
    share_or_unshare(user, false)
  end
  
  def shared_users
    author = self.user
    list = ((author.settings || {})['boards_i_shared'] || {})[self.global_id] || []
    user_ids = list.map{|s| s['user_id'] }
    users = User.find_all_by_global_id(user_ids)
    result = []
    list.each do |share|
      user = users.detect{|u| u.global_id == share['user_id'] }
      if user
        user_hash = JsonApi::User.as_json(user, :limited_identity => true)
        user_hash['include_downstream'] = share['include_downstream']
        user_hash['allow_editing'] = share['allow_editing']
        user_hash['pending'] = share['pending']
        result << user_hash
      end
    end
    result
  end
  
  def shared_with?(user, plus_editing=false)
    return false unless user && user.settings
    share = (user.settings['boards_shared_with_me'] || []).detect{|b| b['board_id'] == self.global_id}
    shared = plus_editing ? !!(share && share['allow_editing']) : !!share
    if !shared
      all_board_ids = self.class.all_shared_board_ids_for(user, plus_editing)
      shared = all_board_ids.include?(self.global_id)
    end
    shared
  end
  
  module ClassMethods
    def all_shared_board_ids_for(user, plus_editing=false)
      # all explicitly-shared boards
      shallow_board_ids = (user.settings['boards_shared_with_me'] || []).select{|b| plus_editing ? b['allow_editing'] : b }.map{|b| b['board_id'] }
      
      # all explicitly-shared boards that are set to include downstream
      deep_board_ids = (user.settings['boards_shared_with_me'] || []).select{|b| plus_editing ? (b['allow_editing'] && !b['pending']) : b }.select{|b| b['include_downstream'] }.map{|b| b['board_id'] }
      if plus_editing
        (user.settings['boards_i_shared'] || []).each do |board_id, shares|
          deep_board_ids << board_id if shares.any?{|s| s['allow_editing'] && !s['pending'] && s['include_downstream'] }
        end
      end
      # get all those boards
      boards = Board.find_all_by_global_id(deep_board_ids)
      valid_deep_board_authors = {}
      # for each explicitly-shared including-downstream board, mark all downstream boards
      # as possibly-shared if they were authored by any of the root board's authors
      boards.each do |b| 
        b.author_ids(plus_editing).each do |author_id|
          valid_deep_board_authors[b.global_id] ||= []; valid_deep_board_authors[b.global_id] << author_id
          (b.settings['downstream_board_ids'] || []).each do |id|
            valid_deep_board_authors[id] ||= []; valid_deep_board_authors[id] << author_id
          end
        end
      end
      # get the list of all possible downstream boards
      all_deep_board_ids = boards.map{|b| b.settings['downstream_board_ids'] || [] }.flatten.compact.uniq
      
      valid_deep_board_ids = []
      # for every downstream board, mark it as shared if one of the current board's authors
      # matches one of the root-board authors, which would implicitly grant access
      Board.find_all_by_global_id(all_deep_board_ids).each do |b|
        b.author_ids.each do |author_id|
          valid_deep_board_ids << b.global_id if valid_deep_board_authors[b.global_id].include?(author_id)
        end
      end
      
      all_board_ids = (shallow_board_ids + valid_deep_board_ids).uniq
      all_board_ids
    end
  end
end