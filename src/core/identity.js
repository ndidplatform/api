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
      ial,
    } = data;

    //TODO
    //check if this call is valid

    //register node id, which is substituted with ip,port for demo
    //let node_id = config.mqRegister.ip + ':' + config.mqRegister.port;
    await registerMqDestination({
      users: [
        {
          hash_id: utils.hash(namespace + ':' + identifier),
          ial,
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
