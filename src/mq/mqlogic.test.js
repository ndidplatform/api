const chai = require('chai');
const expect = chai.expect;
let assert = require('assert');
let MQLogic = require('./mqlogic.js');

describe('MQ Retry Logic Unit Test', function () {
  
  it('should perform send properly', function(done){
      let logic = new MQLogic({id:'logic1', timeout:1000, totalTimeout:3000});
      let doneNow = false;
      logic.on('PerformSend', function (params) {
        expect(params.payload).to.equal('testPayload');
        expect(params.dest).to.equal('testDest');
        expect(params.msgId).to.equal(1,' msg 1');
        
        if ( doneNow == false ) {
          doneNow = true;  
          expect(params.seqId).to.equal(1, 'seq 1');
          done();
        }
      });
      logic.Send('testDest','testPayload');
      
  });

  it('should do clean up properly', function(done){
    let logic = new MQLogic({timeout:1000, totalTimeout:3000});
    logic.on('PerformSend', function (params) {
      expect(params.payload).to.equal('testPayload');
      expect(params.dest).to.equal('testDest');
      expect(params.msgId).to.equal(1, 'first msg');
      expect(params.seqId).to.equal(1, 'first sequence');
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
    let logic2 = new MQLogic({timeout:200, totalTimeout:500});
    logic2.on('PerformSend', function (params) {
      count++;
      expect(params.msgId).to.equal(1, 'msg id 1');
      expect(params.seqId).to.equal(count, 'seq id should increase');
    });

    logic2.on('PerformTotalTimeout', function(params){
      expect(params.msgId).to.equal(1, 'timeout for id 1');
      done();
    });

    logic2.Send('testDest22','testPayload22');
    
  });
});

