class OldKey < ActiveRecord::Base
  self.inheritance_column = nil
  replicated_model  
  
  def record
    if self.type == 'board'
      Board.find_by_path(self.record_id)
    elsif self.type == 'user'
      User.find_by_path(self.record_id)
    else
      nil
    end
  end
end
