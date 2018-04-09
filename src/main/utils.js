import fetch from 'node-fetch';

var nonce = 1;
var logicUrl = process.env.NODE_LOGIC_ADDRESS || 'http://localhost:8000';

function getNonce() {
  return (nonce++).toString();
}

async function hash(stringToHash) {
  //to be implemented
  return stringToHash;
}

async function queryChain(fnName,data) {
  let encoded = Buffer.from(
    fnName + '|' + 
    JSON.stringify(data)
  ).toString('base64');
  
  let result = await fetch(logicUrl + '/abci_query?data=' + encoded);
  return JSON.parse((await result.text()));
}

async function updateChain(fnName,data) {
  let encoded = Buffer.from(
    fnName + '|' + 
    JSON.stringify(data) + '|' + 
    getNonce()
  ).toString('base64');

  let result = await fetch(logicUrl + '/broadcast_tx_commit?tx=' + encoded);
  return JSON.parse((await result.text()));
}

export default {
  hash,queryChain,updateChain
}