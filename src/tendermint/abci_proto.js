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

const abciParamsProtobufRoot = protobuf.loadSync(
  path.join(__dirname, '..', '..', 'protos', 'params.proto')
);

const FUNCTIONS = [
  // NDID only Tx
  'InitNDID',
  'RegisterServiceDestinationByNDID',
  'SetNodeToken',
  'AddNodeToken',
  'ReduceNodeToken',
  'RegisterNode',
  'UpdateNodeByNDID',
  'AddNamespace',
  'EnableNamespace',
  'DisableNamespace',
  'AddService',
  'UpdateService',
  'EnableService',
  'DisableService',
  'SetValidator',
  'SetTimeOutBlockRegisterMsqDestination',
  'EnableServiceDestinationByNDID',
  'DisableServiceDestinationByNDID',
  'AddNodeToProxyNode',
  'UpdateNodeProxyNode',
  'RemoveNodeFromProxyNode',

  // Tx
  'AddNodePublicKey',
  'RegisterMsqAddress',
  'UpdateNode',
  'CreateIdentity',
  'ClearRegisterMsqDestinationTimeout',
  'RegisterMsqDestination',
  'AddAccessorMethod',
  'CreateRequest',
  'CloseRequest',
  'TimeOutRequest',
  'SetDataReceived',
  'UpdateIdentity',
  'DeclareIdentityProof',
  'CreateIdpResponse',
  'SignData',
  'RegisterServiceDestination',
  'UpdateServiceDestination',

  // Query
  'GetNodePublicKey',
  'GetNodeMasterPublicKey',
  'GetMsqAddress',
  'GetNodeToken',
  'GetRequest',
  'GetRequestDetail',
  'GetIdpNodes',
  'GetIdpNodesInfo',
  'GetAsNodesByServiceId',
  'GetAsNodesInfoByServiceId',
  'GetServicesByAsID',
  'GetAccessorGroupID',
  'GetAccessorKey',
  'CheckExistingIdentity',
  'GetIdentityInfo',
  'GetIdentityProof',
  'GetDataSignature',
  'GetServiceDetail',
  'GetNamespaceList',
  'GetServiceList',
  'GetNodeInfo',
  'CheckExistingAccessorID',
  'CheckExistingAccessorGroupID',
  'GetNodesBehindProxyNode',
];

const PROTO_STRUCTS = {};

FUNCTIONS.forEach((fnName) => {
  PROTO_STRUCTS[fnName] = abciParamsProtobufRoot.lookup(''); // FIXME: concat with "Params" or another mapping
});

/**
 *
 * @param {string} fnName
 * @param {Object} params
 */
export function encodeProtobuf(fnName, params) {
  const proto = PROTO_STRUCTS[fnName];
  const protobufObject = proto.create(params);
  const protobufBuffer = proto.encode(protobufObject).finish();
  return protobufBuffer;
}

/**
 *
 * @param {string} fnName
 * @param {Buffer} protobufBuffer
 */
export function decodeProtobuf(fnName, protobufBuffer) {
  const proto = PROTO_STRUCTS[fnName];
  return proto.decode(protobufBuffer).toObject();
}
