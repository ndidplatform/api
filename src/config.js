import path from 'path';

export const serverPort = process.env.SERVER_PORT || 8080;

export const LOG_DIRECTORY_PATH = process.env.LOG_DIRECTORY_PATH || __dirname;

export const role = process.env.ROLE;

export const DEFAULT_MQ_BINDING_PORT = (() => {
  if (process.env.ROLE === 'rp') return 5556;
  if (process.env.ROLE === 'as') return 5557;
  return 5555;
})();

export const DEFAULT_TENDERMENT_PORT = (() => {
  if (process.env.ROLE === 'idp' || process.env.ROLE === 'ndid') return '45000';
  if (process.env.ROLE === 'rp') return '45001';
  if (process.env.ROLE === 'as') return '45002';
})();

export const TENDERMINT_IP =
  process.env.TENDERMINT_IP == null ? 'localhost' : process.env.TENDERMINT_IP;

export const TENDERMINT_PORT =
  process.env.TENDERMINT_PORT == null
    ? DEFAULT_TENDERMENT_PORT
    : process.env.TENDERMINT_PORT;

export const TENDERMINT_ADDRESS = `${TENDERMINT_IP}:${TENDERMINT_PORT}`;

export const TENDERMINT_BASE_HTTP_URL = `http://${TENDERMINT_IP}:${TENDERMINT_PORT}`;

export const TENDERMINT_BASE_WS_URL = `ws://${TENDERMINT_IP}:${TENDERMINT_PORT}`;

export const nodeId = process.env.NODE_ID || (role + '1').toLowerCase();

export const asID = 
  role === 'as'
    ? process.env.AS_ID || nodeId 
    : null;
    
export const mqRegister = {
  ip: process.env.MQ_CONTACT_IP || 'localhost',
  port: (process.env.MQ_BINDING_PORT == null 
    ? DEFAULT_MQ_BINDING_PORT 
    : parseInt(process.env.MQ_BINDING_PORT)),
};

export const PRIVATE_KEY_PATH = 
  process.env.PRIVATE_KEY_PATH == null
  ? path.join(__dirname, '..', 'devKey', role, nodeId)
  : process.env.PRIVATE_KEY_PATH;