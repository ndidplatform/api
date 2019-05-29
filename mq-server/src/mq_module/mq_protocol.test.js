import path from 'path';

import chai from 'chai';
import protobuf from 'protobufjs';
import * as MQProtocol from './mq_protocol';
const expect = chai.expect;

const protobufRoot = protobuf.loadSync(
  path.join(__dirname, '..', '..', '..', 'protos', 'mq_protocol_message.proto')
);
const MqProtocolMessage = protobufRoot.lookup('MqProtocolMessage');

describe('MQ Protocol Unit Test', function() {
  it('should perform GenerateSendMsg properly', function() {
    const senderId = 'unit-test';
    const payload = Buffer.from('test');
    const retryspec = { msgId: 'test-1', seqId: 22 };

    let result = MQProtocol.generateSendMsg(senderId, payload, retryspec);

    expect(result).to.be.instanceof(Buffer);

    const decodedResult = MqProtocolMessage.decode(result);
    expect(decodedResult.version).to.be.a('number');
    expect(decodedResult.msgId).to.equal('test-1');
    expect(decodedResult.seqId).to.equal(22);
    expect(decodedResult.message).to.be.instanceof(Buffer);
    expect(decodedResult.message.toString()).to.equal('test');
    expect(decodedResult.senderId).to.equal(senderId);
  });

  it('should perform ExtractMsg properly', function() {
    const payload = {
      version: 1,
      msgId: 'test-1',
      seqId: 22,
      message: Buffer.from('test'),
    };
    const protoMessage = MqProtocolMessage.create(payload);
    const protoBuffer = MqProtocolMessage.encode(protoMessage).finish();

    let result = MQProtocol.extractMsg(protoBuffer);

    expect(result.version).to.equal(1);
    expect(result.retryspec.msgId).to.equal('test-1');
    expect(result.retryspec.seqId).to.equal(22);
    expect(result.message).to.be.instanceof(Buffer);
    expect(result.message.toString()).to.equal('test');
  });

  it('should perform GenerateAckMsg properly', function() {
    const senderId = 'unit-test';
    const retryspec = { msgId: 'test-1', seqId: 22 };

    let result = MQProtocol.generateAckMsg(senderId, retryspec);

    const decodedResult = MqProtocolMessage.decode(result);
    expect(decodedResult.version).to.be.a('number');
    expect(decodedResult.msgId).to.equal('test-1');
    expect(decodedResult.seqId).to.equal(22);
    expect(decodedResult.message).to.be.instanceof(Buffer);
    expect(decodedResult.message.toString()).to.equal('');
    expect(decodedResult.senderId).to.equal(senderId);
  });
});
