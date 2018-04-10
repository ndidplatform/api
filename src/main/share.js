import * as utils from './utils';

/*
  data = { requestId }
*/
export async function getRequest(data) {
  return await utils.queryChain('GetRequest',data);
}
