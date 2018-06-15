const chai = require('chai');
const expect = chai.expect;
const chaiHttp = require('chai-http');
var assert = require('assert');
const http = require('http')
chai.use(chaiHttp);

var MQRecv = require('../mq/mqrecv.js');
var MQSend = require('../mq/mqsend.js');


describe('Test MQ receiver', function () {

  it('should receive data from 3 sources at the same time properly', function(done){
    let count = 0;
    var mqNode1 = new MQSend({});
    var mqNode2 = new MQSend({});
    var mqNode3 = new MQSend({});
    var mqNodeRecv = new MQRecv({port: 5796});
    var expectedResults = new Set([1111111,222222,333333]);

    mqNodeRecv.on("message", function(msg){
      count++;
      if (count==3) done();
    });

    mqNode1.send({ip:"127.0.0.1",
              port:5796
            }, "1111111");
    mqNode2.send({ip:"127.0.0.1",
              port:5796
            }, "222222");
    mqNode3.send({ip:"127.0.0.1",
              port:5796
            }, "333333");
  });

});
