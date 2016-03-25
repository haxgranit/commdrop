web: bundle exec puma -C config/puma.rb
resque: env QUEUE=* INTERVAL=1 TERM_CHILD=1 bundle exec rake environment resque:work
resque_priority: env QUEUES=priority,default INTERVAL=0.5 TERM_CHILD=1 bundle exec rake environment resque:work
ember: sh -c 'cd ./app/frontend/ && ember server'
