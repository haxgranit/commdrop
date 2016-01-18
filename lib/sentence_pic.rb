require 'tempfile'
module SentencePic
  PER_ROW=6
  def self.generate(utterance)
    raise "utterance must be saved first" unless utterance && utterance.id
    images = {}
    return unless utterance.data['button_list']
    utterance.data['button_list'].map{|b| b['image'] }.uniq.each do |url|
      filename = OBF::Utils.save_image({'url' => url})
      images[url] = filename
    end
    image_commands = []
    utterance.data['button_list'].each do |button|
      filename = images[button['image']]
      image_commands << "-label \"#{(button['label'] || button['vocalization'] || '').gsub("\"", "\\\"")}\" #{filename}"
    end
    montage = OBF::Utils.temp_path('montage') + '.png'
    rows = (image_commands.length.to_f / PER_ROW.to_f).ceil
    columns = PER_ROW
    width = 70
    height = 70
    if image_commands.length < PER_ROW
      columns = image_commands.length
      width = [420 / columns, 200].min
      height = width
    elsif image_commands.length < PER_ROW * 2
      columns = (image_commands.length.to_f / 2.0).ceil
    end
    
    `montage #{image_commands.join(' ')} -tile #{columns}x#{rows} -shadow -pointsize 16 -geometry #{width}x#{height}+3+10 -border 2 -bordercolor "#888" #{montage}`
    preview = OBF::Utils.temp_path('preview') + '.png'
    if image_commands.length > PER_ROW * 2
      `convert #{montage} -gravity north -extent 500x240 #{preview}`
    else
      `convert #{montage} -gravity center -extent 500x240 #{preview}`
    end
    key = Security.sha512(utterance.id.to_s, 'utterance_id')[0, 25]
    remote_path = "sentences/#{utterance.id}/#{key}/preview.png"
    url = Uploader.remote_upload(remote_path, preview, 'image/png')
    url
  end
end