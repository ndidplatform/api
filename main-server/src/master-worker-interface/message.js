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
const RpProcessRequestUpdateArgs = workerFunctionsProtobufRoot.lookupType(
  'RpProcessRequestUpdateArgs'
);
const MqProcessRawMessageArgs = workerFunctionsProtobufRoot.lookupType(
  'MqProcessRawMessageArgs'
);
const OthersArgs = workerFunctionsProtobufRoot.lookupType('OthersArgs');

function getArgsProtobufType(fnName) {
  let protobufType;
  switch (fnName) {
    // Core module - process task by request ID
    // case 'rp.processMessage':
    //   break;
    // case 'rp.processRequestUpdate':
    //   protobufType = RpProcessRequestUpdateArgs;
    //   break;
    // case 'idp.processMessage':
    //   break;
    // case 'idp.processRequestUpdate':
    //   break;
    // case 'idp.processCreateIdentityRequest':
    //   break;
    // case 'as.processMessage':
    //   break;
    // case 'as.processRequestUpdate':
    //   break;
    // MQ
    case 'mq.processRawMessage':
      protobufType = MqProcessRawMessageArgs;
      break;
    // callback
    // case 'callback.resumeCallbackToClientOnWorker':
    //   break;
    // case 'callback.continueCallbackWithRetry':
    //   break;
    default:
      protobufType = OthersArgs;
  }
  return protobufType;
}

export function getArgsProtobuf(fnName, args) {
  const protobufType = getArgsProtobufType(fnName);
  if (protobufType === OthersArgs) {
    args = {
      args: JSON.stringify(args),
    };
  }

  const protoMessage = protobufType.create(args);
  const protoBuffer = protobufType.encode(protoMessage).finish();
  return protoBuffer;
}

export function getArgsFromProtobuf(fnName, argsProtobuf) {
  const protobufType = getArgsProtobufType(fnName);
  if (protobufType === OthersArgs) {
    const decodedMessage = OthersArgs.decode(argsProtobuf);
    if (decodedMessage.args) {
      let retVal = JSON.parse(decodedMessage.args);
      retVal = retVal.map((val) => {
        if (val.type === 'Buffer') {
          return Buffer.from(val);
        }
        return val;
      });
      return retVal;
    }
  } else {
    const decodedMessage = protobufType.decode(argsProtobuf);
    return decodedMessage;
  }
}
