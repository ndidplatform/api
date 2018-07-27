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

import { checkAssociated, checkForExistedIdentity } from '.';

import logger from '../../logger';

import CustomError from '../../error/custom_error';
import errorType from '../../error/type';
import { getErrorObjectForClient } from '../../error/helpers';

import * as tendermintNdid from '../../tendermint/ndid';
import * as utils from '../../utils';
import { callbackToClient } from '../../utils/callback';
import * as common from '../common';
import * as config from '../../config';
import * as db from '../../db';
import {
  isAccessorSignUrlSet,
  notifyCreateIdentityResultByCallback,
  accessorSign,
} from '../idp';
import {
  getRequestMessageForCreatingIdentity,
  getRequestMessageForAddingAccessor,
} from '../../utils/request_message';

export async function createIdentity(
  {
    reference_id,
    callback_url,
    namespace,
    identifier,
    accessor_type,
    accessor_public_key,
    accessor_id,
    ial,
    addAccessor,
  },
  { synchronous = false, apiVersion } = {}
) {
  try {
    common.validateKeyType(accessor_public_key, accessor_type);

    let onboardData = await db.getOnboardDataByReferenceId(reference_id);
    if (onboardData) {
      let { request_id, accessor_id } = onboardData;
      return { request_id, accessor_id };
    }

    ial = parseFloat(ial);

    const namespaceDetails = await tendermintNdid.getNamespaceList();
    const valid = namespaceDetails.find(
      (namespaceDetail) => namespaceDetail.namespace === namespace
    );
    if (!valid) {
      throw new CustomError({
        message: errorType.INVALID_NAMESPACE.message,
        code: errorType.INVALID_NAMESPACE.code,
        clientError: true,
        details: {
          namespace,
        },
      });
    }

    let associated = await checkAssociated({
      namespace,
      identifier,
    });
    //already onboard this user
    if (!addAccessor && associated) {
      throw new CustomError({
        message: errorType.IDENTITY_ALREADY_CREATED.message,
        code: errorType.IDENTITY_ALREADY_CREATED.code,
        clientError: true,
        details: {
          namespace,
          identifier,
        },
      });
    }

    //check ial
    let { max_ial } = await tendermintNdid.getNodeInfo(config.nodeId);
    if (ial > max_ial) {
      throw new CustomError({
        message: errorType.MAXIMUM_IAL_EXCEED.message,
        code: errorType.MAXIMUM_IAL_EXCEED.code,
        clientError: true,
        details: {
          namespace,
          identifier,
        },
      });
    }

    if (!accessor_id) accessor_id = utils.randomBase64Bytes(32);

    if (!isAccessorSignUrlSet()) {
      throw new CustomError({
        message: errorType.SIGN_WITH_ACCESSOR_KEY_URL_NOT_SET.message,
        code: errorType.SIGN_WITH_ACCESSOR_KEY_URL_NOT_SET.code,
      });
    }

    let checkDuplicateAccessorId = await tendermintNdid.getAccessorKey(
      accessor_id
    );
    if (checkDuplicateAccessorId != null) {
      throw new CustomError({
        message: errorType.DUPLICATE_ACCESSOR_ID.message,
        code: errorType.DUPLICATE_ACCESSOR_ID.code,
        clientError: true,
        details: {
          accessor_id,
        },
      });
    }

    const request_id = utils.createRequestId();

    if (synchronous) {
      const sid = namespace + ':' + identifier;
      const hash_id = utils.hash(sid);
      const secret = await createSecret({
        sid,
        hash_id,
        accessor_id,
        reference_id,
        accessor_public_key,
      });
      const exist = await checkForExistedIdentity({
        namespace,
        identifier,
        ial,
      });
      createIdentityInternalAsync(...arguments, {
        request_id,
        associated,
        generated_accessor_id: accessor_id,
        exist,
        secret,
      });
      return { request_id, exist, accessor_id };
    } else {
      await db.setCallbackUrlByReferenceId(reference_id, callback_url);

      createIdentityInternalAsync(...arguments, {
        request_id,
        associated,
        generated_accessor_id: accessor_id,
      });
      return { request_id, accessor_id };
    }
  } catch (error) {
    const err = new CustomError({
      message: 'Cannot create new identity',
      cause: error,
    });
    logger.error(err.getInfoForLog());
    throw err;
  }
}

async function createIdentityInternalAsync(
  {
    reference_id,
    callback_url,
    namespace,
    identifier,
    accessor_type,
    accessor_public_key,
    accessor_id,
    ial,
    addAccessor,
  },
  { synchronous = false, apiVersion } = {},
  { request_id, associated, generated_accessor_id, exist, secret }
) {
  try {
    if (accessor_id == null) {
      accessor_id = generated_accessor_id;
    }

    const sid = namespace + ':' + identifier;
    const hash_id = utils.hash(sid);

    if (secret == null) {
      secret = await createSecret({
        sid,
        hash_id,
        accessor_id,
        reference_id,
        accessor_public_key,
      });
    }

    if (exist == null) {
      // async mode
      await checkForExistedIdentity(
        { namespace, identifier, ial },
        {
          callbackFnName:
            'identity.createIdentityInternalAsyncAfterExistedIdentityCheckBlockchain',
          callbackAdditionalArgs: [
            {
              reference_id,
              callback_url,
              namespace,
              identifier,
              accessor_type,
              accessor_public_key,
              accessor_id,
              ial,
              addAccessor,
            },
            { synchronous, apiVersion },
            {
              request_id,
              associated,
              generated_accessor_id,
              secret,
              sid,
              hash_id,
            },
          ],
        }
      );
    } else {
      // sync mode
      await createIdentityInternalAsyncAfterExistedIdentityCheckBlockchain(
        { exist },
        {
          reference_id,
          callback_url,
          namespace,
          identifier,
          accessor_type,
          accessor_public_key,
          accessor_id,
          ial,
          addAccessor,
        },
        { synchronous, apiVersion },
        { request_id, associated, generated_accessor_id, secret, sid, hash_id }
      );
    }
  } catch (error) {
    logger.error({
      message: 'Create identity internal async error',
      originalArgs: arguments[0],
      options: arguments[1],
      additionalArgs: arguments[2],
      error,
    });

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          type: addAccessor
            ? 'add_accessor_request_result'
            : 'create_identity_request_result',
          success: false,
          reference_id,
          request_id,
          accessor_id:
            accessor_id != null ? accessor_id : generated_accessor_id,
          error: getErrorObjectForClient(error),
        },
        true
      );
    }

    await createIdentityCleanUpOnError({
      requestId: request_id,
      referenceId: reference_id,
    });

    throw error;
  }
}

export async function createIdentityInternalAsyncAfterExistedIdentityCheckBlockchain(
  { exist, error },
  {
    reference_id,
    callback_url,
    namespace,
    identifier,
    accessor_type,
    accessor_public_key,
    accessor_id,
    ial,
    addAccessor,
  },
  { synchronous = false, apiVersion } = {},
  { request_id, associated, generated_accessor_id, secret, sid, hash_id }
) {
  try {
    if (error) throw error;

    if (!synchronous) {
      await common.createRequest(
        {
          request_id,
          namespace,
          identifier,
          reference_id,
          idp_id_list: [],
          callback_url: 'none_system_generated',
          data_request_list: [],
          request_message: ial
            ? getRequestMessageForCreatingIdentity({
                namespace,
                identifier,
                reference_id,
                node_id: config.nodeId,
              })
            : getRequestMessageForAddingAccessor({
                namespace,
                identifier,
                reference_id,
                node_id: config.nodeId,
              }),
          min_ial: 1.1,
          min_aal: 1,
          min_idp: exist ? 1 : 0,
          request_timeout: 86400,
          mode: 3,
        },
        {
          synchronous: false,
          sendCallbackToClient: false,
          callbackFnName:
            'identity.createIdentityInternalAsyncAfterCreateRequestBlockchain',
          callbackAdditionalArgs: [
            {
              reference_id,
              callback_url,
              namespace,
              identifier,
              accessor_type,
              accessor_public_key,
              accessor_id,
              ial,
              addAccessor,
            },
            { synchronous, apiVersion },
            {
              exist,
              request_id,
              sid,
              hash_id,
              generated_accessor_id,
              associated,
              secret,
            },
          ],
        }
      );
    } else {
      await common.createRequest(
        {
          request_id,
          namespace,
          identifier,
          reference_id,
          idp_id_list: [],
          callback_url: 'none_system_generated',
          data_request_list: [],
          request_message: ial
            ? getRequestMessageForCreatingIdentity({
                namespace,
                identifier,
                reference_id,
                node_id: config.nodeId,
              })
            : getRequestMessageForAddingAccessor({
                namespace,
                identifier,
                reference_id,
                node_id: config.nodeId,
              }),
          min_ial: 1.1,
          min_aal: 1,
          min_idp: exist ? 1 : 0,
          request_timeout: 86400,
          mode: 3,
        },
        { synchronous: true }
      );
      await createIdentityInternalAsyncAfterCreateRequestBlockchain(
        {},
        {
          reference_id,
          callback_url,
          namespace,
          identifier,
          accessor_type,
          accessor_public_key,
          accessor_id,
          ial,
          addAccessor,
        },
        { synchronous, apiVersion },
        {
          exist,
          request_id,
          sid,
          hash_id,
          generated_accessor_id,
          associated,
          secret,
        }
      );
    }
  } catch (error) {
    logger.error({
      message:
        'Create identity internal async after existed identity check error',
      originalArgs: arguments[0],
      options: arguments[1],
      additionalArgs: arguments[2],
      error,
    });

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          type: addAccessor
            ? 'add_accessor_request_result'
            : 'create_identity_request_result',
          success: false,
          reference_id,
          request_id,
          accessor_id:
            accessor_id != null ? accessor_id : generated_accessor_id,
          error: getErrorObjectForClient(error),
        },
        true
      );
    }

    await createIdentityCleanUpOnError({
      requestId: request_id,
      referenceId: reference_id,
    });

    throw error;
  }
}

export async function createIdentityInternalAsyncAfterCreateRequestBlockchain(
  { error },
  {
    reference_id,
    callback_url,
    namespace,
    identifier,
    accessor_type,
    accessor_public_key,
    accessor_id,
    ial,
    addAccessor,
  },
  { synchronous = false, apiVersion } = {},
  { exist, request_id, sid, hash_id, generated_accessor_id, associated, secret }
) {
  try {
    if (error) throw error;

    await db.setOnboardDataByReferenceId(reference_id, {
      request_id,
      accessor_id,
    });
    await db.setReferenceIdByRequestId(request_id, reference_id);

    if (exist) {
      if (!synchronous) {
        await callbackToClient(
          callback_url,
          addAccessor
            ? {
                type: 'add_accessor_request_result',
                reference_id,
                request_id,
                accessor_id,
                success: true,
              }
            : {
                type: 'create_identity_request_result',
                reference_id,
                request_id,
                accessor_id,
                success: true,
                exist: true,
              },
          true
        );
      }

      //save data for add accessor to persistent
      await db.setIdentityFromRequestId(request_id, {
        accessor_type,
        accessor_id,
        accessor_public_key,
        hash_id,
        ial,
        sid,
        associated,
        secret,
      });
    } else {
      if (!synchronous) {
        await callbackToClient(
          callback_url,
          addAccessor
            ? {
                type: 'add_accessor_request_result',
                reference_id,
                request_id,
                accessor_id,
                success: true,
              }
            : {
                type: 'create_identity_request_result',
                reference_id,
                request_id,
                accessor_id,
                success: true,
                exist: false,
              },
          true
        );
      }

      const accessor_group_id = utils.randomBase64Bytes(32);

      if (!synchronous) {
        await tendermintNdid.createIdentity(
          {
            accessor_type,
            accessor_public_key,
            accessor_id,
            accessor_group_id,
          },
          'identity.createIdentityInternalAsyncAfterBlockchain',
          [
            {
              reference_id,
              callback_url,
              request_id,
              namespace,
              identifier,
              secret,
              addAccessor,
              accessor_id,
              generated_accessor_id,
            },
            { synchronous, apiVersion },
          ]
        );
      } else {
        await tendermintNdid.createIdentity({
          accessor_type,
          accessor_public_key,
          accessor_id,
          accessor_group_id,
        });
        await createIdentityInternalAsyncAfterBlockchain(
          {},
          {
            reference_id,
            callback_url,
            request_id,
            namespace,
            identifier,
            secret,
            addAccessor,
            accessor_id,
            generated_accessor_id,
          },
          { synchronous, apiVersion }
        );
      }
    }
  } catch (error) {
    logger.error({
      message: 'Create identity internal async after create request error',
      tendermintResult: arguments[0],
      originalArgs: arguments[1],
      options: arguments[2],
      additionalArgs: arguments[3],
      error,
    });

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          type: addAccessor
            ? 'add_accessor_request_result'
            : 'create_identity_request_result',
          success: false,
          reference_id,
          request_id,
          accessor_id:
            accessor_id != null ? accessor_id : generated_accessor_id,
          error: getErrorObjectForClient(error),
        },
        true
      );
    }

    await createIdentityCleanUpOnError({
      requestId: request_id,
      referenceId: reference_id,
    });

    throw error;
  }
}

export async function createIdentityInternalAsyncAfterBlockchain(
  { error },
  {
    reference_id,
    callback_url,
    request_id,
    namespace,
    identifier,
    secret,
    addAccessor,
    accessor_id,
    generated_accessor_id,
  },
  { synchronous = true, apiVersion } = {}
) {
  try {
    if (error) throw error;

    const hash_id = utils.hash(namespace + ':' + identifier);
    if (!synchronous) {
      await tendermintNdid.clearRegisterMsqDestinationTimeout(
        hash_id,
        'identity.createIdentityInternalAsyncAfterClearMqDestTimeout',
        [
          {
            reference_id,
            callback_url,
            request_id,
            namespace,
            identifier,
            secret,
            addAccessor,
            accessor_id,
            generated_accessor_id,
          },
          { synchronous, apiVersion },
        ]
      );
    } else {
      await tendermintNdid.clearRegisterMsqDestinationTimeout(hash_id);
      await createIdentityInternalAsyncAfterClearMqDestTimeout(
        {},
        {
          reference_id,
          callback_url,
          request_id,
          namespace,
          identifier,
          secret,
          addAccessor,
          accessor_id,
          generated_accessor_id,
        },
        { synchronous, apiVersion }
      );
    }
  } catch (error) {
    logger.error({
      message: 'Create identity internal async after blockchain error',
      tendermintResult: arguments[0],
      additionalArgs: arguments[1],
      options: arguments[2],
      error,
    });

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          type: addAccessor
            ? 'add_accessor_request_result'
            : 'create_identity_request_result',
          success: false,
          reference_id,
          request_id,
          accessor_id:
            accessor_id != null ? accessor_id : generated_accessor_id,
          error: getErrorObjectForClient(error),
        },
        true
      );
    }

    await createIdentityCleanUpOnError({
      requestId: request_id,
      referenceId: reference_id,
    });

    throw error;
  }
}

export async function createIdentityInternalAsyncAfterClearMqDestTimeout(
  { error },
  {
    reference_id,
    callback_url,
    request_id,
    namespace,
    identifier,
    secret,
    addAccessor,
    accessor_id,
    generated_accessor_id,
  },
  { synchronous = true, apiVersion } = {}
) {
  try {
    if (error) throw error;

    if (apiVersion === 1) {
      notifyCreateIdentityResultByCallback({
        reference_id,
        request_id,
        success: true,
        secret,
      });
    } else {
      await callbackToClient(
        callback_url,
        {
          type: 'create_identity_result',
          success: true,
          reference_id,
          request_id,
          secret,
        },
        true
      );
      db.removeCallbackUrlByReferenceId(reference_id);
      await common.closeRequest(
        {
          request_id,
        },
        { synchronous: true }
      );
    }
    db.removeOnboardDataByReferenceId(reference_id);
  } catch (error) {
    logger.error({
      message:
        'Create identity internal async after clear MQ dest. timeout error',
      tendermintResult: arguments[0],
      additionalArgs: arguments[1],
      options: arguments[2],
      error,
    });

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          type: addAccessor
            ? 'add_accessor_request_result'
            : 'create_identity_request_result',
          success: false,
          reference_id,
          request_id,
          accessor_id:
            accessor_id != null ? accessor_id : generated_accessor_id,
          error: getErrorObjectForClient(error),
        },
        true
      );
    }

    await createIdentityCleanUpOnError({
      requestId: request_id,
      referenceId: reference_id,
    });

    throw error;
  }
}

async function createIdentityCleanUpOnError({ requestId, referenceId }) {
  await Promise.all([
    db.removeCallbackUrlByReferenceId(referenceId),
    db.removeReferenceIdByRequestId(requestId),
    db.removeOnboardDataByReferenceId(requestId),
    db.removeIdentityFromRequestId(requestId),
  ]);
}

async function createSecret({
  sid,
  hash_id,
  accessor_id,
  reference_id,
  accessor_public_key,
}) {
  const signature = await accessorSign({
    sid,
    hash_id,
    accessor_id,
    accessor_public_key,
    reference_id,
  });
  const padding = utils.extractPaddingFromPrivateEncrypt(
    signature,
    accessor_public_key
  );
  return padding + '|' + signature;
}
