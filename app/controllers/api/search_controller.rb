require 'mime/types'
class Api::SearchController < ApplicationController
  before_action :require_api_token, :except => [:audio]
  def symbols
    res = Typhoeus.get("https://www.opensymbols.org/api/v1/symbols/search?q=#{CGI.escape(params['q'])}", :ssl_verifypeer => false)
    results = JSON.parse(res.body)
    results.each do |result|
      type = MIME::Types.type_for(result['extension'])[0]
      result['content_type'] = type.content_type
    end
    if results.empty? && params['q'] && RedisInit.default
      RedisInit.default.hincrby('missing_symbols', params['q'].to_s, 1)
    end
    render json: results.to_json
  end
  
  def parts_of_speech
    data = WordData.find_word(params['q'])
    render json: data.to_json
  end
  
  def proxy
    # TODO: must be escaped to correctly handle URLs like 
    # "https://s3.amazonaws.com/opensymbols/libraries/arasaac/to be reflected.png"
    # but it must also work for already-escaped URLs like
    # "http://www.stephaniequinn.com/Music/Commercial%2520DEMO%2520-%252013.mp3"
    uri = URI.parse(params['url']) rescue nil
    uri ||= URI.parse(URI.escape(params['url']))
    # TODO: add timeout for slow requests
    request = Typhoeus::Request.new(uri.to_s, followlocation: true)
    begin
      content_type, body = get_url_in_chunks(request)
    rescue BadFileError => e
      error = e.message
    end
    
    if !error
      str = "data:" + content_type
      str += ";base64," + Base64.strict_encode64(body)
      render json: {content_type: content_type, data: str}.to_json
    else
      api_error 400, {error: error}
    end
  end
  
  def apps
    res = AppSearcher.find(params['q'], params['os'])
    render json: res.to_json
  end
  
  def audio
    req = Typhoeus.get("http://translate.google.com/translate_tts?tl=en&q=#{URI.escape(params['text'] || "")}&client=t", headers: {'User-Agent' => "Mozilla/5.0 (X11; Linux x86_64; rv:39.0) Gecko/20100101 Firefox/39.0"})
    response.headers['Content-Type'] = req.headers['Content-Type']
    send_data req.body, :type => req.headers['Content-Type'], :disposition => 'inline'
  end
  
  def get_url_in_chunks(request)
    content_type = nil
    body = ""
    so_far = 0
    done = false
    request.on_headers do |response|
      if response.success? || response.code == 200
        # TODO: limit to accepted file types
        content_type = response.headers['Content-Type']
        if !content_type.match(/^image/) && !content_type.match(/^audio/)
          raise BadFileError, "Invalid file type, #{content_type}"
        end
      else
        raise BadFileError, "File not retrieved, status #{response.code}"
      end
    end
    request.on_body do |chunk|
      so_far += chunk.size
      if so_far < Uploader::CONTENT_LENGTH_RANGE
        body += chunk
      else
        raise BadFileError, "File too big (> #{Uploader::CONTENT_LENGTH_RANGE})"
      end
    end
    request.on_complete do |response|
      if !response.success? && response.code != 200
        raise BadFileError, "Bad file, #{response.code}"
      end
      done = true
    end
    request.run
    return [content_type, body]
  end
  
  class BadFileError < StandardError
  end
end
