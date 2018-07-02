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

let MQProtocol = function() {};

MQProtocol.prototype._applyRetrySpec = function ( message, retryspec ) {
  let ret = JSON.stringify ({
    msgId: retryspec.msgId,
    seqId: retryspec.seqId, 
    message: message
  });
  return ret;
};

MQProtocol.prototype._extractRetrySpec = function ( message ) {
  const jsonMsg = JSON.parse(message);
  return { 
    retryspec: {
      msgId: jsonMsg.msgId, 
      seqId: jsonMsg.seqId
    }, 
    message: jsonMsg.message 
  };
};

MQProtocol.prototype.GenerateSendMsg = function (payload, retryspec) {
  let msg = payload;
  msg = this._applyRetrySpec(msg,retryspec);
  return msg;
};

MQProtocol.prototype.ExtractMsg = function (payload, retryspec) {
  let msg = payload;
  return this._extractRetrySpec(msg);
};

MQProtocol.prototype.GenerateAckMsg = function (retryspec) {
  let ack = '';
  ack = this._applyRetrySpec(ack, retryspec);
  return ack;
};

export default MQProtocol;
