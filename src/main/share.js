import utils from './utils';

async function getRequest(input) {
  return await utils.queryChain('GetRequest',input);
}

export default {
  getRequest
}