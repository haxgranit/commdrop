class Api::SoundsController < ApplicationController
  include RemoteUploader
  before_action :require_api_token, :except => [:upload_success]

  def create
    sound = ButtonSound.process_new(params['sound'], {:user => @api_user, :remote_upload_possible => true})
    if !sound || sound.errored?
      api_error(400, {error: "sound creation failed", errors: sound && sound.processing_errors})
    else
      render json: JsonApi::Sound.as_json(sound, :wrapper => true, :permissions => @api_user).to_json
    end
  end
  
  def show
    sound = ButtonSound.find_by_path(params['id'])
    return unless exists?(sound)
    return unless allowed?(sound, 'view')
    render json: JsonApi::Sound.as_json(sound, :wrapper => true, :permissions => @api_user).to_json
  end
  
  def update
    sound = ButtonSound.find_by_path(params['id'])
    return unless exists?(sound)
    return unless allowed?(sound, 'view')
    if sound.process(params['sound'])
      render json: JsonApi::Sound.as_json(sound, :wrapper => true, :permissions => @api_user).to_json
    else
      api_error(400, {error: "sound update failed", errors: sound.processing_errors})
    end
  end
end
