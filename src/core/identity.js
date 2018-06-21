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

import CustomError from '../error/customError';
import errorType from '../error/type';

import * as tendermintNdid from '../tendermint/ndid';
import * as utils from '../utils';
import * as common from './common';
import * as config from '../config';
import * as db from '../db';
import {
  accessorSign,
  isAccessorSignUrlSet,
  notifyCreateIdentityResultByCallback,
} from './idp';

export async function checkAssociated({namespace, identifier}) {
  let idpList = await tendermintNdid.getIdpNodes({
    namespace,
    identifier,
    min_aal: 1,
    min_ial: 1.1,
  });
  for(let i = 0 ; i < idpList.length ; i++) {
    if(idpList[i].node_id === config.nodeId) return true;
  }
  return false;
}

export async function addAccessorMethodForAssociatedIdp({
  namespace,
  identifier,
  reference_id,
  accessor_type,
  accessor_public_key,
  accessor_id,
}) {

  const associated = await checkAssociated({
    namespace,
    identifier,
  });

  if (!associated) {
    throw new CustomError({
      message: errorType.ABCI_NOT_ONBOARD.message,
      code: errorType.ABCI_NOT_ONBOARD.code,
      details: {
        namespace,
        identifier,
      },
    });
  }
  
  const result = await createNewIdentity({
    namespace,
    identifier,
    reference_id,
    accessor_type,
    accessor_public_key,
    accessor_id,
    addAccessor: true,
  });
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

  let accessor_group_id = await tendermintNdid.getAccessorGroupId(old_accessor_id);
  let { 
    hash_id, 
    ial, 
    accessor_type, 
    accessor_public_key,
    accessor_id,
    sid,
    associated,
  } = await db.getIdentityFromRequestId(request_id);
  
  let promiseArray = [
    tendermintNdid.addAccessorMethod({
      request_id,
      accessor_group_id,
      accessor_type,
      accessor_id,
      accessor_public_key,
    })
  ];

  //no ial means old idp add new accessor
  if(ial) promiseArray.push(
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

  let encryptedHash = await accessorSign(sid, hash_id, accessor_id);
  let padding = utils.extractPaddingFromPrivateEncrypt(encryptedHash, accessor_public_key);
  let secret = padding + '|' + encryptedHash;
  return {
    secret,
    associated,
  };
}

// FIXME: error handling in many cases
// when there is an error when transacting to blockchain
// it should not create a request, e.g.
// - duplicate accessor ID
export async function createNewIdentity(data) {
  try {
    const {
      namespace,
      identifier,
      reference_id,
      accessor_type,
      accessor_public_key,
      ial,
      addAccessor,
    } = data;

    const namespaceDetails = await tendermintNdid.getNamespaceList();
    const valid = namespaceDetails.find(
      (namespaceDetail) => namespaceDetail.namespace === namespace
    );
    if (!valid) {
      throw new CustomError({
        message: errorType.INVALID_NAMESPACE.message,
        code: errorType.INVALID_NAMESPACE.code,
        details: {
          namespace
        },
      });
    }

    let associated = await checkAssociated({
      namespace,
      identifier,
    });
    //already onboard this user
    if(!addAccessor && associated) {
      throw new CustomError({
        message: errorType.IDENTITY_ALREADY_CREATED.message,
        code: errorType.IDENTITY_ALREADY_CREATED.code,
        details: {
          namespace,
          identifier
        },
      });
    }

    let sid = namespace + ':' + identifier;
    let hash_id = utils.hash(sid);

    const exist = await tendermintNdid.checkExistingIdentity(hash_id);

    let onboardData = await db.getOnboardDataByReferenceId(reference_id);
    if(onboardData) {
      let { request_id, accessor_id } = onboardData;
      return { request_id, exist, accessor_id };
    }

    let accessor_id = data.accessor_id;
    if(!accessor_id) accessor_id = utils.randomBase64Bytes(32);

    if (!isAccessorSignUrlSet()) {
      throw new CustomError({
        message: errorType.SIGN_WITH_ACCESSOR_KEY_URL_NOT_SET.message,
        code: errorType.SIGN_WITH_ACCESSOR_KEY_URL_NOT_SET.code,
      });
    }

    // TODO: Check for duplicate accessor
    // TODO: Check for "ial" must be less than or equal than node's (IdP's) max_ial

    let request_id = await common.createRequest({
      namespace,
      identifier,
      reference_id,
      idp_id_list: [],
      callback_url: null,
      data_request_list: [],
      request_message: ial 
        ? 'Request for consent to add another IDP' 
        : 'Request for consent to add another key from IDP: ' + config.nodeId, //Must lock?
      min_ial: 1.1,
      min_aal: 1,
      min_idp: exist ? 1 : 0,
      request_timeout: 86400,
      mode: 3,
    });

    db.setOnboardDataByReferenceId(reference_id, { request_id, accessor_id });
  
    /*let encryptedHash = await accessorSign(sid, hash_id, accessor_id);
    let padding = utils.extractPaddingFromPrivateEncrypt(encryptedHash, accessor_public_key);
    let secret = padding + '|' + encryptedHash;
    
    logger.debug({
      message: 'encryptedHash from accessor callback',
      encryptedHash,
      padding,
      secret,
      hash_id,
      accessor_id,
    });*/

    if(exist) {
      //save data for add accessor to persistent
      db.setIdentityFromRequestId(request_id, {
        accessor_type,
        accessor_id,
        accessor_public_key,
        hash_id,
        ial,
        sid,
        associated,
      });
    }
    else {
      let accessor_group_id = utils.randomBase64Bytes(32);
      
      //await Promise.all([
      Promise.all([
        tendermintNdid.createIdentity({
          accessor_type,
          accessor_public_key,
          accessor_id,
          accessor_group_id
        }),
        tendermintNdid.registerMqDestination({
          users: [
            {
              hash_id,
              ial,
            },
          ],
        })
      ]).then(async () => {

        let encryptedHash = await accessorSign(sid, hash_id, accessor_id);
        let padding = utils.extractPaddingFromPrivateEncrypt(encryptedHash, accessor_public_key);
        let secret = padding + '|' + encryptedHash; 
        notifyCreateIdentityResultByCallback({
          request_id: request_id,
          success: true,
          secret,
        });
        db.removeOnboardDataByReferenceId(reference_id);

      });
    }
    //console.log('--->',{ request_id, exist, /*secret*/ accessor_id });
    return { request_id, exist, /*secret*/ accessor_id };
  } 
  catch (error) {
    logger.error({
      message: 'Cannot create new identity',
      error,
    });
    throw error;
  }
}
