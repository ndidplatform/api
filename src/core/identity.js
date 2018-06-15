import logger from '../logger';

import CustomError from '../error/customError';
import errorType from '../error/type';

import * as tendermint from '../tendermint/ndid';
import * as utils from '../utils';
import * as config from '../config';
import * as common from './common';
import * as db from '../db';
import { accessorSign, isAccessorSignUrlSet, notifyByCallback } from './idp';

export async function checkAssociated({namespace, identifier}) {
  let idpList = await common.getIdpNodes({
    namespace,
    identifier,
    min_aal: 1,
    min_ial: 1.1,
  });
  for(let i = 0 ; i < idpList.length ; i++) {
    if(idpList[i].id === config.nodeId) return true;
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
  if (!associated) return null;
  
  const { request_id } = await createNewIdentity({
    namespace,
    identifier,
    reference_id,
    accessor_type,
    accessor_public_key,
    accessor_id,
  });
  return request_id;
}

export async function addAccessorAfterConsent(request_id, old_accessor_id) {
  //NOTE: zero knowledge proof cannot be verify by blockchain, hence, 
  //if this idp call to add their accessor it's imply that zk proof is verified by the
  logger.debug({
    message: 'Get consent, adding accessor...',
    request_id,
    old_accessor_id,
  });

  let accessor_group_id = await common.getAccessorGroupId(old_accessor_id);
  let { 
    hash_id, 
    ial, 
    accessor_type, 
    accessor_public_key,
    accessor_id,
    sid,  
  } = await db.getIdentityFromRequestId(request_id);
  
  let promiseArray = [
    tendermint.transact('AddAccessorMethod',{
      request_id,
      accessor_group_id,
      accessor_type,
      accessor_id,
      accessor_public_key,
    }, utils.getNonce()),
  ];

  //no ial means old idp add new accessor
  if(ial) promiseArray.push(
    registerMqDestination({
      users: [
        {
          hash_id,
          ial,
        },
      ],
      node_id: config.nodeId,
    })
  );

  await Promise.all(promiseArray);
  db.removeIdentityFromRequestId(request_id);

  let encryptedHash = await accessorSign(sid, hash_id, accessor_id);
  let padding = utils.extractPaddingFromPrivateEncrypt(encryptedHash, accessor_public_key);
  let secret = padding + '|' + encryptedHash;
  return secret;
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
      accessor_id,
      ial,
    } = data;

    const namespaceDetails = await common.getNamespaceList();
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

    let sid = namespace + ':' + identifier;
    let hash_id = utils.hash(sid);

    let { exist } = await tendermint.query('CheckExistingIdentity', {
      hash_id,
    });

    let request_id = await db.getRequestIdByReferenceId(reference_id);
    if(request_id) {
      return { request_id, exist };
    }

    if (!isAccessorSignUrlSet()) {
      throw new CustomError({
        message: errorType.SIGN_WITH_ACCESSOR_KEY_URL_NOT_SET.message,
        code: errorType.SIGN_WITH_ACCESSOR_KEY_URL_NOT_SET.code,
      });
    }

    request_id = await common.createRequest({
      namespace,
      identifier,
      reference_id,
      idp_list: [],
      callback_url: null,
      data_request_list: [],
      request_message: ial 
        ? 'Request for consent to add another IDP' 
        : 'Request for consent to add another key from IDP: ' + config.nodeId, //Must lock?
      min_ial: 1.1,
      min_aal: 1,
      min_idp: exist ? 1 : 0,
      request_timeout: 86400,
    });

    db.setRequestIdByReferenceId(reference_id, request_id);
  
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
      });
    }
    else {
      let accessor_group_id = utils.randomBase64Bytes(32);
      
      //await Promise.all([
      Promise.all([
        tendermint.transact('CreateIdentity',{
          accessor_type,
          accessor_public_key,
          accessor_id,
          accessor_group_id
        }, utils.getNonce()),

        registerMqDestination({
          users: [
            {
              hash_id,
              ial,
            },
          ],
          node_id: config.nodeId,
        })
      ]).then(async () => {

        let encryptedHash = await accessorSign(sid, hash_id, accessor_id);
        let padding = utils.extractPaddingFromPrivateEncrypt(encryptedHash, accessor_public_key);
        let secret = padding + '|' + encryptedHash; 
        notifyByCallback({
          type: 'onboard_request',
          request_id: request_id,
          success: true,
          secret,
        });
        db.removeRequestIdByReferenceId(reference_id);

      });
    }
    return { request_id, exist, /*secret*/ };
  } 
  catch (error) {
    logger.error({
      message: 'Cannot create new identity',
      error,
    });
    throw error;
  }
}

export async function registerMqDestination(data) {
  const result = await tendermint.transact(
    'RegisterMsqDestination',
    data,
    utils.getNonce()
  );
  return result;
}
