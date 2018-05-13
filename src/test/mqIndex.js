const chai = require('chai');
const expect = chai.expect;
const chaiHttp = require('chai-http');
chai.use(chaiHttp);

var mq = require('../mq/index.js');


describe('Test mq usage', function () {

  before(function() {

   
  });
  
  it('should send data via message queue successfully', function(done) {

    
    mq.eventEmitter.on("message", function(msg){
      expect(msg).to.be.a('String').and.equal('"test message 1"');  
      done();
    });
    
    mq.send([{ip:"127.0.0.1",
              port:5555,
              public_key:""}], 'test message 1');
    
  
  });
 

});





