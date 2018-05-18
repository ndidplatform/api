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
      accessor_key,
      accessor_id,
    } = data;

    //TODO
    //check if this call is valid

    //register node id, which is substituted with ip,port for demo
    //let node_id = config.mqRegister.ip + ':' + config.mqRegister.port;
    registerMqDestination({
      users: [
        {
          hash_id: utils.hash(namespace + ':' + identifier),
          //TODO
          //where to get this value?, is it tie to IDP or tie to each identity??
          ial: 3,
        },
      ],
      node_id: config.nodeId,
    });
    return true;
  } catch (error) {
    logger.error({
      message: 'Cannot create new identity',
      error,
    });
    return false;
  }
}

export async function registerMqDestination(data) {
  let result = await tendermint.transact(
    'RegisterMsqDestination',
    data,
    utils.getNonce()
  );
  return result;
}
