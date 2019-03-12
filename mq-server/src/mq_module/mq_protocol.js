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

const protobufRootInstance = new protobuf.Root();
const protobufRoot = protobufRootInstance.loadSync(
  path.join(__dirname, '..', '..', '..', 'protos', 'mq_protocol_message.proto'),
  { keepCase: true }
);
const MqProtocolMessage = protobufRoot.lookupType('MqProtocolMessage');

function applyRetrySpec(senderId, message, retryspec) {
  const payload = {
    msg_id: retryspec.msgId,
    seq_id: retryspec.seqId,
    message: message,
    sender_id: senderId,
  };
  const errMsg = MqProtocolMessage.verify(payload);
  if (errMsg) {
    throw new Error(errMsg);
  }
  const protoMessage = MqProtocolMessage.create(payload);
  const protoBuffer = MqProtocolMessage.encode(protoMessage).finish();
  return protoBuffer;
}

function extractRetrySpec(message) {
  const decodedMessage = MqProtocolMessage.decode(message);
  return {
    retryspec: {
      msgId: decodedMessage.msg_id,
      seqId: decodedMessage.seq_id,
    },
    message: decodedMessage.message,
    senderId: decodedMessage.sender_id,
  };
}

export function generateSendMsg(senderId, payload, retryspec) {
  let msg = payload;
  msg = applyRetrySpec(senderId, msg, retryspec);
  return msg;
}

export function extractMsg(payload) {
  const msg = payload;
  return extractRetrySpec(msg);
}

export function generateAckMsg(senderId, retryspec) {
  const ack = applyRetrySpec(senderId, Buffer.from(''), retryspec);
  return ack;
}
