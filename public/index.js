let globalVariable = {
  dbname:   '',
  dbfields: ''
};

window.onload = function () {
    const date = new Date();
    const year = date.getFullYear();
    let month = date.getMonth() + 1; // getMonth() returns 0-11, so we add 1

    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;

    month = month < 10 ? '0' + month : month;
    const nextMonthPadded = nextMonth < 10 ? '0' + nextMonth : nextMonth;

    const startTimestamp = `${year}-${month}-01T00:00:00`;
    const endTimestamp = `${nextYear}-${nextMonthPadded}-01T00:00:00`;

    document.getElementById('startTimestamp').value = startTimestamp;
    document.getElementById('endTimestamp').value = endTimestamp;
    
    const startTimestampInput = document.getElementById('startTimestamp');
    const endTimestampInput   = document.getElementById('endTimestamp');
    const command             = document.getElementById('command');
    const infoInput           = document.getElementById('info');
    
    command.addEventListener('change', function() {
      updateSqlInfo();
    });

    startTimestampInput.addEventListener('change', updateSqlInfo);
    endTimestampInput.addEventListener('change', updateSqlInfo);

    function toISOStringWithLocalOffset(localDatetime) {
          // datetime-local input value format: yyyy-mm-ddThh:mm
    const [date, time] = localDatetime.split('T');
    const [year, month, day] = date.split('-');
    const [hour, minute] = time.split(':');

    // Create a new Date object in UTC with the parsed values
    // Note: months in the Date constructor are 0-indexed
    return new Date(Date.UTC(year, month - 1, day, hour, minute)).toISOString();
    }

    function updateSqlInfo() {
        if (command.value === 'sql' && globalVariable.dbname !== '' ) {
            let startTimestamp = startTimestampInput.value;
            let endTimestamp = endTimestampInput.value;
   
            // Convert datetime-local input values to a timestamp format that your SQL server accepts.
            startTimestamp = startTimestamp ? `"${toISOStringWithLocalOffset(startTimestamp)}"` : '$startTimestamp';
            endTimestamp = endTimestamp ? `"${toISOStringWithLocalOffset(endTimestamp)}"` : '$endTimestamp';

            //const messages      = document.querySelector('#messages');
            //messages.textContent += `\n${message}`;

            let currentInfo = infoInput.value;
            if( !currentInfo.includes(globalVariable.dbname) ){
              infoInput.value = `select detail from ${globalVariable.dbname} where timestamp >= ${startTimestamp} and timestamp <= ${endTimestamp} limit 200 `;
            }
            else {
              const regex = /where timestamp >= (.*?) and timestamp <= (.*?)(?=($|\s))/;
              const replacement = `where timestamp >= ${startTimestamp} and timestamp <= ${endTimestamp}`;
              currentInfo = currentInfo.replace(regex, replacement);
              infoInput.value = currentInfo;
            }
        }
    }
};

(function () {
    const messages      = document.querySelector('#messages');
    const wsCleanButton = document.querySelector('#wsCleanButton');
    const wsSendButton  = document.querySelector('#wsSendButton');
    const logout        = document.querySelector('#logout');
    const login         = document.querySelector('#login');

    function showMessage(message) {
      messages.textContent += `\n${message}`;
      messages.scrollTop = messages.scrollHeight;
    }
  
    function handleResponse(response) {
      return response.ok
        ? response.json().then((data) => JSON.stringify(data, null, 2))
        : Promise.reject(new Error('Unexpected response'));
    }
  
    let ws;

    function runCmd(command){
        let startTimestamp = document.getElementById('startTimestamp').value;
        let endTimestamp = document.getElementById('endTimestamp').value;
        if( !command )
          command = document.getElementById('command').value;
        let info = document.getElementById('info').value;

        let message = {
            startTimestamp: startTimestamp,
            endTimestamp: endTimestamp,
            command: command,
            info: info
        };

        ws.send(JSON.stringify(message));
        showMessage('=>'  + command );
      }

    function connectWS(openact){
        ws = new WebSocket(`ws://${location.host}`);
        ws.onerror = function () {
          showMessage('WebSocket error');
        };
        ws.onopen = function () {
          showMessage('WebSocket connection established');
          if( openact )
            openact();
        };
        ws.onclose = function () {
          showMessage('WebSocket connection closed');
          ws = null;
        };
        ws.onmessage = function (event) {
            showMessage(event.data);
        };
    }
    function handleLogin(response){
      document.getElementById('messages').innerHTML = '';
      connectWS();
      return response.ok
        ? response.json().then((data) => {
          let v = JSON.stringify(data, null, 2);
          globalVariable.dbname = data.dbname;
          globalVariable.dbfields = data.dbfields;
          showMessage('global value is: ' + JSON.stringify(globalVariable, null, 2));
          return v;
        })
        : Promise.reject(new Error('Unexpected response'));
    }
    function handleLogout(response){
        if (ws) {
            ws.onerror = ws.onopen = ws.onclose = null;
            ws.close();
          }
      
        return handleResponse(response);
    }


    login.onclick = function () {
      fetch('/login', { method: 'POST', credentials: 'same-origin' })
        .then(handleLogin)
        .then(showMessage)
        .catch(function (err) {
          showMessage(err.message);
        });
    };

    logout.onclick = function () {
      runCmd('stop');
      fetch('/logout', { method: 'DELETE', credentials: 'same-origin' })
        .then(handleLogout)
        .then(showMessage)
        .catch(function (err) {
          showMessage(err.message);
        });
    };
  
  
    wsCleanButton.onclick = function () {
      runCmd('stop');
      document.getElementById('messages').innerHTML = '';
      return ;
    };
  
    wsSendButton.onclick = function () {
      if (!ws) {
        showMessage('Need login first!');
      }
      else{
        runCmd();
      }
    };
  })();