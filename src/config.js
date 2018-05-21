import path from 'path';

// TODO: env var (config) validation

export const serverPort = process.env.SERVER_PORT || 8080;

export const logDirectoryPath = process.env.LOG_DIRECTORY_PATH || __dirname;

export const role = process.env.ROLE;

export const defaultMqBindingPort = (() => {
  if (process.env.ROLE === 'rp') return 5556;
  if (process.env.ROLE === 'as') return 5557;
  return 5555;
})();

export const defaultTendermintPort = (() => {
  if (process.env.ROLE === 'idp' || process.env.ROLE === 'ndid') return '45000';
  if (process.env.ROLE === 'rp') return '45001';
  if (process.env.ROLE === 'as') return '45002';
})();

export const tendermintIp =
  process.env.TENDERMINT_IP == null ? 'localhost' : process.env.TENDERMINT_IP;

export const tendermintPort =
  process.env.TENDERMINT_PORT == null
    ? defaultTendermintPort
    : process.env.TENDERMINT_PORT;

export const tendermintAddress = `${tendermintIp}:${tendermintPort}`;

export const tendermintBaseHttpUrl = `http://${tendermintIp}:${tendermintPort}`;

export const tendermintBaseWsUrl = `ws://${tendermintIp}:${tendermintPort}`;

export const nodeId = process.env.NODE_ID || (role + '1').toLowerCase();

export const asID = role === 'as' ? process.env.AS_ID || nodeId : null;

export const mqRegister = {
  ip: process.env.MQ_CONTACT_IP || 'localhost',
  port:
    process.env.MQ_BINDING_PORT == null
      ? defaultMqBindingPort
      : parseInt(process.env.MQ_BINDING_PORT),
};

export const privateKeyPath =
  process.env.PRIVATE_KEY_PATH == null
    ? path.join(__dirname, '..', 'devKey', role, nodeId)
    : process.env.PRIVATE_KEY_PATH;
