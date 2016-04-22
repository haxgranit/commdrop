module MediaObject
  extend ActiveSupport::Concern
  
  def update_media_object(opts)
    if self.settings['full_filename'] != opts['filename']
      Uploader.remote_remove(self.settings['full_filename'])
      self.settings['full_filename'] = opts['filename']
      self.settings['content_type'] = opts['content_type']
      self.settings['duration'] = opts['duration']
      self.settings['thumbnail_filename'] = opts['thumbnail_filename']
      self.save
    else
      false
    end
  end
  
  def media_object_error(opts)
    self.settings['media_object_errors'] ||= []
    self.settings['media_object_errors'] << opts
    self.save
  end
  
  def schedule_transcoding
    return true if self.settings['transcoding_attempted']
    if self.settings['full_filename']
      method = self.is_a?(ButtonSound) ? :convert_audio : :convert_video
      prefix = self.file_prefix + "-" + Time.now.to_i.to_s
      Worker.schedule(Transcoder, method, self.global_id, prefix)
      self.settings['transcoding_attempted'] = true
      self.save
    end
  end

  included do
    after_save :schedule_transcoding
  end
end
