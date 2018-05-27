const chai = require('chai');
const expect = chai.expect;
const chaiHttp = require('chai-http');
var assert = require('assert');
chai.use(chaiHttp);
var zmq = require("zeromq")
var MQSend = require('../mq/mqsend.js');
var MQRecv = require('../mq/mqrecv.js');

describe('Test message queue Sending', function () {

  
  it('should send data to destination succesffully', function(done) {

    var sendNode = new MQSend({});
    var recvNode= new MQRecv({port: 5565});

    recvNode.on('message', function(msg){
   //   expect(msg).to.be.a('String').and.equal('test message 1');  
     expect(String(msg)).to.equal('test message 1');  
       done();
    });
    
    sendNode.send({ip:'127.0.0.1',
              port:5565
              }, 'test message 1');
    
  
  });
 
  it('should send data in Thai successfully',function(done) {

    var recvNode = new MQRecv({port: 5557});
    recvNode.on("message", function(msg){
      expect(String(msg)).to.equal('นี่คือเทสแมสเซจ');  
      done();
    });

    var sendNode = new MQSend({});
    sendNode.send({ip:"127.0.0.1",
              port:5557
              }, 'นี่คือเทสแมสเซจ');
            
  });

  it('should send data to 1 source, 3 times, once after another properly', function(done) {
    let count = 0;
    var recvNode = new MQRecv({port: 5556});
   /// let alreadyRecv = new Set();
    
   recvNode.on("message", function(msg){
    //  expect(msg).to.be.a('String').and.be.oneOf(['test1', 'test2', 'test3']).and.not.be.oneOf(alreadyRecv.entries());  
     // alreadyRecv.add(msg);
      count++;
      if (count == 3) done();
    });
    
    var sendNode = new MQSend({});
   
    sendNode.send({ip:"127.0.0.1",
              port:5556
            }, "test1");
    sendNode.send({ip:"127.0.0.1",
              port:5556
            }, "test2");
    sendNode.send({ip:"127.0.0.1",
              port:5556
            }, "test3");
  });

  it('should send data to 3 sources at the same time properly', function(done){
    let count = 0;
    var mqNode = new MQSend({});
    var mqNode1 = new MQRecv({port: 5576});
    var mqNode2 = new MQRecv({port: 5577});
    var mqNode3 = new MQRecv({port: 5578});
   
    mqNode1.on("message", function(msg){
      expect(msg).to.be.a('String').and.equal('test1');  
      count++;
      if (count == 3) done();
    });
    mqNode2.on("message", function(msg){
       expect(msg).to.be.a('String').and.equal('test2');  
       count++;
       if (count == 3) done();
     });
    mqNode3.on("message", function(msg){
       expect(msg).to.be.a('String').and.equal('test3');  
       count++;
       if (count == 3) done();
     });

    mqNode.send({ip:"127.0.0.1",
              port:5576
            }, "test1");
    mqNode.send({ip:"127.0.0.1",
              port:5577
            }, "test2");
    mqNode.send({ip:"127.0.0.1",
              port:5578
            }, "test3");
  });

  
  it('should retry and should resume sending properly if destination dies and come up within time limit',  function(done) {
    let count = 0;
    
    this.timeout(10000);
    
    var mqNode1 = new MQRecv({port: 5606});
    
    mqNode1.on("message", function(msg){
      expect(msg).to.be.a('String').and.equal('test1');  
      assert.fail();
    });
  
    var mqNode = new MQSend({timeout:500, totalTimeout:1600});
   
    mqNode.send({ip:"127.0.0.1",
              port:5680
            }, "test22" );
    
    var id = setTimeout(function () {
      var mqNode2 = new MQRecv({port: 5680});
        mqNode2.on("message", function(msg){
        expect(msg).to.be.a('String').and.equal('test22');  
        count++;
        if (count==4)done();
      });  
    }
    , 4000);
    
  });


  it('should not retry but should fire error downstream if upstream return error',  function(done)   {
    this.timeout(10000);

    var MQRecvClose = function(config) {
  
      var self = this;
    
      this.receivingSocket = zmq.socket('rep');
      
      this.receivingSocket.bindSync('tcp://*:' + config.port);
       
      this.receivingSocket.on('message', async function(jsonMessageStr) {
          // close socket
          self.receivingSocket.close();
          
      });

      this.receivingSocket.on('error', async function(jsonMessageStr) {
        // close socket
        self.receivingSocket.close();
    });

    };

    var recv = new MQRecvClose( {port:4444});
    var mqNode = new MQSend({timeout:5000, totalTimeout:1600});
    mqNode.on('mq_error', async function() {
 console.log("Error in message queue");
        done();
    });

    mqNode.send({ip:"127.0.0.1",
    port:4444
  }, "test22" );
 });

  //TODO
  it('must fire timeout event downstream and stop sending if destination dies but come up after time limit',  function(done)  {
      done();
  });

  //TODO
  it('should stop sending and should not retry if it dies and recovers',  function(done)  {
   
      done();
  
  });

  //TODO
  it('should not die and receiever received all message properly if it sends out 1000000 messages',  function(done) {
      done();
  
  });

   //TODO
   it('should not die and receiever received all messages properly if it sends out a file with 200000000m size',  function(done) {
      // create data with 20 mb
      this.timeout(100000);

      var str = "";
      for(var i = 0; i< 2000000; i++) {
            str += "12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890";
      }  
      
      var sendNode = new MQSend({});
      var recvNode= new MQRecv({port: 5691});
  
      recvNode.on('message', function(msg){
         expect(String(msg)).to.equal(str);  
         done();
      });
      
      sendNode.send({ip:'127.0.0.1',
                port:5691
                }, str);
      
   });


  //TODO
  it('should only send data to the address of destination but not someone else connected to it', function(done) {
      done();
  
  });

});





