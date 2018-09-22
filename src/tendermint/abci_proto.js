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

import CustomError from '../error/custom_error';

const abciParamsProtobufRootInstance = new protobuf.Root();
const abciParamsProtobufRoot = abciParamsProtobufRootInstance.loadSync(
  path.join(__dirname, '..', '..', 'protos', 'abci', 'params.proto'),
  {
    keepCase: true,
  }
);

const abciResultProtobufRootInstance = new protobuf.Root();
const abciResultProtobufRoot = abciResultProtobufRootInstance.loadSync(
  path.join(__dirname, '..', '..', 'protos', 'abci', 'result.proto'),
  {
    keepCase: true,
  }
);

const TX_FUNCTIONS = [
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
];

const TX_FUNCTION_PARAMS_MESSAGE_TYPES = {
  // NDID only Tx
  InitNDID: 'InitNDIDParams',
  RegisterServiceDestinationByNDID: 'RegisterServiceDestinationByNDIDParams',
  SetNodeToken: 'SetNodeTokenParams',
  AddNodeToken: 'AddNodeTokenParams',
  ReduceNodeToken: 'ReduceNodeTokenParams',
  RegisterNode: 'RegisterNodeParams',
  UpdateNodeByNDID: 'UpdateNodeByNDIDParams',
  AddNamespace: 'AddNamespaceParams',
  EnableNamespace: 'DisableNamespaceParams',
  DisableNamespace: 'DisableNamespaceParams',
  AddService: 'AddServiceParams',
  UpdateService: 'UpdateServiceParams',
  EnableService: 'DisableServiceParams',
  DisableService: 'DisableServiceParams',
  SetValidator: 'SetValidatorParams',
  SetTimeOutBlockRegisterMsqDestination:
    'TimeOutBlockRegisterMsqDestinationParams',
  EnableServiceDestinationByNDID: 'DisableServiceDestinationByNDIDParams',
  DisableServiceDestinationByNDID: 'DisableServiceDestinationByNDIDParams',
  AddNodeToProxyNode: 'AddNodeToProxyNodeParams',
  UpdateNodeProxyNode: 'UpdateNodeProxyNodeParams',
  RemoveNodeFromProxyNode: 'RemoveNodeFromProxyNodeParams',

  // Tx
  RegisterMsqAddress: 'RegisterMsqAddressParams',
  UpdateNode: 'UpdateNodeParams',
  CreateIdentity: 'CreateIdentityParams',
  ClearRegisterMsqDestinationTimeout:
    'ClearRegisterMsqDestinationTimeoutParams',
  RegisterMsqDestination: 'RegisterMsqDestinationParams',
  AddAccessorMethod: 'AccessorMethodParams',
  CreateRequest: 'CreateRequestParams',
  CloseRequest: 'CloseRequestParams',
  TimeOutRequest: 'TimeOutRequestParams',
  SetDataReceived: 'SetDataReceivedParams',
  UpdateIdentity: 'UpdateIdentityParams',
  DeclareIdentityProof: 'DeclareIdentityProofParams',
  CreateIdpResponse: 'CreateIdpResponseParams',
  SignData: 'SignDataParams',
  RegisterServiceDestination: 'RegisterServiceDestinationParams',
  UpdateServiceDestination: 'UpdateServiceDestinationParams',
};

const QUERY_FUNCTIONS = [
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

const QUERY_FUNCTION_PARAMS_MESSAGE_TYPES = {
  GetNodePublicKey: 'GetNodePublicKeyParams',
  GetNodeMasterPublicKey: 'GetNodeMasterPublicKeyParams',
  GetMsqAddress: 'GetMsqAddressParams',
  GetNodeToken: 'GetNodeTokenParams',
  GetRequest: 'GetRequestParams',
  GetRequestDetail: 'GetRequestParams',
  GetIdpNodes: 'GetIdpNodesParams',
  GetIdpNodesInfo: 'GetIdpNodesParams',
  GetAsNodesByServiceId: 'GetAsNodesByServiceIdParams',
  GetAsNodesInfoByServiceId: 'GetAsNodesByServiceIdParams',
  GetServicesByAsID: 'GetServicesByAsIDParams',
  GetAccessorGroupID: 'GetAccessorGroupIDParams',
  GetAccessorKey: 'GetAccessorKeyParams',
  CheckExistingIdentity: 'CheckExistingIdentityParams',
  GetIdentityInfo: 'GetIdentityInfoParams',
  GetIdentityProof: 'GetIdentityProofParams',
  GetDataSignature: 'GetDataSignatureParams',
  GetServiceDetail: 'GetServiceDetailParams',
  GetNamespaceList: null, // no params
  GetServiceList: null, // no params
  GetNodeInfo: 'GetNodeInfoParams',
  CheckExistingAccessorID: 'CheckExistingAccessorIDParams',
  CheckExistingAccessorGroupID: 'CheckExistingAccessorGroupIDParams',
  GetNodesBehindProxyNode: 'GetNodesBehindProxyNodeParams',
};

const QUERY_FUNCTION_RESULT_MESSAGE_TYPES = {
  GetNodePublicKey: 'GetNodePublicKeyResult',
  GetNodeMasterPublicKey: 'GetNodeMasterPublicKeyResult',
  GetMsqAddress: 'GetMsqAddressResult',
  GetNodeToken: 'GetNodeTokenResult',
  GetRequest: 'GetRequestResult',
  GetRequestDetail: 'GetRequestDetailResult',
  GetIdpNodes: 'GetIdpNodesResult',
  GetIdpNodesInfo: 'GetIdpNodesInfoResult',
  GetAsNodesByServiceId: 'GetAsNodesByServiceIdResult',
  GetAsNodesInfoByServiceId: 'GetAsNodesInfoByServiceIdResult',
  GetServicesByAsID: 'GetServicesByAsIDResult',
  GetAccessorGroupID: 'GetAccessorGroupIDResult',
  GetAccessorKey: 'GetAccessorKeyResult',
  CheckExistingIdentity: 'CheckExistingIdentityResult',
  GetIdentityInfo: 'GetIdentityInfoResult',
  GetIdentityProof: 'GetIdentityProofResult',
  GetDataSignature: 'GetDataSignatureResult',
  GetServiceDetail: 'GetServiceDetailResult',
  GetNamespaceList: 'GetNamespaceListResult',
  GetServiceList: 'GetServiceListResult',
  GetNodeInfo: 'GetNodeInfoResult',
  CheckExistingAccessorID: 'CheckExistingAccessorIDResult',
  CheckExistingAccessorGroupID: 'CheckExistingAccessorIDResult',
  GetNodesBehindProxyNode: 'GetNodesBehindProxyNodeResult',
};

const TX_PARAMS_PROTO_STRUCTS = {};
const QUERY_PARAMS_PROTO_STRUCTS = {};
const QUERY_RESULT_PROTO_STRUCTS = {};

TX_FUNCTIONS.forEach((fnName) => {
  if (TX_FUNCTION_PARAMS_MESSAGE_TYPES[fnName] != null) {
    TX_PARAMS_PROTO_STRUCTS[fnName] = abciParamsProtobufRoot.lookupType(
      TX_FUNCTION_PARAMS_MESSAGE_TYPES[fnName]
    );
  }
});

QUERY_FUNCTIONS.forEach((fnName) => {
  if (QUERY_FUNCTION_PARAMS_MESSAGE_TYPES[fnName] != null) {
    QUERY_PARAMS_PROTO_STRUCTS[fnName] = abciParamsProtobufRoot.lookupType(
      QUERY_FUNCTION_PARAMS_MESSAGE_TYPES[fnName]
    );
  }
});

QUERY_FUNCTIONS.forEach((fnName) => {
  if (QUERY_FUNCTION_RESULT_MESSAGE_TYPES[fnName] != null) {
    QUERY_RESULT_PROTO_STRUCTS[fnName] = abciResultProtobufRoot.lookupType(
      QUERY_FUNCTION_RESULT_MESSAGE_TYPES[fnName]
    );
  }
});

/**
 *
 * @param {string} fnName
 * @param {Object} params
 */
export function encodeProtobuf(fnName, params) {
  let proto;
  if (TX_FUNCTIONS.indexOf(fnName) >= 0) {
    proto = TX_PARAMS_PROTO_STRUCTS[fnName];
  } else if (QUERY_FUNCTIONS.indexOf(fnName) >= 0) {
    proto = QUERY_PARAMS_PROTO_STRUCTS[fnName];
  }
  if (proto == null) {
    throw new CustomError({
      message: 'Unknown function name',
    });
  }
  const protobufMessageObject = proto.create(params);
  const protobufBuffer = proto.encode(protobufMessageObject).finish();
  return protobufBuffer;
}

/**
 *
 * @param {string} fnName
 * @param {Buffer} protobufBuffer
 */
export function decodeProtobuf(fnName, protobufBuffer) {
  let proto;
  if (TX_FUNCTIONS.indexOf(fnName) >= 0) {
    proto = TX_PARAMS_PROTO_STRUCTS[fnName];
  } else if (QUERY_FUNCTIONS.indexOf(fnName) >= 0) {
    proto = QUERY_RESULT_PROTO_STRUCTS[fnName];
  }
  if (proto == null) {
    throw new CustomError({
      message: 'Unknown function name',
    });
  }
  const protobufMessageObject = proto.decode(protobufBuffer);
  return proto.toObject(protobufMessageObject, {
    longs: Number,
  });
}
