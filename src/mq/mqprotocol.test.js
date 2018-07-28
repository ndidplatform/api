import path from 'path';

import chai from 'chai';
import protobuf from 'protobufjs';
import MQProtocol from './mqprotocol.js';
const expect = chai.expect;

const protobufRoot = protobuf.loadSync(
  path.join(__dirname, '..', '..', 'protos', 'mq_protocol_message.proto')
);
const MqProtocolMessage = protobufRoot.lookup('MqProtocolMessage');

describe('MQ Protocol Unit Test', function() {
  it('should perform GenerateSendMsg properly', function() {
    let protocol = new MQProtocol();
    const payload = Buffer.from('test');
    const retryspec = { msgId: 1, seqId: 22 };

    let result = protocol.GenerateSendMsg(payload, retryspec);

    expect(result).to.be.instanceof(Buffer);

    const decodedResult = MqProtocolMessage.decode(result);
    expect(decodedResult.msgId.toNumber()).to.equal(1);
    expect(decodedResult.seqId).to.equal(22);
    expect(decodedResult.message).to.be.instanceof(Buffer);
    expect(decodedResult.message.toString()).to.equal('test');
    expect(decodedResult.senderId).to.equal('unit-test');
  });

  it('should perform ExtractMsg properly', function() {
    let protocol = new MQProtocol();
    const payload = {
      msgId: 1,
      seqId: 22,
      message: Buffer.from('test'),
    };
    const protoMessage = MqProtocolMessage.create(payload);
    const protoBuffer = MqProtocolMessage.encode(protoMessage).finish();

    let result = protocol.ExtractMsg(protoBuffer);

    expect(result.retryspec.msgId).to.equal(1);
    expect(result.retryspec.seqId).to.equal(22);
    expect(result.message).to.be.instanceof(Buffer);
    expect(result.message.toString()).to.equal('test');
  });

  it('should perform GenerateAckMsg properly', function() {
    let protocol = new MQProtocol();
    const retryspec = { msgId: 1, seqId: 22 };

    let result = protocol.GenerateAckMsg(retryspec);

    const decodedResult = MqProtocolMessage.decode(result);
    expect(decodedResult.msgId.toNumber()).to.equal(1);
    expect(decodedResult.seqId).to.equal(22);
    expect(decodedResult.message).to.be.instanceof(Buffer);
    expect(decodedResult.message.toString()).to.equal('');
    expect(decodedResult.senderId).to.equal('unit-test');
  });
});
