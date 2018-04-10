import http from 'http';
import express from 'express';
import fetch from 'node-fetch';

import config from './config';

let blockchainMock = {
  request: {},
  msqDestination: {
    cid: {
      '1234567890123': []
    }
  }
};

function querySuccess(data) {
  return JSON.stringify({
    result: {
      response: {
        value: Buffer.from(JSON.stringify(data)).toString('base64')
      }
    }
  })
}

function updateSuccess() {
  return JSON.stringify({
    result: {
      deliver_tx: {
        log: 'success'
      }
    }
  })
}

async function CreateRequest(data) {
  let { requestId, messageHash, minIdp } = data;
  if(blockchainMock.request[requestId]) throw 'Duplicate';
  blockchainMock.request[requestId] = {
    status: 'pending'
  }
  return updateSuccess();
}

async function GetMsqDestination(data) {
  let { namespace, sid } = data;
  try {
    return querySuccess(blockchainMock.msqDestination[namespace][sid]);
  }
  catch(error) {
    return querySuccess([]);
  }
}

async function GetRequest(data) {
  if(!blockchainMock.request[data.requestId]) throw 'NotExist';
  return querySuccess(blockchainMock.request[data.requestId]);
}

async function CreateIdpResponse(data) {
  let { requestId, status, signature } = data;
  if(!blockchainMock.request[requestId]) throw 'NotExist';
  blockchainMock.request[requestId].status = (
    (status === 'accept') ? 'complete' : 'reject'
  );
  if(process.env.RP_CALLBACK_URI) {
    fetch(process.env.RP_CALLBACK_URI, {method: 'POST', body: { requestId }});
  }
  return updateSuccess();
}

async function RegisterMsqDestination(data) {
  let { users, ip, port } = data;
  users.forEach(function(user) {
    let { namespace, sid } = user;
    if(!blockchainMock.msqDestination[namespace])
      blockchainMock.msqDestination[namespace] = {};

    if(!blockchainMock.msqDestination[namespace][sid])
      blockchainMock.msqDestination[namespace][sid] = [];

    let destination = blockchainMock.msqDestination[namespace][sid];

    let check = destination.map(dest => dest.ip === ip && dest.port === port);
    let alreadyIn = check.reduce((accum,current) => {
      accum || current
    },false);

    if(!alreadyIn) destination.push({ ip, port });
  });
  return updateSuccess();
}

async function handle(decodedString, res) {
  let [ fnName, data, nonce ] = decodedString.split('|');
  console.log(fnName, data, nonce);
  try {
    res.status(200).send( await (fnList[fnName](JSON.parse(data))) );
  }
  catch(error) {
    console.error(error)
    res.status(500).send();
  }
}

var fnList = {
  CreateRequest,
  GetMsqDestination,
  GetRequest,
  CreateIdpResponse,
  RegisterMsqDestination
}

const app = express();

app.get('/broadcast_tx_commit',(req,res) => {
  let decode = Buffer.from(req.query.tx, 'base64').toString();
  handle(decode, res);
});

app.get('/abci_query',(req,res) => {
  let decode = Buffer.from(req.query.data, 'base64').toString();
  handle(decode, res);
});

const server = http.createServer(app);
server.listen(config.serverPort);
console.log('Stub ready at port',config.serverPort);