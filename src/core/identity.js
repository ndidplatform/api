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

import logger from '../logger';

import CustomError from '../error/custom_error';
import errorType from '../error/type';
import { getErrorObjectForClient } from '../error/helpers';

import * as tendermintNdid from '../tendermint/ndid';
import * as utils from '../utils';
import { callbackToClient } from '../utils/callback';
import * as common from './common';
import * as config from '../config';
import * as db from '../db';
import {
  accessorSign,
  isAccessorSignUrlSet,
  notifyCreateIdentityResultByCallback,
} from './idp';
import {
  getRequestMessageForCreatingIdentity,
  getRequestMessageForAddingAccessor,
} from '../utils/request_message';

export async function checkAssociated({ namespace, identifier }) {
  let idpList = await tendermintNdid.getIdpNodes({
    namespace,
    identifier,
    min_aal: 1,
    min_ial: 1.1,
  });
  for (let i = 0; i < idpList.length; i++) {
    if (idpList[i].node_id === config.nodeId) return true;
  }
  return false;
}

export async function addAccessorMethodForAssociatedIdp(
  {
    reference_id,
    callback_url,
    namespace,
    identifier,
    accessor_type,
    accessor_public_key,
    accessor_id,
  },
  { synchronous = false, apiVersion } = {}
) {
  const associated = await checkAssociated({
    namespace,
    identifier,
  });

  if (!associated) {
    throw new CustomError({
      message: errorType.IDENTITY_NOT_FOUND.message,
      code: errorType.IDENTITY_NOT_FOUND.code,
      clientError: true,
      details: {
        namespace,
        identifier,
      },
    });
  }

  const result = await createNewIdentity(
    {
      reference_id,
      callback_url,
      namespace,
      identifier,
      accessor_type,
      accessor_public_key,
      accessor_id,
      addAccessor: true,
    },
    { synchronous, apiVersion }
  );
  return result;
}

export async function addAccessorAfterConsent(request_id, old_accessor_id) {
  //NOTE: zero knowledge proof cannot be verify by blockchain, hence,
  //if this idp call to add their accessor it's imply that zk proof is verified by the
  logger.debug({
    message: 'Get consent, adding accessor...',
    request_id,
    old_accessor_id,
  });

  let accessor_group_id = await tendermintNdid.getAccessorGroupId(
    old_accessor_id
  );
  let {
    hash_id,
    ial,
    accessor_type,
    accessor_public_key,
    accessor_id,
    sid,
    associated,
    secret,
  } = await db.getIdentityFromRequestId(request_id);

  let promiseArray = [
    tendermintNdid.addAccessorMethod({
      request_id,
      accessor_group_id,
      accessor_type,
      accessor_id,
      accessor_public_key,
    }),
  ];

  //no ial means old idp add new accessor
  if (ial)
    promiseArray.push(
      tendermintNdid.registerMqDestination({
        users: [
          {
            hash_id,
            ial,
          },
        ],
      })
    );

  await Promise.all(promiseArray);
  db.removeIdentityFromRequestId(request_id);

  return {
    secret,
    associated,
  };
}

export async function isIdentityExist({ namespace, identifier, ial }) {
  const sid = namespace + ':' + identifier;
  const hash_id = utils.hash(sid);

  let exist = await tendermintNdid.checkExistingIdentity(hash_id);
  if (!exist) {
    try {
      await tendermintNdid.registerMqDestination({
        users: [
          {
            hash_id,
            ial,
            first: true,
          },
        ],
      });
    } catch (error) {
      if (
        error.getCode &&
        error.getCode() === errorType.ABCI_NOT_FIRST_IDP.code
      ) {
        logger.debug({
          message:
            'Unable to register message queue destination for an identity as the first IdP. Switching to ask for consent mode.',
          hash_id,
        });
        exist = true;
      } else {
        throw error;
      }
    }
  }
  return exist;
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

// FIXME: error handling in many cases
// when there is an error when transacting to blockchain
// it should not create a request, e.g.
// - duplicate accessor ID
export async function createNewIdentity(
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
      const exist = await isIdentityExist({ namespace, identifier, ial });
      createNewIdentityInternalAsync(...arguments, {
        request_id,
        associated,
        generated_accessor_id: accessor_id,
        exist,
        secret,
      });
      return { request_id, exist, accessor_id };
    } else {
      await db.setCallbackUrlByReferenceId(reference_id, callback_url);

      createNewIdentityInternalAsync(...arguments, {
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

async function createNewIdentityInternalAsync(
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
      exist = await isIdentityExist({ namespace, identifier, ial });
    }

    // TODO: Check for duplicate accessor

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

      await tendermintNdid.createIdentity({
        accessor_type,
        accessor_public_key,
        accessor_id,
        accessor_group_id,
      });

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

    throw error;
  }
}

export async function updateIal(
  { reference_id, callback_url, namespace, identifier, ial },
  { synchronous = false } = {}
) {
  try {
    //check onboard
    if (!checkAssociated({ namespace, identifier })) {
      throw new CustomError({
        message: errorType.IDENTITY_NOT_FOUND.message,
        code: errorType.IDENTITY_NOT_FOUND.code,
        clientError: true,
        details: {
          namespace,
          identifier,
        },
      });
    }

    //check max_ial
    ial = parseFloat(ial);
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

    if (synchronous) {
      await updateIalInternalAsync(...arguments);
    } else {
      updateIalInternalAsync(...arguments);
    }
  } catch (error) {
    const err = new CustomError({
      message: "Cannot update identity's IAL",
      cause: error,
    });
    logger.error(err.getInfoForLog());
    throw err;
  }
}

async function updateIalInternalAsync(
  { reference_id, callback_url, namespace, identifier, ial },
  { synchronous = false } = {}
) {
  try {
    const hash_id = utils.hash(namespace + ':' + identifier);
    await tendermintNdid.updateIal({ hash_id, ial });

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          type: 'update_ial_result',
          success: true,
          reference_id,
        },
        true
      );
    }
  } catch (error) {
    logger.error({
      message: "Update identity's IAL internal async error",
      originalArgs: arguments[0],
      options: arguments[1],
      additionalArgs: arguments[2],
      error,
    });

    if (!synchronous) {
      await callbackToClient(
        callback_url,
        {
          type: 'update_ial_result',
          success: false,
          reference_id,
          error: getErrorObjectForClient(error),
        },
        true
      );
    }

    throw error;
  }
}
