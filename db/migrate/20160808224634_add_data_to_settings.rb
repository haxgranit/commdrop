class AddDataToSettings < ActiveRecord::Migration
  def change
    add_column :settings, :data, :text
  end
end
