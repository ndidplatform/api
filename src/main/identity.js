import logger from '../logger';

import * as tendermint from '../tendermint/ndid';
import * as utils from '../utils';
import * as config from '../config';

export async function createNewIdentity(data) {
  try {
    const {
      namespace,
      identifier,
      secret,
      accessor_type,
      accessor_public_key,
      accessor_id,
      ial
    } = data;

    //======================= TODO ========================================
    //check existing sid
    let {
      isExisted,
      generating_function,
      prime_modulo
    } = await tendermint.query('CheckExistingIdentity',{ hash_id });

    let hash_id = utils.hash(namespace + ':' + identifier);
    if(!isExisted) {
      //not exist, create new
      let { commitment, ...params } = utils.securelyGenerateParamsForZk({
        secret, 
        namespace, 
        identifier
      });
      generating_function = params.generating_function;
      prime_modulo = params.prime_modulo;

      await tendermint.transact('CreateIdentity',{
        hash_id,
        accessor_id,
        accessor_public_key,
        accessor_type,
        generating_function,
        prime_modulo,
        commitment,
      }, utils.getNonce());

      registerMqDestination({
        users: [
          {
            hash_id,
            ial,
          },
        ],
        node_id: config.nodeId,
      });

    }
    else {
      //existed, request for consent add accessor
      //create SPECIAL REQUEST for onboarding and wait for event when consent is given
      createSpecialRequest(...);
      //store that special request id to persistent map to all data 
      //(secret, g, p, sid, ial, accessor_id, accessor_public_key, accessor_type)
      storeToPersistent(...);
    }
    //=====================================================================

    return true;
  } catch (error) {
    logger.error({
      message: 'Cannot create new identity',
      error,
    });
    return false;
  }
}

export async function addAccessorMethod(specialRequestId) {

  const {
    secret,
    namespace,
    identifier,
    generating_function,
    prime_modulo, 
    ial,
    accessor_id,
    accessor_public_key,
    accessor_type
  } = getFromPersistent(specialRequestId);

  let hash_id = utils.hash(namespace + ':' + identifier);

  let { commitment } = utils.securelyGenerateParamsForZk({
    secret,
    namespace,
    identifier,
    generating_function,
    prime_modulo,
  });

  await tendermint.transact('AddAccessorMethod', {
    hash_id,
    accessor_id,
    accessor_public_key,
    accessor_type,
    commitment
  }, utils.getNonce());

  registerMqDestination({
    users: [
      {
        hash_id,
        ial,
      },
    ],
    node_id: config.nodeId,
  });
}

export async function registerMqDestination(data) {
  let result = await tendermint.transact(
    'RegisterMsqDestination',
    data,
    utils.getNonce()
  );
  return result;
}
