class AddPrimaryToUserGoals < ActiveRecord::Migration
  def change
    add_column :user_goals, :primary, :boolean
  end
end
