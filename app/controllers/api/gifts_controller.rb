class Api::GiftsController < ApplicationController
  before_action :require_api_token, :except => [:show]
  # TODO: implement throttling to prevent brute force gift lookup

  def show
    gift = GiftPurchase.find_by_code(params['id'])
    return unless exists?(gift)
    return unless allowed?(gift, 'view')
    render json: JsonApi::Gift.as_json(gift, :wrapper => true, :permissions => @api_user).to_json
  end
end
