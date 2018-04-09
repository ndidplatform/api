import utils from './utils';

async function getRequest(input) {
  return await utils.queryChain('RetRequest',input);
}

export default {
  getRequest
}