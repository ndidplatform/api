import chai from 'chai';
import chaiHttp from 'chai-http';
import assert from 'assert';
import zmq from 'zeromq';

import MQSend from './mqsendcontroller.js';
import MQRecv from './mqrecvcontroller.js';

const expect = chai.expect;
chai.use(chaiHttp);

describe('Functional Test for MQ Sender with real sockets', function() {
  let portIdx = 5555;
  let getPort = function(numports) {
    let ret = [];
    for (let i = 0; i < numports; i++) {
      portIdx++;
      ret.push(portIdx);
    }
    return ret;
  };

  it('should send data to destination successfully', function(done) {
    let ports = getPort(1);
    let sendNode = new MQSend({});
    let recvNode = new MQRecv({ port: ports[0] });

    recvNode.on('message', function({ message }) {
      expect(message).to.be.instanceof(Buffer);
      expect(message.toString()).to.equal('test message 1');
      recvNode.close();
      done();
    });

    sendNode.send(
      {
        ip: '127.0.0.1',
        port: ports[0],
      },
      Buffer.from('test message 1')
    );
  });

  it('should send data in Thai successfully', function(done) {
    let ports = getPort(1);
    let recvNode = new MQRecv({ port: ports[0] });
    recvNode.on('message', function({ message }) {
      expect(message).to.be.instanceof(Buffer);
      expect(message.toString()).to.equal('นี่คือเทสแมสเซจ');
      recvNode.close();
      done();
    });

    let sendNode = new MQSend({});
    sendNode.send(
      {
        ip: '127.0.0.1',
        port: ports[0],
      },
      Buffer.from('นี่คือเทสแมสเซจ')
    );
  });

  it('should send data to 1 source, 3 times, once after another properly', function(done) {
    let ports = getPort(1);
    let recvNode = new MQRecv({ port: ports[0] });
    let alreadyRecv = [];

    recvNode.on('message', function({ message }) {
      expect(message).to.be.instanceof(Buffer);
      expect(parseInt(message.toString()))
        .to.be.oneOf([111111, 222222, 333333])
        .and.to.not.be.oneOf(alreadyRecv);
      alreadyRecv.push(parseInt(message.toString()));
      if (alreadyRecv.length == 3) {
        recvNode.close();
        done();
      }
    });

    let sendNode = new MQSend({});

    sendNode.send({ ip: '127.0.0.1', port: ports[0] }, Buffer.from('111111'));
    sendNode.send({ ip: '127.0.0.1', port: ports[0] }, Buffer.from('222222'));
    sendNode.send({ ip: '127.0.0.1', port: ports[0] }, Buffer.from('333333'));
  });

  it('should send data to 3 sources at the same time properly', function(done) {
    let ports = getPort(3);
    let count = 0;
    let alreadyRecv = [];

    let mqNode1 = new MQRecv({ port: ports[0] });
    let mqNode2 = new MQRecv({ port: ports[1] });
    let mqNode3 = new MQRecv({ port: ports[2] });

    mqNode1.on('message', function({ message }) {
      expect(message).to.be.instanceof(Buffer);
      expect(parseInt(message.toString()))
        .to.equal(111111)
        .and.to.not.be.oneOf(alreadyRecv);
      alreadyRecv.push(parseInt(message.toString()));
      if (alreadyRecv.length == 3) {
        mqNode1.close();
        mqNode2.close();
        mqNode3.close();
        done();
      }
    });
    mqNode2.on('message', function({ message }) {
      expect(message).to.be.instanceof(Buffer);
      expect(parseInt(message.toString()))
        .to.equal(222222)
        .and.to.not.be.oneOf(alreadyRecv);
      alreadyRecv.push(parseInt(message.toString()));
      if (alreadyRecv.length == 3) {
        mqNode1.close();
        mqNode2.close();
        mqNode3.close();
        done();
      }
    });
    mqNode3.on('message', function({ message }) {
      expect(message).to.be.instanceof(Buffer);
      expect(parseInt(message.toString()))
        .to.equal(333333)
        .and.to.not.be.oneOf(alreadyRecv);
      alreadyRecv.push(parseInt(message.toString()));
      if (alreadyRecv.length == 3) {
        mqNode1.close();
        mqNode2.close();
        mqNode3.close();
        done();
      }
    });

    let mqNode = new MQSend({});
    mqNode.send({ ip: '127.0.0.1', port: ports[0] }, Buffer.from('111111'));
    mqNode.send({ ip: '127.0.0.1', port: ports[1] }, Buffer.from('222222'));
    mqNode.send({ ip: '127.0.0.1', port: ports[2] }, Buffer.from('333333'));
  });

  it('should retry and should resume sending if destination start up late but within time limit', function(done) {
    this.timeout(20000);
    let ports = getPort(1);
    let notDone = true;
    let mqNode = new MQSend({
      id: 'test_retry',
      timeout: 2000,
      totalTimeout: 16000,
    });
    mqNode.on('error', function(error) {
      assert.fail('this one should not fire error, but it fired: ' + error);
    });

    mqNode.send({ ip: '127.0.0.1', port: ports[0] }, Buffer.from('test'));

    let id = setTimeout(function() {
      let mqNode2 = new MQRecv({ port: ports[0] });

      mqNode2.on('message', function({ message }) {
        expect(message).to.be.instanceof(Buffer);
        expect(message.toString()).to.equal('test');
        if (notDone == true) {
          mqNode2.close();
          done();
          notDone = false;
        }
      });
    }, 7000);
  });

  it('should retry and should resume sending properly if destination dies but resumes but within time limit', function(done) {
    this.timeout(10000);
    let ports = getPort(1);

    let MQRecvDieFirst = function(config) {
      let receivingSocket = zmq.socket('rep');
      receivingSocket.setsockopt(zmq.ZMQ_LINGER, 0);
      receivingSocket.bindSync('tcp://*:' + config.port);
      receivingSocket.on('message', async function(messageBuffer) {
        //just close the connection.....
        receivingSocket.close();
      });

      receivingSocket.on('error', async function(messageBuffer) {
        assert.fail('there should be no error at receiving part');
      });
    };

    // first timenode will die;
    let nodetoDie = new MQRecvDieFirst({ port: ports[0] });
    let mqNode = new MQSend({ timeout: 2000, totalTimeout: 16000 });
    mqNode.on('error', function({ message }) {
      assert.fail('this one should not fire error');
    });
    mqNode.send({ ip: '127.0.0.1', port: ports[0] }, Buffer.from('test'));

    // create proper one later
    let id = setTimeout(function() {
      let mqNode2 = new MQRecv({ port: ports[0] });
      mqNode2.on('message', function({ message }) {
        expect(message).to.be.instanceof(Buffer);
        expect(message.toString()).to.equal('test');
        mqNode2.close();
        done();
      });
      mqNode2.on('error', function({ message }) {
        assert.fail('this one should not fire error');
      });
    }, 4000);
  });

  it('should retry and should eventually fire error downstream if receiver keep rejecting connection', function(done) {
    this.timeout(10000);
    let ports = getPort(1);

    let MQRecvClose = function(config) {
      let receivingSocket = zmq.socket('rep');
      receivingSocket.setsockopt(zmq.ZMQ_LINGER, 0);
      receivingSocket.bindSync('tcp://*:' + config.port);
      receivingSocket.on('message', async function(messageBuffer) {
        receivingSocket.close();
      });
      receivingSocket.on('error', async function(err) {
        assert.fail(
          'there should be no error at receiving part but it fired: ' + err
        );
      });
    };

    let recv = new MQRecvClose({ port: ports[0] });
    let mqNode = new MQSend({ timeout: 500, totalTimeout: 1500 });
    mqNode.on('error', function(err) {
      expect(err.code).to.equal('MQERR_TIMEOUT');
      done();
    });

    mqNode.send({ ip: '127.0.0.1', port: ports[0] }, Buffer.from('test'));
  });

  it('should retry just like normal timeout and eventually timeout and fires MQERR_TIMEOUT error downstream if upstream return error due to size issue', function(done) {
    this.timeout(10000);
    let ports = getPort(1);

    let mqRecvSmallSize = new MQRecv({ port: ports[0], maxMsgSize: 10 });
    let mqNode = new MQSend({ timeout: 500, totalTimeout: 1500 });
    mqNode.on('error', function(err) {
      expect(err.code).to.equal('MQERR_TIMEOUT');
      mqRecvSmallSize.close();
      done();
    });

    mqNode.send(
      { ip: '127.0.0.1', port: ports[0] },
      Buffer.from('testbigbig12345678901234567890')
    );
  });

  it('should fire timeout event downstream and stop sending if destination dies but come up after time limit and should no longer retry', function(done) {
    this.timeout(20000);
    let ports = getPort(1);
    let alreadyTimeout = false;

    let MQRecvDieFirst = function(config) {
      let receivingSocket = zmq.socket('rep');
      receivingSocket.setsockopt(zmq.ZMQ_LINGER, 0);
      receivingSocket.bindSync('tcp://*:' + config.port);
      receivingSocket.on('message', async function(messageBuffer) {
        //just close the connection.....
        receivingSocket.close();
      });

      receivingSocket.on('error', async function(messageBuffer) {
        assert.fail('there should be no error at receiving part');
      });
    };

    // first timenode will die;
    let nodetoDie = new MQRecvDieFirst({ port: ports[0] });
    let mqNode = new MQSend({ id: 'test3', timeout: 1000, totalTimeout: 3000 });
    mqNode.on('error', function(err) {
      expect(err.code).to.equal('MQERR_TIMEOUT');
      alreadyTimeout = true;
    });

    mqNode.send({ ip: '127.0.0.1', port: ports[0] }, Buffer.from('test'));

    // create proper one later
    let id = setTimeout(function() {
      let mqNode2 = new MQRecv({ port: ports[0] });
      mqNode2.on('message', function({ message }) {
        assert.fail('this one should not receive no more');
      });
      mqNode2.on('error', function({ message }) {
        assert.fail('this one should not fire error');
      });
      setTimeout(() => {
        mqNode2.close();
        expect(alreadyTimeout).to.be.true;
        done();
      }, 2000);
    }, 10000);
  });
});

describe.skip('mq extreme case. Keep it there but dont run by default', function() {
  it('should not die and receiever received all messages properly if it sends out 900 messages', function(done) {
    this.timeout(100000);
    const ports = getPort(1);

    let sendNode = new MQSend({});
    sendNode.on('error', function(err) {
      assert.fail(
        'there should be no error but it fired:' + err.code + err.message
      );
    });

    let count = 0;
    let recvNode = new MQRecv({ port: ports[0] });
    recvNode.on('message', function({ message }) {
      ++count;
      if (count == 900) done();
    });
    recvNode.on('error', function(err) {
      assert.fail(
        'there should be no error but it fired:' + err.code + err.message
      );
    });

    for (let i = 0; i < 900; i++) {
      sendNode.send(
        { ip: '127.0.0.1', port: ports[0] },
        Buffer.from('msg' + i)
      );
    }
  });

  it('should throw exception with Too many open files reason if it sends out 1800 messages', function(done) {
    this.timeout(10000);
    const ports = getPort(1);
    let hasDone = false;
    let sendNode = new MQSend({});
    sendNode.on('error', function(err) {
      assert.fail(
        'there should be no error from emit. However, this threw ' + err
      );
    });

    let recvNode = new MQRecv({ port: ports[0] });
    recvNode.on('message', function({ message }) {
      // do nothing.
    });

    try {
      for (let i = 0; i < 1800; i++)
        sendNode.send(
          { ip: '127.0.0.1', port: ports[0] },
          Buffer.from('msg' + i)
        );
    } catch (err) {
      expect(err.message).to.equal('Error: Too many open files');
      done();
    }
  });

  it('should not die if it sends out 900 messages, wait until they are all done, then send another 900 messages', function(done) {
    this.timeout(100000);
    const ports = getPort(1);

    let sendNode = new MQSend({});
    sendNode.on('error', function(err) {
      assert.fail('there should be no error but it fired:' + err.code);
    });

    let fn2 = function() {
      for (let i = 0; i < 900; i++) {
        sendNode.send(
          { ip: '127.0.0.1', port: ports[0] },
          Buffer.from('msg' + i)
        );
      }
    };
    fn2();
    let count = 0;
    let recvNode = new MQRecv({ port: ports[0] });
    recvNode.on('message', function({ message }) {
      ++count;
      if (count == 900) {
        let id = setTimeout(function() {
          fn2();
        }, 5000);
      }
      if (count == 1800) done();
    });
    recvNode.on('error', function(err) {
      assert.fail('there should be no error but it fired:' + err.code);
    });
  });

  it('should not die and receiever received all messages properly if it sends out a file with 20000000m size', function(done) {
    // create data with 20 mb
    this.timeout(100000);
    const ports = getPort(1);

    let str = '';
    for (let i = 0; i < 200000; i++) {
      str +=
        '12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890';
    }

    let sendNode = new MQSend({});
    let recvNode = new MQRecv({ port: port[0] });

    recvNode.on('message', function({ message }) {
      expect(message).to.be.instanceof(Buffer);
      expect(message.toString()).to.equal(str);
      done();
    });
    sendNode.on('state', function({ message }) {});

    sendNode.send(
      {
        ip: '127.0.0.1',
        port: ports[0],
      },
      Buffer.from(str)
    );

    // create proper one later
    let id = setTimeout(function() {
      let mqNode2 = new MQRecv({ port: ports[0] });
      mqNode2.on('message', function({ message }) {
        assert.fail('this one should not receive no more');
      });
    });
  });
});
