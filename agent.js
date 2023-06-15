// @ts-check
"use strict";

if ('undefined' === typeof require || require.main !== module) {
    process.exit(1);
}

let logop   = require("./logop");
let httpdop = require("./httpd");
const dbdriver  = require('./dbdriver');

let agentCtl    = {
    stop: false
};

async function cmd_login(send,startTimestamp, endTimestamp, cookie){
    agentCtl.stop = false;

    send({ result: 'OK', 
    dbname: dbdriver.tablename(),
    dbfields: dbdriver.tabledef(),
    message: 'Session updated' });
}

async function cmd_stat(send,startTimestamp, endTimestamp, cookie){
    agentCtl.stop = false;
    try{
        await logop.stat(startTimestamp, endTimestamp,cookie);
        send(">>>      get stat succ");
    }catch(err){
        send(">>>      get stat error: " + err.message);
    }
//    logop.setlogfunc(undefined);
}

async function cmd_sync(send,startTimestamp, endTimestamp, cookie){
    agentCtl.stop = false;

    try{
        await logop.pull(startTimestamp, endTimestamp,cookie);
        send(">>>      sync log succ");
    }catch(err){
        send(">>>      sync log error: " + err.message);
    }
    logop.setlock(false);
}

async function cmd_sql(send,startTimestamp, endTimestamp, sql){
    agentCtl.stop = false;
    if( !sql ){
        send('>>>         missing SQL string');
        return;
    }
    try{
        let count = 0;
        send(' run sql cmd: ' + sql);
        let origorder = ['timestamp','id','access','ppid','responseTime','cid','taskId','traceId','level','processTime','remoteAddr','remoteTime','respMessage','status','method','url','role','detail'];
        let outorder ;
        let callback = (data) => {
            if (agentCtl.stop || count > 1000) {
                throw new Error("stop by too many records.");
                return;
            }
            count++;
            let outstr = 'no ';
            if (count === 1) {
                let v = Object.keys(data);
                outorder = origorder.filter(item => v.includes(item));
                v.map(item => {
                    if (!outorder.includes(item))
                        outorder.push(item);
                });
                outorder.map(item => {
                    outstr += `${item}  `;
                });
                send(outstr);
            }
            outstr=`${count}  `;
            outorder.map(item => {
                outstr += `${data[item]}  `;
            });
            send(outstr);
        }
        await dbdriver.geteach(sql,callback);
        send(' run sql cmd finish. ');
    }
    catch(err){
        send(' sql cmd err: ' + err.message);
    }
}

async function main() {
  try{
    await dbdriver.init();
    await logop.init();
    await httpdop.init();

    httpdop.setcmd('login',cmd_login);
    httpdop.setcmd('stat',cmd_stat);
    httpdop.setcmd('sql',cmd_sql);
    httpdop.setcmd('sync',cmd_sync);
    httpdop.setcmd('stop',send => {send(">>>     stop ");logop.stoppull(); });

    console.log("Starting the main process...");
    await httpdop.run(3000);
  }catch(err){
    console.log("parse error",err);
  }

  //await logop.release();
  console.log("Main process completed!");
}
  
main();
  