// @ts-check
"use strict";

const session = require('express-session');
const express = require('express');
const http = require('http');
const uuid = require('uuid');

const { WebSocketServer } = require('ws');

const util = require('./util');

function onSocketError(err) {
  console.error(err);
}

let svrInfo = { cmds: {}}

function init(){
    const app = express();
    const map = new Map();
    

    //
    // We need the same instance of the session parser in express and
    // WebSocket server.
    //
    const sessionParser = session({
      saveUninitialized: false,
      secret: '$eCuRiTy',
      resave: false
    });

    //
    // Serve static files from the 'public' folder.
    //
    app.use(express.static('public'));
    app.use(sessionParser);

    //
    // Create an HTTP server.
    //
    const server = http.createServer(app);

    //
    // Create a WebSocket server completely detached from the HTTP server.
    //
    const wss = new WebSocketServer({ clientTracking: false, noServer: true });
    
    svrInfo.app     = app;
    svrInfo.map     = map;
    svrInfo.wss     = wss;
    svrInfo.server  = server;

    server.on('upgrade', function (request, socket, head) {
        socket.on('error', onSocketError);
    
        console.log('Parsing session from request...');
    
        // @ts-ignore
        sessionParser(request, {}, () => {
        // @ts-ignore
        if (!request.session.userId) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }
    
        console.log('Session is parsed!');
    
        socket.removeListener('error', onSocketError);
    
        svrInfo.wss.handleUpgrade(request, socket, head, function (ws) {
            svrInfo.wss.emit('connection', ws, request);
        });
        });
    });
    
    wss.on('connection', function (ws, request) {
        // @ts-ignore
        const userId = request.session.userId;
    
        svrInfo.map.set(userId, ws);
    
        ws.on('error', console.error);
    
        ws.on('message', async function (message) {
            // @ts-ignore
            const { startTimestamp, endTimestamp, command, info } = JSON.parse(message);
            let cmd = svrInfo.cmds[command];
            let sendfunc = msg => ws.send(msg);
            if( cmd ){
                util.redirect(sendfunc);
                await cmd(sendfunc,startTimestamp, endTimestamp, info);
            }
            else{
                ws.send("unable to parse cmd: " + command);
            }

            console.log(`Received message ${message} from user ${userId}`);
        });
    
        ws.on('close', function () {
            util.redirect(undefined);
            svrInfo.map.delete(userId);
        });
    });

    app.post('/login', function (req, res) {
        //
        // "Log in" user and set userId to session.
        //
        const id = uuid.v4();
      
        console.log(`Updating session for user ${id}`);
        // @ts-ignore
        req.session.userId = id;
        let sendfunc = msg => res.send(msg);
        svrInfo.cmds['login'](sendfunc);
      });
      
      app.delete('/logout', function (request, response) {
        // @ts-ignore
        const ws = svrInfo.map.get(request.session.userId);
      
        console.log('Destroying session');
        request.session.destroy(function () {
          if (ws) ws.close();
      
          response.send({ result: 'OK', message: 'Session destroyed' });
        });
      });
}

function setcmd(name,func){
    svrInfo.cmds[name] = func;
}







//
// Start the server.
//
function run(port){
    svrInfo.server.listen(port, function () {
        console.log('Listening on http://localhost:' + port);
      });
}

exports.init    = init;
exports.setcmd  = setcmd;
exports.run     = run;