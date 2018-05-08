export const serverPort = process.env.SERVER_PORT || 8080;
export const role = process.env.ROLE;
export const mqRegister = {
  ip: process.env.MQ_CONTACT_IP || 'localhost',
  port: process.env.MQ_BINDING_PORT || 5555,
};
export const asID = process.env.AS_ID || null;

export const DEFAULT_TENDERMENT_PORT = (() => {
  if (process.env.ROLE === 'rp') return '45000';
  if (process.env.ROLE === 'idp') return '45001';
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
