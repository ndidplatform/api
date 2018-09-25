/**
 * Copyright (c) 2018, 2019 National Digital ID COMPANY LIMITED
 *
 * This file is part of NDID software.
 *
 * NDID is the free software: you can redistribute it and/or modify it under
 * the terms of the Affero GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or any later
 * version.
 *
 * NDID is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the Affero GNU General Public License for more details.
 *
 * You should have received a copy of the Affero GNU General Public License
 * along with the NDID source code. If not, see https://www.gnu.org/licenses/agpl.txt.
 *
 * Please contact info@ndid.co.th for any further questions
 *
 */

import path from 'path';

import chai from 'chai';
import protobuf from 'protobufjs';
import * as MQProtocol from './mq_protocol';
const expect = chai.expect;

const protobufRoot = protobuf.loadSync(
  path.join(__dirname, '..', '..', 'protos', 'mq_protocol_message.proto')
);
const MqProtocolMessage = protobufRoot.lookup('MqProtocolMessage');

describe('MQ Protocol Unit Test', function() {
  it('should perform GenerateSendMsg properly', function() {
    const payload = Buffer.from('test');
    const retryspec = { msgId: 1, seqId: 22 };

    let result = MQProtocol.generateSendMsg(payload, retryspec);

    expect(result).to.be.instanceof(Buffer);

    const decodedResult = MqProtocolMessage.decode(result);
    expect(decodedResult.msgId.toNumber()).to.equal(1);
    expect(decodedResult.seqId).to.equal(22);
    expect(decodedResult.message).to.be.instanceof(Buffer);
    expect(decodedResult.message.toString()).to.equal('test');
    expect(decodedResult.senderId).to.equal('unit-test');
  });

  it('should perform ExtractMsg properly', function() {
    const payload = {
      msgId: 1,
      seqId: 22,
      message: Buffer.from('test'),
    };
    const protoMessage = MqProtocolMessage.create(payload);
    const protoBuffer = MqProtocolMessage.encode(protoMessage).finish();

    let result = MQProtocol.extractMsg(protoBuffer);

    expect(result.retryspec.msgId).to.equal(1);
    expect(result.retryspec.seqId).to.equal(22);
    expect(result.message).to.be.instanceof(Buffer);
    expect(result.message.toString()).to.equal('test');
  });

  it('should perform GenerateAckMsg properly', function() {
    const retryspec = { msgId: 1, seqId: 22 };

    let result = MQProtocol.generateAckMsg(retryspec);

    const decodedResult = MqProtocolMessage.decode(result);
    expect(decodedResult.msgId.toNumber()).to.equal(1);
    expect(decodedResult.seqId).to.equal(22);
    expect(decodedResult.message).to.be.instanceof(Buffer);
    expect(decodedResult.message.toString()).to.equal('');
    expect(decodedResult.senderId).to.equal('unit-test');
  });
});
