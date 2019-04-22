import crypto from 'crypto';

import chai from 'chai';
import chaiHttp from 'chai-http';
import assert from 'assert';

import MQRecv from './mq_recv_controller';
import MQSend from './mq_send_controller';
import zmq from 'zeromq';
import errorType from 'ndid-error/type';

const expect = chai.expect;
chai.use(chaiHttp);

function getMsgId() {
  return crypto.randomBytes(8).toString('base64');
}

describe('Functional Test for MQ receiver with real socket', function() {
  let portIdx = 5655;
  let getPort = function(numports) {
    let ret = [];
    for (let i = 0; i < numports; i++) {
      portIdx++;
      ret.push(portIdx);
    }
    return ret;
  };

  it('should receive data from 3 sources at the same time properly', function(done) {
    let count = 0;
    let ports = getPort(1);

    let mqNode1 = new MQSend({});
    let mqNode2 = new MQSend({});
    let mqNode3 = new MQSend({});
    let mqNodeRecv = new MQRecv({ port: ports[0] });
    let expectedResults = [1111111, 222222, 333333];

    mqNodeRecv.on('message', function({ message, sendAck }) {
      expect(message).to.be.instanceof(Buffer);
      expect(parseInt(message.toString())).to.be.oneOf(expectedResults);

      sendAck();
      count++;
      if (count == 3) {
        mqNodeRecv.close();
        done();
      }
    });

    mqNode1.send(
      {
        ip: '127.0.0.1',
        port: ports[0],
      },
      Buffer.from('1111111'),
      getMsgId()
    );
    mqNode2.send(
      {
        ip: '127.0.0.1',
        port: ports[0],
      },
      Buffer.from('222222'),
      getMsgId()
    );
    mqNode3.send(
      {
        ip: '127.0.0.1',
        port: ports[0],
      },
      Buffer.from('333333'),
      getMsgId()
    );
  });

  it('should block message that are bigger than maxMsgSize from coming', function(done) {
    let ports = getPort(1);

    this.timeout(10000);
    let mqRecvSmallSize = new MQRecv({ port: ports[0], maxMsgSize: 10 });
    mqRecvSmallSize.on('message', function() {
      assert.fail('there should not be message coming through');
    });
    mqRecvSmallSize.on('error', function() {
      assert.fail('there should be no error at receiving part');
    });

    let mqNode = new MQSend({ timeout: 500, totalTimeout: 1500 });
    mqNode.on('error', function(err) {
      mqRecvSmallSize.close();
      done();
    });

    mqNode.send(
      { ip: '127.0.0.1', port: ports[0] },
      Buffer.from('testbigbig12345678901234567890'),
      getMsgId()
    );
  });

  it('should fire error but not die when receive wrong protocol message', function(done) {
    let ports = getPort(1);
    let mqNodeRecv = new MQRecv({ port: ports[0] });
    mqNodeRecv.on('error', function(error) {
      expect(error.getCode()).to.be.eql(
        errorType.WRONG_MESSAGE_QUEUE_PROTOCOL.code
      );
      sendingSocket.close();
      mqNodeRecv.close();
      done();
    });

    mqNodeRecv.on('message', function() {
      assert.fail('Should not recieve wrong protocol message');
    });

    const sendingSocket = zmq.socket('req');
    sendingSocket.setsockopt(zmq.ZMQ_LINGER, 0);
    sendingSocket.setsockopt(zmq.ZMQ_RCVTIMEO, 0);
    sendingSocket.setsockopt(zmq.ZMQ_SNDTIMEO, 0);

    const destUri = `tcp://localhost:${ports[0]}`;
    sendingSocket.connect(destUri);
    sendingSocket.send('RANDOM wrong protocol');
  });
});
