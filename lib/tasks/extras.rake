task "extras:copy_terms" => :environment do
  ['privacy', 'terms', 'jobs'].each do |type|
    str = "<!-- auto-generated app/views/shared/_#{type}.html.erb -->\n"
    str += File.read("./app/views/shared/_#{type}.html.erb")
    File.open("./app/frontend/app/templates/#{type}.hbs", 'w') do |f|
      f.puts str
    end
  end
end

task "extras:clear_report_tallies" => :environment do
  RedisInit.default.del('missing_words')
  RedisInit.default.del('missing_symbols')
end

task "extras:version" => :environment do
  str = File.read('./app/assets/javascripts/application-preload.js')
  match = str.match(/window\.app_version\s+=\s+\"([0-9\.]+)(\w*)\";/)
  version = match[1]
  revision = match[2]
  date_version = Date.today.strftime('%Y.%m.%d')
  if version == date_version
    if revision == ""
      revision = 'a'
    elsif revision[-1] == 'z'
      revision = revision[0..-2] + 'aa'
    else
      revision = revision[0..-2] + (revision[-1].ord + 1).chr
    end
    date_version += revision
  end
  str.sub!(/window\.app_version\s*=\s*\"[^\"]*\";/, "window.app_version = \"#{date_version}\";")
  File.write('./app/assets/javascripts/application-preload.js', str)
  puts date_version
end

task "extras:mobile" => :environment do
  folder = 'coughdrop_mobile'
  js = nil
  css = nil
  Dir.glob('./public/assets/application-*') do |fn|
    if fn.match(/\.js$/)
      js = fn
    elsif fn.match(/\.css$/)
      css = fn
    end
  end
  if !js || !css
    raise "need both a js and css to be created"
  end
  puts "copying static assets"
  puts `cp ./public/images/* ../#{folder}/www/images`
  puts `cp ./public/fonts/* ../#{folder}/www/fonts`
  puts `cp ./public/icons/* ../#{folder}/www/assets/icons`
  puts "replacing cordova files"
  str = File.read(js)
  File.write("../#{folder}/www/app.js", str)
  str = File.read(css)
  File.write("../#{folder}/www/css/app.css", str)
  content = File.read("../#{folder}/www/index.html")
  str = ""
  if ENV['TRACK_JS_TOKEN']
    str += "<script type=\"text/javascript\" async src=\"//d2zah9y47r7bi2.cloudfront.net/releases/current/tracker.js\" data-token=\"#{ ENV['TRACK_JS_TOKEN'] }\"></script>"
  end
  str += "\n<div id='enabled_frontend_features' data-list='#{FeatureFlags::ENABLED_FRONTEND_FEATURES.join(',')}'></div>"

  pre, chunk = content.split(/<!-- begin generated content -->/)
  chunk, post = chunk.split(/<!-- end generated content -->/)
  content = pre + "<!-- begin generated content -->\n" + str + "\n\n<!-- end generated content -->" + post
  File.write("../#{folder}/www/index.html", content)
  puts "updating phonegap version"
  
  str = File.read("../#{folder}/www/manifest.json")
  date_version = Date.today.strftime('%Y.%m.%d')
  str = str.sub(/\"version\"\s*:\s*\"[^\"]+\"/, "\"version\": \"#{date_version}\"")
  File.write("../#{folder}/www/manifest.json", str)
  
  str = File.read("../#{folder}/config.xml")
  date_version = Date.today.strftime('%Y.%m.%d')
  str = str.sub(/version\s*=s*\"[^\"]+\"/, "version=\"#{date_version}\"")
  File.write("../#{folder}/config.xml", str)

  puts "installing on android phone"
  Dir.chdir("../#{folder}"){
    puts `cordova run android --device`
  }
end