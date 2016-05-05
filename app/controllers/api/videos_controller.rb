class Api::VideosController < ApplicationController
  include RemoteUploader
  before_filter :require_api_token, :except => [:upload_success]

  def create
    video = UserVideo.process_new(params['video'], {:user => @api_user, :remote_upload_possible => true})
    if !video || video.errored?
      api_error(400, {error: "video creation failed", errors: video && video.processing_errors})
    else
      render json: JsonApi::Video.as_json(video, :wrapper => true, :permissions => @api_user).to_json
    end
  end
  
  def show
    video = UserVideo.find_by_path(params['id'])
    return unless exists?(video)
    return unless allowed?(video, 'view')
    render json: JsonApi::Video.as_json(video, :wrapper => true, :permissions => @api_user).to_json
  end
  
  def update
    video = UserVideo.find_by_path(params['id'])
    return unless exists?(video)
    return unless allowed?(video, 'view')
    if video.process(params['video'])
      render json: JsonApi::Video.as_json(video, :wrapper => true, :permissions => @api_user).to_json
    else
      api_error(400, {error: "video update failed", errors: video.processing_errors})
    end
  end
end
