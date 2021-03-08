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

import { serializeMqMessage, deserializeMqMessage } from '.';
import messageTypes from './type';

const chai = require('chai');
const expect = chai.expect;

describe('Test MQ message serialization', () => {
  it('should serialize message correctly', async () => {
    const message = {
      type: messageTypes.CONSENT_REQUEST,
      namespace: 'namespace',
      identifier: 'identifier',
      request_message: 'message',
      creation_time: Date.now(),
      chain_id: 'chain_id',
      height: 1000,
    };

    const {
      messageType,
      messageBuffer,
      messageCompressionAlgorithm,
    } = await serializeMqMessage(message, 1);

    expect(messageType).to.be.equals(message.type);
    expect(messageBuffer).to.not.be.empty;
    expect(messageCompressionAlgorithm).to.be.equals('gzip');

    const deserializedMessage = await deserializeMqMessage(
      messageType,
      messageBuffer,
      messageCompressionAlgorithm
    );

    expect(deserializedMessage).to.be.an('object');
    expect(deserializedMessage).to.be.deep.equals(message);
  });

  it('should deserialize message correctly', async () => {
    const messageType = messageTypes.CONSENT_REQUEST;
    const messageCompressionAlgorithm = 'gzip';

    const message = {
      type: messageTypes.CONSENT_REQUEST,
      namespace: 'namespace',
      identifier: 'identifier',
      request_message: 'message',
      creation_time: 1614936872841,
      chain_id: 'chain_id',
      height: 1000,
    };

    const serializedMessageBuffer = Buffer.from(
      'H4sIAAAAAAAAA02NMQ7CMAxFxcoxPGdIoCqFy0RWahoPdUtiBoS4EKfEkahge9b71tu/d0/Qx0pwgbRIJdFY6HanquBAcKa6Ymr2xw54tB1fmYqJv8NBKoTKi0Tl2b5CH7rzsR9Oh6ELZjOyRB5bbEMHmXjKamPvvYNvPVqt4tTKG70+XTg/IK0AAAA=',
      'base64'
    );

    const deserializedMessage = await deserializeMqMessage(
      messageType,
      serializedMessageBuffer,
      messageCompressionAlgorithm
    );

    expect(deserializedMessage).to.be.an('object');
    expect(deserializedMessage).to.be.deep.equals(message);
  });

  it('should serialize message correctly (2)', async () => {
    const message = {
      type: messageTypes.IDP_RESPONSE,
      test: 'test',
      time: Date.now(),
    };

    const {
      messageType,
      messageBuffer,
      messageCompressionAlgorithm,
    } = await serializeMqMessage(message, 1);

    expect(messageType).to.be.equals(message.type);
    expect(messageBuffer).to.not.be.empty;
    expect(messageCompressionAlgorithm).to.be.equals('gzip');

    const deserializedMessage = await deserializeMqMessage(
      messageType,
      messageBuffer,
      messageCompressionAlgorithm
    );

    expect(deserializedMessage).to.be.an('object');
    expect(deserializedMessage).to.be.deep.equals(message);
  });

  it('should serialize message correctly (3) (no compression)', async () => {
    const message = {
      type: messageTypes.IDP_RESPONSE,
      test: 'test',
      time: Date.now(),
    };

    const {
      messageType,
      messageBuffer,
      messageCompressionAlgorithm,
    } = await serializeMqMessage(message, 10000);

    expect(messageType).to.be.equals(message.type);
    expect(messageBuffer).to.not.be.empty;
    expect(messageCompressionAlgorithm).to.be.equals(null);

    const deserializedMessage = await deserializeMqMessage(
      messageType,
      messageBuffer,
      messageCompressionAlgorithm
    );

    expect(deserializedMessage).to.be.an('object');
    expect(deserializedMessage).to.be.deep.equals(message);
  });
});
