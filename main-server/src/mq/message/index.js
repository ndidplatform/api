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
import util from 'util';
import zlib from 'zlib';

import protobuf from 'protobufjs';
import parseDataURL from 'data-urls';

import messageTypes from './type';

import { dataUrlRegex } from '../../data_url';

import * as config from '../../config';

const gzip = util.promisify(zlib.gzip);
const unzip = util.promisify(zlib.unzip);

const mqMessageProtobufRootInstance = new protobuf.Root();
const mqMessageProtobufRoot = mqMessageProtobufRootInstance.loadSync(
  path.join(__dirname, '..', '..', '..', '..', 'protos', 'mq_message.proto'),
  { keepCase: true }
);

const ConsentRequestMqMessage = mqMessageProtobufRoot.lookupType(
  'ConsentRequestMqMessage'
);
const AsDataResponseMqMessage = mqMessageProtobufRoot.lookupType(
  'AsDataResponseMqMessage'
);

const MESSAGE_COMPRESSION_ALGORITHM = 'gzip';

export async function serializeMqMessage(message, compressMinLength) {
  let messageBuffer;
  switch (message.type) {
    case messageTypes.CONSENT_REQUEST: {
      const { request_message, ...messageJson } = message;
      const dataUrlParsedRequestMessage = parseDataURL(request_message);
      let requestMessageDataUrlPrefix;
      let requestMessageBuffer;
      if (dataUrlParsedRequestMessage != null) {
        const match = request_message.match(dataUrlRegex);
        if (match[4] && match[4].endsWith('base64')) {
          // Convert request message with data URL format to Buffer for transfer over MQ
          // In case it is base64 encoded, MQ message payload size is reduced
          requestMessageDataUrlPrefix = match[1];
          requestMessageBuffer = dataUrlParsedRequestMessage.body;
        }
      }
      if (!requestMessageDataUrlPrefix && !requestMessageBuffer) {
        messageJson.request_message = request_message;
      }
      const request_json = JSON.stringify(messageJson);
      const consentRequestMqMessageObject = {
        request_json,
        request_message_data_url_prefix: requestMessageDataUrlPrefix,
        request_message_bytes: requestMessageBuffer,
      };
      const protoMessage = ConsentRequestMqMessage.create(
        consentRequestMqMessageObject
      );
      messageBuffer = ConsentRequestMqMessage.encode(protoMessage).finish();
      break;
    }
    case messageTypes.AS_RESPONSE: {
      const { data, ...messageJson } = message;
      let dataDataUrlPrefix;
      let dataBuffer;
      if (data != null) {
        // Data is present if it's not an error response
        const dataUrlParsedData = parseDataURL(data);
        if (dataUrlParsedData != null) {
          const match = data.match(dataUrlRegex);
          if (match[4] && match[4].endsWith('base64')) {
            // Convert data with data URL format to Buffer for transfer over MQ
            // In case it is base64 encoded, MQ message payload size is reduced
            dataDataUrlPrefix = match[1];
            dataBuffer = dataUrlParsedData.body;
          }
        }
        if (!dataDataUrlPrefix && !dataBuffer) {
          messageJson.data = data;
        }
      }
      const request_json = JSON.stringify(messageJson);
      const asDataResponseMqMessageObject = {
        request_json,
        data_data_url_prefix: dataDataUrlPrefix,
        data_bytes: dataBuffer,
      };
      const protoMessage = AsDataResponseMqMessage.create(
        asDataResponseMqMessageObject
      );
      messageBuffer = AsDataResponseMqMessage.encode(protoMessage).finish();
      break;
    }
    default: {
      const messageStr = JSON.stringify(message);
      messageBuffer = Buffer.from(messageStr, 'utf8');
    }
  }

  let messageCompressionAlgorithm;
  if (compressMinLength && messageBuffer.length >= compressMinLength) {
    messageBuffer = await gzip(messageBuffer);
    messageCompressionAlgorithm = MESSAGE_COMPRESSION_ALGORITHM;
  } else {
    messageCompressionAlgorithm = null;
  }

  return {
    messageType: message.type,
    messageBuffer,
    messageCompressionAlgorithm,
  };
}

export async function deserializeMqMessage(
  messageType,
  messageBuffer,
  messageCompressionAlgorithm
) {
  let uncompressedMessageBuffer;

  if (messageCompressionAlgorithm) {
    if (messageCompressionAlgorithm !== MESSAGE_COMPRESSION_ALGORITHM) {
      throw new Error('Unsupported message compression algorithm');
    }
    uncompressedMessageBuffer = await unzip(messageBuffer, {
      // Prevent large uncompressed file that is able to compressed to <= 3MB
      maxOutputLength: config.mqMessageMaxUncompressedLength,
    });
  } else {
    uncompressedMessageBuffer = messageBuffer;
  }

  let message;
  switch (messageType) {
    case messageTypes.CONSENT_REQUEST: {
      const decodedMessage = ConsentRequestMqMessage.decode(
        uncompressedMessageBuffer
      );
      const {
        request_json,
        request_message_data_url_prefix,
        request_message_bytes,
      } = decodedMessage;
      message = JSON.parse(request_json);
      if (request_message_data_url_prefix && request_message_bytes) {
        message = {
          ...message,
          request_message: `${request_message_data_url_prefix}${request_message_bytes.toString(
            'base64'
          )}`,
        };
      }
      break;
    }
    case messageTypes.AS_RESPONSE: {
      const decodedMessage = AsDataResponseMqMessage.decode(
        uncompressedMessageBuffer
      );
      const { request_json, data_data_url_prefix, data_bytes } = decodedMessage;
      message = JSON.parse(request_json);
      if (data_data_url_prefix && data_bytes) {
        message = {
          ...message,
          data: `${data_data_url_prefix}${data_bytes.toString('base64')}`,
        };
      }
      break;
    }
    default: {
      const messageStr = uncompressedMessageBuffer.toString('utf8');
      message = JSON.parse(messageStr);
    }
  }

  return message;
}
