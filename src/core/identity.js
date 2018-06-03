import logger from '../logger';

import * as tendermint from '../tendermint/ndid';
import * as utils from '../utils';
import * as config from '../config';

export async function createNewIdentity(data) {
  try {
    const {
      namespace,
      identifier,
      //secret,
      accessor_type,
      accessor_public_key,
      accessor_id,
      accessor_group_id,
      ial,
    } = data;

    let hash_id = utils.hash(namespace + ':' + identifier);

    //TODO
    //check if this call is valid
    //call CheckExistingIdentity to tendermint
    let { exist } = await tendermint.query('CheckExistingIdentity', {
      hash_id,
    });
    if(exist) throw 'Already exist!';
    //not exist -> continue
    
    await Promise.all([
      tendermint.transact('CreateIdentity',{
        accessor_type,
        accessor_public_key,
        accessor_id,
        accessor_group_id
      }, utils.getNonce()),

      //register node id, which is substituted with ip,port for demo
      //let node_id = config.mqRegister.ip + ':' + config.mqRegister.port;
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
    return true;
  } catch (error) {
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
