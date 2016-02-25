class Api::BoardsController < ApplicationController
  extend ::NewRelic::Agent::MethodTracer
  before_filter :require_api_token, :except => [:index, :user_index, :show, :download]

  def index
    boards = Board
    if params['user_id']
      user = User.find_by_path(params['user_id'])
      return unless allowed?(user, 'view_detailed')
      unless params['starred']
        if params['shared']
          arel = Board.arel_table
          shared_board_ids = Board.all_shared_board_ids_for(user)
          # TODO: fix when sharding actually happens
          boards = boards.where(arel[:id].in(Board.local_ids(shared_board_ids)))
        elsif params['include_shared'] && (user.settings['boards_shared_with_me'] || []).length > 0
          arel = Board.arel_table
          shared_board_ids = Board.all_shared_board_ids_for(user)
          # TODO: fix when sharding actually happens
          boards = boards.where(arel[:user_id].eq(user.id).or(arel[:id].in(Board.local_ids(shared_board_ids))))
        else
          boards = boards.where(:user_id => user.id)
        end
      end
      if !params['public']
        return unless allowed?(user, 'supervise')
      end
      if params['private']
        boards = boards.where(:public => false)
      end
      if params['starred']
        # TODO: this still won't include boards of people I supervise... (because it shouldn't)
        boards = boards.where(['user_id = ? OR public = ?', user.id, true])
        ids = (user.settings['starred_board_ids'] || [])
        # TODO: fix when sharding actually happens
        boards = boards.where(:id => Board.local_ids(ids))
      end
    else
      boards = boards.where(:public => true)
    end
    # TODO: where(:public => true) as the cancellable default
    if params['key']
      keys = [params['key']]
      if @api_user
        keys << "#{@api_user.user_name}/#{params['key']}"
      end
      boards = boards.where(:key => keys)
    end
    if params['q'] && params['public']
      q = CGI.unescape(params['q']).downcase
      # TODO: real search via https://github.com/casecommons/pg_search or elasticsearch with facets
      boards = boards.search_by_text(q) #where(['search_string ILIKE ?', "%#{q}%"])
    end
    if params['public']
      boards = boards.where(:public => true)
    end
    if params['sort']
      if params['sort'] == 'popularity'
        boards = boards.order(popularity: :desc, home_popularity: :desc, id: :desc)
      elsif params['sort'] == 'home_popularity'
        boards = boards.where(['home_popularity > ?', 0]).order(home_popularity: :desc, id: :desc)
      end
    else
      boards = boards.order(popularity: :desc, any_upstream: :asc, id: :desc)
    end
    
    # Private boards don't have search_string set as a column to protect against 
    # leakage of private information. This iterative method is slower than a db clause
    # but the number of private boards is probably going to be small enough that it's ok.
    # TODO: assumptions containing the word "probably" tend to break sooner than you think
    if params['q'] && !params['public']
      boards = boards.select{|b| (b.settings['search_string'] || "").match(/#{CGI.unescape(params['q']).downcase}/i) }
    end

    render json: JsonApi::Board.paginate(params, boards)
  end
  
  def show
    board = Board.find_by_path(params['id'])
    if !board
      deleted_board = DeletedBoard.find_by_path(params['id'])
      user = deleted_board && deleted_board.user
      res = {error: "Record not found"}
      res[:id] = params['id']
      if user && user.allows?(@api_user, 'view_deleted_boards')
        res[:deleted] = true
        res[:key] = deleted_board.key
        return api_error 404, res
      elsif params['id'].match(/\//)
        user = User.find_by_path(params['id'].split(/\//)[0])
        if user && user.allows?(@api_user, 'view_deleted_boards')
          res[:never_existed] = true
          return api_error 404, res
        end
      end
      return unless exists?(board)
    end
    allowed = false
    self.class.trace_execution_scoped(['boards/board/permission_check']) do
      allowed = allowed?(board, 'view')
    end
    return unless allowed
    json = {}
    self.class.trace_execution_scoped(['boards/board/json_render']) do
      json = JsonApi::Board.as_json(board, :wrapper => true, :permissions => @api_user)
    end
    render json: json.to_json
  end
  
  def create
    @board_user = @api_user
    if params['board'] && params['board']['for_user_id'] && params['board']['for_user_id'] != 'self'
      user = User.find_by_path(params['board']['for_user_id'])
      return unless allowed?(user, 'edit')
      @board_user = user
    end
    board = Board.process_new(params['board'], {:user => @board_user, :key => params['board']['key']})
    if board.errored?
      api_error(400, {error: "board creation failed", errors: board && board.processing_errors})
    else
      render json: JsonApi::Board.as_json(board, :wrapper => true, :permissions => @api_user).to_json
    end
  end
  
  def share_response
    board = Board.find_by_path(params['board_id'])
    return unless exists?(board)
    return unless allowed?(board, 'view')
    approve = !!(params['approve'] == 'true' || params['approve'] == true || params['approve'] == 1 || params['approve'] == '1')
    if board.update_shares_for(@api_user, approve)
      render json: {updated: true, approved: approve}.to_json
    else
      api_error(400, {error: "board share update failed"})
    end
  end
  
  def update
    board = Board.find_by_path(params['id'])
    return unless exists?(board)
    return unless allowed?(board, 'edit')
    if board.process(params['board'], {:user => @api_user, :starrer => @api_user})
      render json: JsonApi::Board.as_json(board, :wrapper => true, :permissions => @api_user).to_json
    else
      api_error(400, {error: "board update failed", errors: board.processing_errors})
    end
  end
  
  def history
    board_id = nil
    board = Board.find_by_path(params['board_id'])
    deleted_board = DeletedBoard.find_by_path(params['board_id'])
    return unless exists?(board || deleted_board)
    if board
      return unless allowed?(board, 'edit')
      board_id = board.id
    elsif deleted_board && deleted_board.user
      return unless allowed?(deleted_board.user, 'view_deleted_boards')
      board_id = deleted_board.board_id
    end
    return unless exists?(board_id)
    versions = PaperTrail::Version.where(:item_type => 'Board', :item_id => board_id).where('whodunnit IS NOT NULL').order('id DESC')
    render json: JsonApi::BoardVersion.paginate(params, versions)
  end
  
  def rename
    board = Board.find_by_path(params['board_id'])
    return unless exists?(board)
    return unless allowed?(board, 'edit')
    if params['new_key'] && params['old_key'] == board.key && board.rename_to(params['new_key'])
      render json: {rename: true, key: params['new_key']}.to_json
    else
      api_error(400, {error: "board rename failed", key: params['key'], collision: board.collision_error?})
    end
  end
  
  def unlink
    board = Board.find_by_path(params['board_id'])
    user = User.find_by_path(params['user_id'])
    type = params['type']
    return unless exists?(board)
    return unless allowed?(user, 'edit')
    if type == 'delete'
      return unless allowed?(board, 'delete')
      board.destroy
    elsif type == 'unstar'
      board.star!(user, false)
    elsif type == 'unlink'
      board.unshare_with(user)
    else
      return api_error(400, {error: "unrecognized type"})
    end
    render json: {removed: true, type: type}.to_json
  end
  
  def star
    star_or_unstar(true)
  end
  
  def unstar
    star_or_unstar(false)
  end
  
  def stats
    board = Board.find_by_path(params['board_id'])
    return unless allowed?(board, 'view')
    render json: Stats.board_use(board.global_id, {}).to_json
  end
  
  def destroy
    board = Board.find_by_path(params['id'])
    return unless exists?(board)
    return unless allowed?(board, 'delete')
    board.destroy
    render json: JsonApi::Board.as_json(board, :wrapper => true).to_json
  end
  
  def download
    board = Board.find_by_path(params['board_id'])
    return unless exists?(board)
    return unless allowed?(board, 'view')
    progress = Progress.schedule(board, :generate_download, (@api_user && @api_user.global_id), params['type'], params['include'], params['headerless'])
    render json: JsonApi::Progress.as_json(progress, :wrapper => true).to_json
  end
  
  def import
    if params['url']
      progress = Progress.schedule(Board, :import, @api_user.global_id, params['url'])
      render json: JsonApi::Progress.as_json(progress, :wrapper => true).to_json
    else
      type = (params['type'] == 'obz' ? 'obz' : 'obf')
      remote_path = "imports/boards/#{@api_user.global_id}/upload-#{Security.nonce('filename')}.#{type}"
      content_type = "application/#{type}"
      params = Uploader.remote_upload_params(remote_path, content_type)
      url = params[:upload_url] + remote_path
      params[:success_url] = "/api/v1/boards/imports?type=#{type}&url=#{CGI.escape(url)}"
      render json: {'remote_upload' => params}.to_json
    end
  end

  protected
  def star_or_unstar(star)
    board = Board.find_by_path(params['board_id'])
    return unless exists?(board)
    return unless allowed?(board, 'view')
    board.star!(@api_user, star)
    render json: {starred: board.starred_by?(@api_user), stars: board.stars}.to_json
  end
  
end
