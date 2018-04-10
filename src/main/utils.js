import fetch from 'node-fetch';

var nonce = 1;
var logicUrl = process.env.NODE_LOGIC_ADDRESS || 'http://localhost:8000';

function getNonce() {
  return (nonce++).toString();
}

async function hash(stringToHash) {
  //to be implemented
  return 'Hash(' + stringToHash + ')';
}

function retrieveResult(obj,isQuery) {
  if(isQuery) {
    let result = Buffer.from(obj.result.response.value,'base64').toString();
    return JSON.parse(result);
  }
  else return obj.result.deliver_tx.log === 'success';
}

async function queryChain(fnName,data) {
  let encoded = Buffer.from(
    fnName + '|' + 
    JSON.stringify(data)
  ).toString('base64');
  
  let result = await fetch(logicUrl + '/abci_query?data=' + encoded);
  return retrieveResult(JSON.parse((await result.text())),true);
}

async function updateChain(fnName,data) {
  let encoded = Buffer.from(
    fnName + '|' + 
    JSON.stringify(data) + '|' + 
    getNonce()
  ).toString('base64');

  let result = await fetch(logicUrl + '/broadcast_tx_commit?tx=' + encoded);
  return retrieveResult(JSON.parse((await result.text())));
}

export default {
  hash,queryChain,updateChain
}