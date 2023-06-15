* run:
  when start, listen on :3000 port, can use http to access control UI.  
  it support these commands:  
  - stat: get current sqlite3 database summary info.
  - sync: sync log from kibana into local sqlite3 db, addtional info set the http header's cookie  
  - stop: stop sync sync kibana logs.
  - sql:  run sql command on local sqlite3 db

* it only support one user, all the log output into webpage.
