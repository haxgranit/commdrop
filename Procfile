web: bundle exec puma -C config/puma.rb
resque: env QUEUES=priority,default INTERVAL=0.2 TERM_CHILD=1 bundle exec rake environment resque:work
resque_priority: env QUEUES=priority,default INTERVAL=0.2 TERM_CHILD=1 bundle exec rake environment resque:work
resque_slow: env QUEUES=priority,slow,whenever,default INTERVAL=0.2 TERM_CHILD=1 bundle exec rake environment resque:work
ember: sh -c 'cd ./app/frontend/ && ember server --port 8181'
