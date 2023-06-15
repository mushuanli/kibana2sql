// @ts-check
"use strict";

const util = require('./util');

const table_fields = "id TEXT PRIMARY KEY, timestamp TEXT, status INTEGER, \
cid TEXT, taskId TEXT, traceId TEXT,  \
access INTEGER,  detail TEXT,  level TEXT, method TEXT, ppid TEXT, processTime INTEGER, \
remoteAddr TEXT, remoteTime INTEGER, respMessage TEXT, responseTime INTEGER, role TEXT, \
url TEXT";

let hdb;
async function sql_init(){
    const sqlite = require('sqlite3').verbose();
    hdb = new sqlite.Database('./database.db',sqlite.OPEN_READWRITE|sqlite.OPEN_CREATE, (err) => {
    if (err) {
      throw err;
    }
    util.log('Connected to the database.');
  });

  if( !hdb ){
    throw new Error("create DB FAILEd, exit!");
  }

  hdb.serialize(() => {
    hdb.run("CREATE TABLE IF NOT EXISTS sloginfo (" + table_fields + ")",function(err) {
      if (err) {
        throw err;
      }
    });

    let createIndexSql = 'CREATE INDEX IF NOT EXISTS idx_sloginfo_timestamp ON sloginfo(timestamp)';
    hdb.run(createIndexSql, [], function(err) {
      if (err) {
          throw err;
        } else {
          util.log("Index on timestamp created");
      }
    });
  });

  return hdb;
}

async function slog_batchadd(items,sn){
  //util.log("   ++ db start insert ",sn + '+' + items.length);

  let placeholders = items.map((item) => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
  let sql = 'INSERT OR IGNORE INTO sloginfo VALUES ' + placeholders; //OR IGNORE 
  
  let data = [];
  items.forEach((item) => {
      data.push(item.id,item.timestamp,item.status, 
        item.cid,item.taskId,item.traceId,  
        item.access, item.detail, item.level,item.method,item.ppid,item.processTime, 
        item.remoteAddr,item.remoteTime,item.respMessage,item.responseTime,item.role,
        item.url
      );
  });
  
  hdb.run("BEGIN TRANSACTION");
  
  let ret1 = await new Promise((resolve, reject) => {
    hdb.run(sql, data, function(err) {
      if (err) {
          util.err("    DB INSERT ERROR: " + sn + '+' + items.length + ' ' + err.message);
          reject(err);
        } else {
          //util.log("    DB INSERT SUCC:",sn + '+' + items.length);
          resolve(undefined);
      }
  });
});

 let ret2 = await new Promise((resolve, reject) => {
  hdb.run("COMMIT",err => {
      if (err) {
        util.err("    DB COMMIT ERROR: " + sn + '+' + items.length + ' ' + err.message);
        reject(err);
      } else {
        //util.log("    DB COMMIT SUCC:",sn + '+' + items.length);
        resolve(undefined);
      }
    });
  });

  if( ret1 && ret2 )
    util.log("   ++ db end insert on error " + sn + '+' + items.length + ': ' + ret1 + ' ' + ret2);
  if( ret1 === undefined )
    return ret2;
  else
    return ret1;
}

async function sql_add(loglist){
  const chunkSize = 400;
  for (let i = 0; i < loglist.length; i += chunkSize) {
      const chunk = loglist.slice(i, i + chunkSize);
      let ret = await slog_batchadd(chunk,i);
      if( ret )
        return ret;
      // do whatever
  }

  return undefined;
}

async function sql_get(sql){
  return new Promise((resolve, reject) => {
    hdb.get(sql,[],(err,data) => {
      if (err) {
        util.err("    DB get ERROR: " + err.message);
        reject(undefined);
      } else {
        resolve(data);
      }
    });
  });
}

async function sql_all(sql){
  return new Promise((resolve, reject) => {
    hdb.all(sql,[],(err,data) => {
      if (err) {
        util.err("    DB all ERROR: " + err.message);
        reject(undefined);
      } else {
        resolve(data);
      }
    });
  });
}


async function sql_each(sql,callback){
  return new Promise(function(resolve, reject) {
    hdb.serialize(function() {
      hdb.each(sql, [], function(err, row) {
      if(err) reject("Read error: " + err.message)
      else {
       if(row) {
        callback(row)
       } 
      }
     })
     hdb.get("", function(err, row) {
      resolve(true)
     })   
    })
   });
}

async function sql_getcount(condition,val){
  if( !val) val = '*';
  let ack = await sql_get('select count(' +val+ ') as c from sloginfo where '+condition);
  return ack ? ack.c : 0;
}


async function sql_gettimestamp(first){
  let ret = await sql_get('select timestamp from sloginfo order by timestamp ' + (first ? 'asc' : 'desc') + ' limit 1');
  if( ret ){
    //util.log("    DB get timestamp SUCC: " + ret.timestamp);
    return ret.timestamp;
  }
  else
  return ret;
}

exports.init    = sql_init;
exports.release = () => {hdb.close();}

exports.tablename = () => { return 'sloginfo'; }
exports.tabledef = () => { return table_fields; }

exports.add     = sql_add;
exports.get     = sql_get;
exports.getall  = sql_all;
exports.geteach  = sql_each;
exports.count     = sql_getcount;
exports.timestamp   = sql_gettimestamp;