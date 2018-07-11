const chai = require('chai');
const expect = chai.expect;
let assert = require('assert');
let MQProtocol = require('./mqprotocol.js');

describe('MQ Protocol Unit Test', function () {
  
  it('should perform GenerateSendMsg properly', function(){
    let protocol = new MQProtocol();
    const payload = 'test'
    const retryspec = {msgId:1, seqId:22};

    let result = protocol.GenerateSendMsg(payload, retryspec)

    expect(result).to.equal('{"msgId":1,"seqId":22,"message":"test"}')
  });

  it('should perform ExtractMsg properly', function(){
    let protocol = new MQProtocol();
    const msg = '{"msgId":1,"seqId":22,"message":"test"}';

    let result = protocol.ExtractMsg(msg);

    expect(result.retryspec.msgId).to.equal(1);
    expect(result.retryspec.seqId).to.equal(22);
    expect(result.message).to.equal('test');
  });

  it('should perform GenerateAckMsg properly', function(){
    let protocol = new MQProtocol();
    const retryspec = {msgId:1, seqId:22};

    let result = protocol.GenerateAckMsg(retryspec)

    expect(result).to.equal('{"msgId":1,"seqId":22,"message":""}')
  });
});
