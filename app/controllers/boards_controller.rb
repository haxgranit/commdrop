class BoardsController < ApplicationController
  def index
    @meta_record = OpenStruct.new
    @meta_record.title = "CoughDrop - Every voice should be heard"
    @meta_record.summary = "Let's help those with complex communication needs make their voices heard, using good technology that actually makes things easier and supports everyone in helping the individual succeed."
    @meta_record.link = "#{request.protocol}://#{request.host_with_port}/"
    @meta_record.created = Time.parse("Jan 1 2014").iso8601
    @meta_record.updated = Time.now.iso8601
    if request.headers['Accept'] == 'image/*'
      redirect_to '/images/logo-small.png'
    end
    
  end
  
  def about
    @meta_record = OpenStruct.new
    @meta_record.title = "About CoughDrop"
    @meta_record.summary = "Why \"CoughDrop\"? Cough drops help you get back the voice you already had, but that maybe people couldn't hear so well. If you're new to the world of augmentative communication, just about every part of it feels intimidating."
    @meta_record.link = "#{request.protocol}://#{request.host_with_port}/about"
    @meta_record.created = Time.parse("Jan 1 2014").iso8601
    @meta_record.updated = Time.now.iso8601
    render :index
  end
  
  def terms; end
  
  def privacy; end
  
  def board
    board = Board.find_by_possibly_old_path(params['id'])
    if board && board.old_link? && request.path != "/#{board.key}"
      return redirect_to "/#{board.key}"
    end
    @meta_record = board && board.public && board.meta_record
    if request.path.match(/\./)
      raise ActiveRecord::RecordNotFound.new("Board paths can't have dots, so this is invalid: #{request.path}")
    end
    if params['embed']
      response.headers.except! 'X-Frame-Options'
    end
    render :index
  end
  
  def user
    user = User.find_by_possibly_old_path(params['id'])
    if user && user.old_link? && request.path != "/#{user.user_name}"
      return redirect_to "/#{user.user_name}"
    end
    @meta_record = user && user.settings['public'] && user.meta_record
    if request.path.match(/\./)
      raise ActiveRecord::RecordNotFound.new("User paths can't have dots, so this is invalid: #{request.path}")
    end
    render :index
  end
  
  def cache
    render :layout => false
  end
  
  def icon
    board = Board.find_by_path(params['id'])
    redirect_to board.icon_url_or_fallback
  end
  
  def utterance
    utterance = Utterance.find_by_global_id(params['id'])
    @meta_record = utterance && utterance.meta_record
    render :index
  end
end
