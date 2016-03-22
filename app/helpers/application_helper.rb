module ApplicationHelper
  def pretty_loader
    request.path == '/'
  end
  
  def crawler?
    pattern = /(googlebot|bingbot|baidu|msnbot)/
    !!(request.user_agent && request.user_agent.match(pattern))
  end
end
