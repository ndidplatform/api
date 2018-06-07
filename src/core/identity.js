import logger from '../logger';

import * as tendermint from '../tendermint/ndid';
import * as utils from '../utils';
import * as config from '../config';
import * as common from './common';
import * as db from '../db';
import { accessorSign } from './idp';

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

  let associated = await checkAssociated({
    namespace,
    identifier,
  });
  if(!associated) return { associated };
  
  let { request_id } = await createNewIdentity({
    namespace,
    identifier,
    reference_id,
    accessor_type,
    accessor_public_key,
    accessor_id,
  });
  return { request_id, associated };
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
}

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

    let hash_id = utils.hash(namespace + ':' + identifier);

    //call CheckExistingIdentity to tendermint
    let { exist } = await tendermint.query('CheckExistingIdentity', {
      hash_id,
    });

    let request_id = await db.getRequestIdByReferenceId(reference_id);
    if(request_id) {
      return { request_id, exist };
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
    let secret = await accessorSign(hash_id, accessor_id);
    
    logger.debug({
      message: 'secret from accessor callback',
      secret,
      hash_id,
      accessor_id,
    });

    if(exist) {
      //save data for add accessor to persistent
      db.setIdentityFromRequestId(request_id, {
        accessor_type,
        accessor_id,
        accessor_public_key,
        hash_id,
        ial,
      });
    }
    else {
      let accessor_group_id = utils.randomBase64Bytes(32);
      
      await Promise.all([
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
      ]);
    }
    return { request_id, exist, secret };
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
