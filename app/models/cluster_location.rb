require 'geokit'
require 'ipaddr'
# http://www.movable-type.co.uk/scripts/latlong.html
# https://developers.google.com/places/documentation/search
# https://developers.google.com/maps/documentation/geocoding/#ReverseGeocoding

class ClusterLocation < ActiveRecord::Base
  include GlobalId
  include Permissions
  include Async
  include SecureSerialize
  belongs_to :user
  after_save :generate_stats
  before_save :generate_defaults
#   has_many :ip_sessions, :class_name => 'LogSession', :foreign_key => 'ip_cluster_id'
#   has_many :geo_sessions, :class_name => 'LogSession', :foreign_key => 'geo_cluster_id'
  replicated_model  
  
  add_permissions('view', 'edit') {|user| user.id == self.user_id || (self.user && self.user.allows?(user, 'edit')) }
  # has_paper_trail :only => [:data, :user_id, :cluster_type]
  secure_serialize :data

  def distance_tolerance
    ClusterLocation.default_distance_tolerance
  end
  
  def self.default_distance_tolerance
    0.0621371 # 100 meters
  end
  
  def self.frequency_tolerance
    5
  end
  
  def geo?
    self.cluster_type == 'geo'
  end
  
  def ip_address?
    self.cluster_type == 'ip_address'
  end
  
  def ip_sessions
    # TODO: sharding
    LogSession.where(:ip_cluster_id => self.id)
  end
  
  def geo_sessions
    # TODO: sharding
    LogSession.where(:geo_cluster_id => self.id)
  end
  
  def self.find_or_create_by_cluster(user, type, type_data)
    hash = nil
    if type == 'ip_address'
      hash = GoSecure.sha512(user.id.to_s + "::" + type_data, type)
    elsif type == 'geo'
      hash = GoSecure.sha512(user.id.to_s + type_data.to_json, type)
    end
    res = self.find_or_create_by(user_id: user.id, cluster_type: type, cluster_hash: hash)
    res.data['ip_address'] = type_data if type == 'ip_address'
    res.data['geo'] = type_data if type == 'geo'
    res
  end
  
  def generate_defaults
    self.data ||= {}
    self.cluster_type ||= 'ip_address'
    if self.user_id && self.ip_address? && self.data['ip_address']
      self.cluster_hash = GoSecure.sha512(self.user_id.to_s + "::" + self.data['ip_address'], self.cluster_type)
    elsif self.user_id && self.geo? && self.data['geo']
      self.cluster_hash = GoSecure.sha512(self.user_id.to_s + self.data['geo'].to_json, self.cluster_type)
    end
    true
  end
  
  def generate_stats(frd=false)
    return if @already_generating_stats
    @already_generating_stats = true
    if !frd
      schedule_once(:generate_stats, true)
      return true
    end
    Rails.logger.info("generating stats for #{self.global_id}")
    self.generate_defaults
    
    sessions = []
    if self.ip_address?
      sessions = self.ip_sessions
    elsif self.geo?
      sessions = self.geo_sessions
    end
    
    total_utterances = 0
    button_counts = {}
    board_counts = {}
    total_events = 0
    geos = []
    Rails.logger.info("finding batches #{self.global_id}")
    sessions.find_in_batches(batch_size: 20).with_index do |batch, idx|
      Rails.logger.info("batch set #{idx} #{self.global_id}")
      batch.each do |session|
        if session.data['stats']
          total_utterances += session.data['stats']['utterances']
          session.data['stats']['all_button_counts'].each do |ref, button|
            if button_counts[ref]
              button_counts[ref]['count'] += button['count']
            else
              button_counts[ref] = button.merge({})
            end
          end
          session.data['stats']['all_board_counts'].each do |ref, board|
            if board_counts[ref]
              board_counts[ref]['count'] += board['count']
            else
              board_counts[ref] = board.merge({})
            end
          end
        end
        if self.geo?
          if session.data['geo']
            geos << session.data['geo']
          end
        end
      end
    end
    Rails.logger.info("calculating geo #{self.global_id}")
    # TODO: guess at geo for ip addresses
    if self.geo? && !geos.blank?
      self.data['geo'] = ClusterLocation.median_geo(geos)
      self.data['location_suggestion'] = name_suggestions[0]
    end
    self.data['total_utterances'] = total_utterances
    self.data['total_buttons'] = button_counts.map{|k, v| v['count'] }.sum
    self.data['total_boards'] = board_counts.map{|k, v| v['count'] }.sum
    Rails.logger.info("saving #{self.global_id}")
    self.save
  end
  
  def name_suggestions
    []
    # check the Google Places API for a list of suggested names for this 
    # geolocation let the user specify a name for this location
  end
  
  def self.median_geo(geos)
    return nil if geos.blank?
    lats = []
    longs = []
    alts = []

    geos.each do |geo|
     lats << geo[0]
     longs << geo[1]
     alts << (geo[2] || 0)
    end
    
    lat = Stats.median(lats)
    long = Stats.median(longs)
    alt = Stats.median(alts)
    [lat, long, alt]
  end
  
  def self.add_to_geo_cluster(session, clusters)
    found = false
    clusters.where(:cluster_type => 'geo').find_in_batches(batch_size: 10) do |batch|
      batch.each do |cluster|
        if !found && session.data && session.data['geo'] && cluster.data && cluster.data['geo']
          session_geo = session.geo_object
          cluster_geo = cluster.geo_object
          if session_geo.distance_to(cluster_geo) < cluster.distance_tolerance
            session.geo_cluster_id = cluster.id
            session.save
            cluster.reload.save
            found = true
          end
        end
      end
    end
    found
  end
  
  def self.add_to_ip_cluster(session, clusters)
    found = false
    clusters.where(:cluster_type => 'ip_address').find_in_batches(batch_size: 10) do |batch|
      batch.each do |cluster|
        if !found && session.data && session.data['ip_address'] && cluster.data && cluster.data['ip_address']
          if session.data['ip_address'] == cluster.data['ip_address']
            session.ip_cluster_id = cluster.id
            session.save
            cluster.reload.save
            found = true
          end
        end
      end
    end
    found
  end
  
  def self.add_to_cluster(log_session_id)
    session = LogSession.find_by_global_id(log_session_id)
    # iterate through user's geo clusters, add if inside the geo bounds
    # otherwise schedule a call to clusterize
    # iterate through user's ip clusters, add or create
    if session && session.user_id
      Rails.logger.info("checking clusters for #{session.user_id}")
      clusters = ClusterLocation.where(:user_id => session.user_id)
      Rails.logger.info('adding to geo cluster')
      found_ip = add_to_geo_cluster(session, clusters)
      Rails.logger.info('adding to ip cluster')
      found_geo = add_to_ip_cluster(session, clusters)
      if !found_ip || !found_geo
        self.clusterize(session.user.global_id)
        return false
      else
        return true
      end
    end
    return false
  end
  
  def geo_object
    self.class.geo_object(self)
  end
  
  def self.geo_object(record)
    Geokit::LatLng.new(record.data['geo'][0], record.data['geo'][1])
  end
  
  def self.clusterize_cutoff
    1.month.ago
  end
  
  def self.clusterize(user_id)
    self.schedule(:clusterize_geos, user_id)
    self.schedule(:clusterize_ips, user_id)
  end
  
  def self.clusterize_geos(user_id)
    user = User.find_by_global_id(user_id)
    return unless user
    Rails.logger.info("clusterizing geos for #{user_id}")
    non_geos = []
    # TODO: memory issues from collecting too many logs, so limiting to only the last month
    # and adding find_in_batches. That probably won't be enough to completely fix the problem.
    user.log_sessions.where(:geo_cluster_id => nil).where(['started_at > ?', clusterize_cutoff]).find_in_batches(batch_size: 30) do |batch|
      non_geos += batch.select{|s| s.data['geo'] }
    end
    Rails.logger.info("geos to clusterize: #{non_geos.length}")
    # Time may have passed since this was scheduled, make sure there are no stragglers
    clusters = ClusterLocation.where(:user_id => user.id, :cluster_type => 'geo')
    Rails.logger.info("checking for matches on existing clusters")
    non_geos = non_geos.select{|s| !add_to_geo_cluster(s, clusters) }
    Rails.logger.info("grouping remaining sessions by geo #{non_geos.length}")
    biggest_cluster = nil
    # QT clustering algorithm to find geo hotspots
    while !biggest_cluster || biggest_cluster >= self.frequency_tolerance
      nearbies = {}
      non_geos.each do |session|
        geo = session.geo_object
        non_geos.each do |neighbor|
          neighbor_geo = neighbor.geo_object
          # TODO: bounding box before calculating actual distance (if faster)
          if neighbor_geo.distance_to(geo) < self.default_distance_tolerance
            nearbies[session.id] ||= []
            nearbies[session.id] << neighbor
          end
        end
      end
      id, sessions = nearbies.max_by{|a, b| b.length }
      sessions ||= []
      if sessions.length >= self.frequency_tolerance
        cluster = ClusterLocation.find_or_create_by_cluster(user, 'geo', {ts: Time.now.to_i, r: rand})
        sessions.each do |session|
          session.geo_cluster_id = cluster.id
          session.save
        end
        non_geos -= sessions
        cluster.reload.save
      end
      biggest_cluster = sessions.length
    end
    Rails.logger.info("done with geo clusters")
  end
    
  def self.clusterize_ips(user_id)
    user = User.find_by_global_id(user_id)
    return unless user
    Rails.logger.info("clusterizing ips for #{user_id}")
    # ip addresses just cluster based on exact match. Easy peasy.
    ips = {}
    non_ips = []
    user.log_sessions.where(:ip_cluster_id => nil).where(['started_at > ?', clusterize_cutoff]).find_in_batches(batch_size: 30) do |batch|
      non_ips += batch.select{|s| s.data['ip_address'] }
    end
    Rails.logger.info("ips to clusterize: #{non_ips.length}")
    clusters = ClusterLocation.where(:user_id => user.id, :cluster_type => 'ip_address')
    # Time may have passed since this was scheduled, make sure there are no stragglers
    non_ips = non_ips.select{|s| !add_to_ip_cluster(s, clusters) }
    Rails.logger.info("tracking new ip addresses #{non_ips.length}")
    non_ips.each do |session|
      if session.data['ip_address']
        ips[session.data['ip_address']] ||= []
        ips[session.data['ip_address']] << session
      end
    end
    Rails.logger.info("generating new ip clusters")
    ips.each do |ip, sessions|
      readable_ip = sessions.first.data['readable_ip_address']
      cluster = ClusterLocation.find_or_create_by_cluster(user, 'ip_address', ip)
      cluster.data['readable_ip_address'] = readable_ip
      sessions.each do |session|
        session.ip_cluster_id = cluster.id
        session.save
      end
      cluster.save
    end
    Rails.logger.info("done with ip clusters")
  end
  
  def self.calculate_attributes(session)
    res = {}
    geos = []
    events = session.data['events'] || []
    events.each do |event|
      if event['geo']
        geos << event['geo'].map(&:to_f)
      end
    end
    res['geo'] = self.median_geo(geos)
    ips = events.map{|e| e['ip_address'] }.compact
    max_ip, list = ips.group_by{|ip| ip}.max_by{|a, b| b.length }
    readable_ip = nil
    if max_ip
      # canonicalize ip address
      ip = IPAddr.new(max_ip)
      readable_ip = ip.to_s
      ip = ip.ipv4_mapped if ip.ipv4?
      max_ip = ip.to_string
    end
    res['readable_ip_address'] = readable_ip
    res['ip_address'] = max_ip
    res
  end
end
