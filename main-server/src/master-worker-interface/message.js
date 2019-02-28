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

const workerFunctionsProtobufRootInstance = new protobuf.Root();
const workerFunctionsProtobufRoot = workerFunctionsProtobufRootInstance.loadSync(
  path.join(__dirname, '..', '..', '..', 'protos', 'worker_functions.proto'),
  { keepCase: true }
);
const MqProcessRawMessageArgs = workerFunctionsProtobufRoot.lookupType(
  'MqProcessRawMessageArgs'
);
const MqProcessRawMessageReturn = workerFunctionsProtobufRoot.lookupType(
  'MqProcessRawMessageReturn'
);

const OthersArgs = workerFunctionsProtobufRoot.lookupType('OthersArgs');
const OthersReturn = workerFunctionsProtobufRoot.lookupType('OthersReturn');

export function getArgsProtobufBuffer(fnName, args) {
  let protobufType;
  switch (fnName) {
    // Core module - process task by request ID
    // case 'rp.processMessage':
    //   return rp.processMessage;
    // case 'rp.processRequestUpdate':
    //   return rp.processRequestUpdate;
    // case 'idp.processMessage':
    //   return idp.processMessage;
    // case 'idp.processRequestUpdate':
    //   return idp.processRequestUpdate;
    // case 'idp.processCreateIdentityRequest':
    //   return idp.processCreateIdentityRequest;
    // case 'as.processMessage':
    //   return as.processMessage;
    // case 'as.processRequestUpdate':
    //   return as.processRequestUpdate;
    // MQ
    case 'mq.processRawMessage':
      protobufType = MqProcessRawMessageArgs;
      break;
    // callback
    // case 'callback.handleCallbackWorkerLost':
    //   return callback.handleCallbackWorkerLost;
    default:
      protobufType = OthersArgs;
      args = {
        args: JSON.stringify(args),
      };
  }

  const protoMessage = protobufType.create(args);
  const protoBuffer = protobufType.encode(protoMessage).finish();
  return protoBuffer;
}

export function getArgsFromProtobufBuffer(fnName, argsProtobuf) {
  let protobufType;
  switch (fnName) {
    // Core module - process task by request ID
    // case 'rp.processMessage':
    //   return rp.processMessage;
    // case 'rp.processRequestUpdate':
    //   return rp.processRequestUpdate;
    // case 'idp.processMessage':
    //   return idp.processMessage;
    // case 'idp.processRequestUpdate':
    //   return idp.processRequestUpdate;
    // case 'idp.processCreateIdentityRequest':
    //   return idp.processCreateIdentityRequest;
    // case 'as.processMessage':
    //   return as.processMessage;
    // case 'as.processRequestUpdate':
    //   return as.processRequestUpdate;
    // MQ
    case 'mq.processRawMessage':
      protobufType = MqProcessRawMessageArgs;
      break;
    // callback
    // case 'callback.handleCallbackWorkerLost':
    //   return callback.handleCallbackWorkerLost;
    default: {
      const decodedMessage = OthersArgs.decode(argsProtobuf);
      let retVal = JSON.parse(decodedMessage.args);
      retVal = retVal.map((val) => {
        if (val.type === 'Buffer') {
          return Buffer.from(val);
        }
        return val;
      });
      return retVal;
    }
  }

  const decodedMessage = protobufType.decode(argsProtobuf);
  return decodedMessage;
}

export function getReturnValue(fnName, retValProtobuf) {
  let protobufType;
  switch (fnName) {
    // Core module - process task by request ID
    // case 'rp.processMessage':
    //   return rp.processMessage;
    // case 'rp.processRequestUpdate':
    //   return rp.processRequestUpdate;
    // case 'idp.processMessage':
    //   return idp.processMessage;
    // case 'idp.processRequestUpdate':
    //   return idp.processRequestUpdate;
    // case 'idp.processCreateIdentityRequest':
    //   return idp.processCreateIdentityRequest;
    // case 'as.processMessage':
    //   return as.processMessage;
    // case 'as.processRequestUpdate':
    //   return as.processRequestUpdate;
    // MQ
    case 'mq.processRawMessage':
      protobufType = MqProcessRawMessageReturn;
      break;
    // callback
    // case 'callback.handleCallbackWorkerLost':
    //   return callback.handleCallbackWorkerLost;
    default: {
      const decodedMessage = OthersReturn.decode(retValProtobuf);
      let retVal = JSON.parse(decodedMessage.args);
      retVal = retVal.map((val) => {
        if (val.type === 'Buffer') {
          return Buffer.from(val);
        }
        return val;
      });
      return retVal;
    }
  }

  const decodedMessage = protobufType.decode(retValProtobuf);
  return decodedMessage;
}
