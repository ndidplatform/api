const chai = require('chai');
const expect = chai.expect;
let assert = require('assert');
let MQLogic = require('./mqlogic.js');

describe.skip('MQ Retry Logic Unit Test', function () {
  
  it('should perform send properly', function(done){
      let logic = new MQLogic({timeout:1000, totalTimeout:3000});
      logic.on('PerformSend', function (params) {
        expect(params.payload).to.equal('testPayload');
        expect(params.dest).to.equal('testDest');
        expect(params.msgId).to.equal(1);
        expect(params.seqId).to.equal(1);
        done();
      });
      logic.Send('testDest','testPayload');
      
  });

  it('should do clean up properly', function(done){
    let logic = new MQLogic({timeout:1000, totalTimeout:3000});
    logic.on('PerformSend', function (params) {
      expect(params.payload).to.equal('testPayload');
      expect(params.dest).to.equal('testDest');
      expect(params.msgId).to.equal(1);
      expect(params.seqId).to.equal(1);
    });
    logic.on('PerformCleanUp', function(seqId){
      expect(seqId).to.equal(1);
      done();
    })
    logic.Send('testDest','testPayload');
    logic.AckReceived(1);
  });

  it('should handle retry command properly', function(done){
    let count = 0;
    let logic2 = new MQLogic({timeout:1000, totalTimeout:3500});
    logic2.on('PerformSend', function (params) {
      count++;
      console.log(params.seqId + '/' + count);
      console.log(params.msgId + '/' + 1);
      expect(params.msgId).to.equal(1);
      expect(params.seqId).to.equal(count);
    }.bind(this));

    logic2.on('error', function(err){
      console.log('count haha: ' + count);
      expect(err.code).to.equal('MQERR_TIMEOUT');
      expect(count).to.equal(3);
      done();
    }.bind(this));

    logic2.Send('testDest22','testPayload22');
    
  });
});

