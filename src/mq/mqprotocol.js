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

import protobuf from 'protobufjs';
import { nodeId } from '../config';

const protobufRoot = protobuf.loadSync(
  path.join(__dirname, '..', '..', 'protos', 'mq_protocol_message.proto')
);
const MqProtocolMessage = protobufRoot.lookup('MqProtocolMessage');

export default class MQProtocol {
  constructor() {
    this.id = nodeId;
  }

  _applyRetrySpec(message, retryspec) {
    const payload = {
      msgId: retryspec.msgId,
      seqId: retryspec.seqId,
      message: message,
      senderId: this.id,
    };
    const errMsg = MqProtocolMessage.verify(payload);
    if (errMsg) {
      throw new Error(errMsg);
    }
    const protoMessage = MqProtocolMessage.create(payload);
    const protoBuffer = MqProtocolMessage.encode(protoMessage).finish();
    return protoBuffer;
  }

  _extractRetrySpec(message) {
    const decodedMessage = MqProtocolMessage.decode(message);
    return {
      retryspec: {
        msgId: decodedMessage.msgId.toNumber(),
        seqId: decodedMessage.seqId,
      },
      message: decodedMessage.message,
      senderId: decodedMessage.senderId,
    };
  }

  GenerateSendMsg(payload, retryspec) {
    let msg = payload;
    msg = this._applyRetrySpec(msg, retryspec);
    return msg;
  }

  ExtractMsg(payload) {
    let msg = payload;
    return this._extractRetrySpec(msg);
  }

  GenerateAckMsg(retryspec) {
    let ack = Buffer.from('');
    ack = this._applyRetrySpec(ack, retryspec);
    return ack;
  }
}
