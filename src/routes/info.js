import * as tendermintNdid from '../tendermint/ndid';
import * as config from '../config';

let nodeInfo;

export default async function getInfo(req, res, next) {
  res.status(200).json({
    env: config.env,
    version: null, // FIXME: read from file?
    apiVersion: '1.0',
    nodeId: config.nodeId,
    nodeName: nodeInfo != null ? nodeInfo.node_name : undefined,
    nodePublicKey: nodeInfo != null ? nodeInfo.public_key : undefined,
    role: config.role,
    serverListenPort: config.serverPort,
    messageQueueIp: config.mqRegister.ip,
    messageQueuePort: config.mqRegister.port,
    tendermintAddress: config.tendermintAddress,
  });
}

async function getInfoFromBlockchain() {
  nodeInfo = await tendermintNdid.getNodeInfo(config.nodeId);
}

getInfoFromBlockchain();
