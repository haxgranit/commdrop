class AddNonceToUserVideos < ActiveRecord::Migration
  def change
    add_column :user_videos, :nonce, :string
  end
end
