const chai = require('chai');
const expect = chai.expect;
const chaiHttp = require('chai-http');
chai.use(chaiHttp);

//const server = require('../server');
var MQNode = require('../mq/mqnode.js');


describe('Test message queue and its reliability', function () {

  before(function() {

   
  });
  
  it('should send data to destination succesffully', function(done) {

    var mqNode = new MQNode({port: 5565});

    mqNode.on('message', function(msg){
   //   expect(msg).to.be.a('String').and.equal('test message 1');  
     expect(String(msg)).to.equal('test message 1');  
       done();
    });
    
    mqNode.send({ip:'127.0.0.1',
              port:5565
              }, 'test message 1');
    
  
  });
 
  it('should send data in Thai successfully',function(done) {

    var mqNode = new MQNode({port: 5557});

    mqNode.on("message", function(msg){
      expect(String(msg)).to.equal('นี่คือเทสแมสเซจ');  
      done();
    });
    
    mqNode.send({ip:"127.0.0.1",
              port:5557
              }, 'นี่คือเทสแมสเซจ');
            
  });

  it('should send data to 1 source, 3 times, once after another properly', function(done) {
    let count = 0;
    var mqNode = new MQNode({port: 5556});
   
    mqNode.on("message", function(msg){
     // expect(msg).to.be.a('String').and.equal('"test1"');  
      count++;
      if (count = 3) done();
    });
    
    mqNode.send({ip:"127.0.0.1",
              port:5556
            }, "test1");
    mqNode.send({ip:"127.0.0.1",
              port:5556
            }, "test2");

    mqNode.send({ip:"127.0.0.1",
              port:5556
            }, "test3");
  });

  it('should receive data that were sent from 3 sources at the same time properly', async () => {

              
  });

  //TODO
  it('should retry and should resume sending properly if destination dies and come up within time limit', async () => {

  });


 //TODO
 it('should not retry but should fire error downstream if upstream return error', async () => {

  });

  //TODO
  it('must fire timeout event downstream and stop sending if destination dies but come up after time limit', async () => {

  });

  //TODO
  it('should stop sending and should not retry if it dies and recovers', async () => {

  });

  //TODO
  it('should not die and receiever received all message properly if it sends out 1000000 messages', async () => {

  });

  //TODO
  it('src should only send data to the address of destination but not someone else connected to it', async () => {

  });

});





