import logger from '../logger';

import * as tendermint from '../tendermint/ndid';
import * as utils from '../utils';
import * as config from '../config';
import * as common from './common';
import * as db from '../db';

export async function addAccessorAfterConsent(request_id, old_accessor_id) {
  //NOTE: zero knowledge proof cannot be verify by blockchain, hence, 
  //if this idp call to add their accessor it's imply that zk proof is verified by the
  logger.debug({
    message: 'GET consent, adding accessor...',
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
  
  await Promise.all([
    tendermint.transact('AddAccessorMethod',{
      request_id,
      accessor_group_id,
      accessor_type,
      accessor_id,
      accessor_public_key,
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

export async function createNewIdentity(data) {
  try {
    const {
      namespace,
      identifier,
      //secret,
      accessor_type,
      accessor_public_key,
      accessor_id,
      //accessor_group_id,
      ial,
    } = data;

    let hash_id = utils.hash(namespace + ':' + identifier);

    //TODO
    //check if this call is valid
    //call CheckExistingIdentity to tendermint
    let { exist } = await tendermint.query('CheckExistingIdentity', {
      hash_id,
    });

    let reference_id = utils.randomBase64Bytes(16);
    let request_id = await common.createRequest({
      namespace,
      identifier,
      reference_id,
      idp_list: [],
      callback_url: null,
      data_request_list: [],
      request_message: 'Request for consent to add another IDP', //Must lock?
      min_ial: 1.1,
      min_aal: 1,
      min_idp: exist ? 1 : 0,
      request_timeout: 86400,
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
    return { request_id, exist };
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
