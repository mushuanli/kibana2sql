// @ts-check
"use strict";

const util      = require('./util');
const dbdriver  = require('./dbdriver');

let logCtl      = {lock: false,stop:true};


function slog_release(){
}

async function slog_init(){
    return logCtl;
}


async function slog_stat(startTime,endTime,cookie){

  let dbendtime     = await dbdriver.timestamp();
  let dbstarttime   = await dbdriver.timestamp(1);

  let timelimit     = ' timestamp > \'' + startTime + '\' and timestamp < \'' + endTime + '\'';
  let count         = await dbdriver.count(timelimit);
  let cidcount      = await dbdriver.count( timelimit,'distinct cid');
  let s200count     = await dbdriver.count( timelimit + ' and status = 200');
  let s401count     = await dbdriver.count( timelimit + ' and status = 401');
  let s403count     = await dbdriver.count( timelimit + ' and status = 403');
  let s404count     = await dbdriver.count( timelimit + ' and status = 404');
  let s500count     = await dbdriver.count( timelimit + ' and status = 500');
  let s502count     = await dbdriver.count( timelimit + ' and status = 502');
  let s504count     = await dbdriver.count( timelimit + ' and status = 504');
  let sothcount     = await dbdriver.count( timelimit + ' and status not in (200, 401, 403, 404, 500, 502, 504)');
  //cidcount.sort( (a,b) => {return a.c - b.c;});
  util.log("        db rec timestamp info: " + dbstarttime + ' ' + dbendtime);
  util.log("        db info in range: " + '(' + startTime + ' - ' + endTime + ')');
  util.log("           rec count : " + count );
  util.log("           http 200 count : " + s200count );
  util.log("           http 401/403/404 500/502/504 other count : " +
   s401count + '/' + s403count + '/' + s404count + ' ' +
   s500count + '/' + s502count + '/' + s504count + ' ' + sothcount);

  util.log("           cid count : " + cidcount );
  util.log("           top 50 cid   : ");

  await dbdriver.geteach('select count(cid) as c,cid from sloginfo where ' + timelimit + ' group by cid order by c desc limit 50',
  (data) => util.log("           " + data.cid + ' ' + data.c)
 );
 util.log("           top 20 api   : ");

 await dbdriver.geteach("SELECT CASE WHEN INSTR(url, '?') > 0 THEN SUBSTR(url, 1, INSTR(url, '?') - 1) ELSE url END as api,COUNT(*) as c "
 + ' from sloginfo where ' + timelimit + ' group by api order by c desc limit 20',
 (data) => util.log("           " + data.api + ' ' + data.c) );
}

async function slog_pull(startTime,endTime,cookie){
  if( logCtl.lock ){
    util.err("skip sync because other cmd is running!");
    return undefined;
  }
  
  logCtl.lock       = true;
  logCtl.stop       = false;

  let dbendtime     = await dbdriver.timestamp();
  let dbstarttime   = await dbdriver.timestamp(1);

  if( !endTime )
    endTime = new Date().toISOString();
  else if(startTime && startTime < dbstarttime && (endTime < dbendtime && endTime >  dbstarttime )){
    endTime = dbstarttime;  //  when get old record, stop on dbstarttime
  }

  if( !startTime ){
    let date = new Date();
    date.setDate(date.getDate() - 15);
    startTime = date.toISOString();
  }
  if( endTime > dbendtime && startTime < dbendtime ){
    startTime   = dbendtime;    // continue get record, skip downloaded
  }

  let lasttime = startTime;
  let ids   = [];
  while( true ){
    let ack;
    let resp = await util.kibana_get(lasttime,endTime,cookie);
    if( logCtl.stop ){
      util.log(">>>>>   CANCEL: " + lasttime + ' ' + endTime + ' ' );
      break;
    }

    if( resp && resp.rawResponse && resp.rawResponse.hits 
      && resp.rawResponse.hits.hits && Array.isArray(resp.rawResponse.hits.hits)){
            ack = [];
            resp.rawResponse.hits.hits.map( item => {
                if( item._source ){
                    let newitem         = item._source.message ? item._source.message : {};
                    newitem.id          = item._id;
                    newitem.level       = item._source.level;
                    newitem.taskId      = item._source.taskId;
                    newitem.traceId     = item._source.traceId;
                    newitem.timestamp   = item._source.timestamp;
                    ack.push(newitem);
                }
            });
    }
    else{
      util.log('slog Response invalid: ' + startTime + ' ' + endTime + ' ' + JSON.stringify(resp));
      break;
    }
    util.log(">>>>>   " + lasttime + ' ' + endTime + ' ' + ack.length);

    let newids = [];
    let items = [];
    ack.map( item =>{
      if( lasttime !== item.timestamp || !ids.includes(item.id)){
        newids.push(item.id);
        items.push(item);
        }
      });

    let ret = await dbdriver.add(items);
    if( ret ){
      util.log('slog push to db failed: ' + startTime + ' ' + endTime + ' ' + JSON.stringify(ret));
      break;
    }
  
    if( util.kibana_isfinish(ack.length) )
      break;
    ids = newids;
    lasttime = items[items.length-1].timestamp;
  }
  logCtl.lock = false;
}

function setlock(locked){
  logCtl.lock = locked ? true : false;
}


exports.init           = slog_init;
exports.release        = slog_release;

exports.setlock        = setlock;

exports.pull           = slog_pull;
exports.stoppull       = () =>{ logCtl.stop = true;};
exports.stat           = slog_stat;