// @ts-check
"use strict";

const axios     = require('axios');

let logfunc = console.log;
let errfunc = console.error;

function log_out(message){
    logfunc(message);
}

function err_out(message){
    errfunc(message);
}

function setout(outfunc){
    if( outfunc ){
        logfunc = outfunc;
        errfunc = outfunc;  
      }
      else{
        logfunc = console.log;
        errfunc = console.error;
      }
}

function kibana_init()
{
  let config  = require("./config.json");
  if( typeof(config) !== "object" 
      || !config.cookie || !config.url || !config.head || !config.body 
      ){
        errfunc("invalid config.json !")
      return undefined;
  }
  //  @ts-ignore
  config.head.cookie  = config.cookie;
   
  return {
     url:config.baseurl + config.url, head: config.head, body: config.body};
}

let kibanaCtl;
/**
 * 
 * @param {*} [startTime]
 * @param {*} [endTime]
 * @param {*} [cookie]
 * @returns {Promise<undefined|object>}
 */
async function kibana_get(startTime,endTime,cookie){
  if( kibanaCtl === undefined ){
    kibanaCtl = kibana_init();
    if( kibanaCtl === undefined ){
      errfunc("KIBANA: invalid instance !");
      return undefined;
    }
  }
  
  if( startTime ){
      if( !endTime || startTime >= endTime ){
          errfunc("KIBANA: invalid time " + startTime + " > endTime, skip");
          return undefined;
      }
      kibanaCtl.body.params.body.query.bool.filter[1].range.timestamp.gte = startTime;        
  }
  if( endTime )
    kibanaCtl.body.params.body.query.bool.filter[1].range.timestamp.lte = endTime;        
  if( cookie )
    kibanaCtl.head.cookie  = cookie;

  const headers = kibanaCtl.head;
  let ack=undefined;
  try{
    // @ts-ignore
    ack = await axios.post(kibanaCtl.url, kibanaCtl.body, {headers} );
    ack = ack.data;
  }
  catch(error){
    errfunc('get slog resp Error: ' + startTime +  ' ' + endTime + ' ' + error.message);
  }

  return ack;
}

function kibana_isfinish(length){
  return length +1 < kibanaCtl.body.params.body.size ;
}


exports.log         = log_out;
exports.err         = err_out;
exports.redirect    = setout;

exports.kibana_get      = kibana_get;
exports.kibana_isfinish = kibana_isfinish;