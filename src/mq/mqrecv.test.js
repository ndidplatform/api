import chai from'chai';
const expect = chai.expect;
import assert from 'assert';

import MQRecv from '../mq/mqrecvcontroller';
import MQSend from '../mq/mqsendcontroller';


describe('Functional Test for MQ receiver with real socket', function () {
  let portIdx = 5655;
  let getPort = function(numports) {
     let ret = [];
     for (let i=0; i<numports; i++) {
       portIdx++;
       ret.push(portIdx);
     }
     return ret;
  };

  it('should receive data from 3 sources at the same time properly', function(done){
    let count = 0;
    let ports = getPort(1);

    let mqNode1 = new MQSend({id: 'node1'});
    let mqNode2 = new MQSend({id: 'node2'});
    let mqNode3 = new MQSend({id: 'node3'});
    let mqNodeRecv = new MQRecv({port: ports[0]});
    let expectedResults = [1111111,222222,333333];

    mqNodeRecv.on("message", function(msg){
      expect(parseInt(msg)).to.be.oneOf(expectedResults);

      count++;
      if (count==3)  {
        done();
        mqNodeRecv.recvSocket.close();
      }
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
        mqRecvSmallSize.on('message', function(jsonMessageStr) {
            assert.fail('there should not be message coming through')
         });
        mqRecvSmallSize.on('error', function(jsonMessageStr) {
            assert.fail('there should be no error at receiving part');
        });

       let mqNode = new MQSend({timeout:500, totalTimeout:1500});
       mqNode.on('error', function(err) {
          mqRecvSmallSize.recvSocket.close();
          done();
       });

       mqNode.send({ip:"127.0.0.1", port:ports[0]}, "testbigbig12345678901234567890" );
  });

});
