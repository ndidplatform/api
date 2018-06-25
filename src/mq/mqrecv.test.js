const chai = require('chai');
const expect = chai.expect;
const chaiHttp = require('chai-http');
let assert = require('assert');
const http = require('http')
chai.use(chaiHttp);

let MQRecv = require('../mq/mqrecvcontroller.js');
let MQSend = require('../mq/mqsendcontroller.js');


describe('Test MQ receiver', function () {
  let portIdx = 5655;
  let getPort = function(numports) {
     let ret = [];
     for (let i=0; i<numports; i++) {
       portIdx++;
       ret.push(portIdx);
     }
     return ret;
  }

  it('should receive data from 3 sources at the same time properly', function(done){
    let count = 0;
    let ports = getPort(1);

    let mqNode1 = new MQSend({});
    let mqNode2 = new MQSend({});
    let mqNode3 = new MQSend({});
    let mqNodeRecv = new MQRecv({port: ports[0]});
    let expectedResults = [1111111,222222,333333];

    mqNodeRecv.on("message", function(msg){
      expect(parseInt(msg)).to.be.oneOf(expectedResults);

      count++;
      if (count==3) done();
    });

    mqNode1.send({ip:"127.0.0.1",
              port:ports[0]
            }, "1111111");
    mqNode2.send({ip:"127.0.0.1",
              port:ports[0]
            }, "222222");
    mqNode3.send({ip:"127.0.0.1",
              port:ports[0]
            }, "333333");
  });


   it('should block message that are bigger than maxMsgSize from coming',  function(done)   {
        let ports = getPort(1);

        this.timeout(10000);
        let mqRecvSmallSize = new MQRecv({port: ports[0], maxMsgSize:10});
        mqRecvSmallSize.on('message', async function(jsonMessageStr) {
            assert.fail('there should not be message coming through')
         });
        mqRecvSmallSize.on('error', async function(jsonMessageStr) {
            assert.fail('there should be no error at receiving part');
        });

       let mqNode = new MQSend({timeout:500, totalTimeout:1500});
       mqNode.on('error', function(err) {
           done();
       });

     mqNode.send({ip:"127.0.0.1", port:ports[0]}, "testbigbig12345678901234567890" );
  });

});
