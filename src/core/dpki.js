import * as tendermintNdid from '../tendermint/ndid';

export async function updateNode({ public_key, master_public_key }) {
  return tendermintNdid.updateNode({ public_key, master_public_key });
}
