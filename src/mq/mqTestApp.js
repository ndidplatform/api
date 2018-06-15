
require("babel-core").transform("code", );
const http = require('http')
var MQRecv = require('../mq/mqrecv.js');
var MQSend = require('../mq/mqsend.js');

var totalSend = 0;
var totalRecv = 0;

console.log('starting app'  );

if ( process.argv[2] == 'send'){
  const byte2Send = process.argv[5];
  const ipMQ = process.argv[3];
  const portMQ = process.argv[4];
  const timeoutMQ = process.argv[6];
  const totalTimeoutMQ = process.argv[7];
  console.log ( "sending to " + ipMQ + ":" + portMQ + " for " + byte2Send +  " long with timeout (round/max) " + timeoutMQ + "/" + totalTimeoutMQ );
  const loop2GenStr = byte2Send / 100;
  var str2Send = "";
  for(var i = 0; i < loop2GenStr ; i++) {
        str2Send += "1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890";
  }

  var mqNodeSend = new MQSend({ timeout: timeoutMQ, totalTimeout:totalTimeoutMQ });
  mqNodeSend.on('error', function (err) {
        console.log('error received' + err );
  });

  mqNodeSend.on('state', function(msg){
    console.log(msg);
  })

  mqNodeSend.send({ip:ipMQ, port:portMQ}, str2Send );

}
else if ( process.argv[2] == 'listen' ) {
  const portMQ = process.argv[3];
  console.log(' MessageQ listening to port ' + portMQ);

  var mqNodeRecv = new MQRecv({port: portMQ});
  mqNodeRecv.on('message', function(msg){
        console.log('received message with ' + msg.length + " size");
        totalRecv +=  msg.length;
  })

  var server = http.createServer(function(req, res) {

    res.writeHead(200, {"Content-Type": "text/html"});
    res.end('<p> all recved:' + totalRecv + '</p>');
  });

  console.log('HTTP listening to port 8089' );
  server.listen(8089);

}
else {
    console.log("please specify whether it's send or listen or it won't work");
}
