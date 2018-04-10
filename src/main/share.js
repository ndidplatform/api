import utils from './utils';

export async function getRequest(input) {
  return await utils.queryChain('GetRequest',input);
}
