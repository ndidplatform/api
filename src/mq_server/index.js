import path from 'path';

import grpc from 'grpc';
import * as protoLoader from '@grpc/proto-loader';

import MQSend from '../mq/mq_send_controller';
import MQRecv from '../mq/mq_recv_controller';

import logger from '../logger';

import * as config from '../config';

let mqSend;
let mqRecv;

const acks = {};

// Load protobuf
const packageDefinition = protoLoader.loadSync(
  path.join(__dirname, '..', 'protos', 'message_queue.proto'),
  {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  }
);
const proto = grpc.loadPackageDefinition(packageDefinition);

const server = new grpc.Server();
const SERVER_ADDRESS = '0.0.0.0:5001';

let recvSubscriberConnections = [];
let sendCalls = {};

// Recv
function subscribeToRecvMessages(call, callback) {
  recvSubscriberConnections.push(call);
  callback(null);
}

function sendAckForRecvMessage(call, callback) {
  const { message_id: msgId } = call.request;
  if (acks[msgId]) {
    acks[msgId]();
  }
  // TODO: sending ACK should have an error if msgId does not exist
  callback(null);
}

function onRecvMessage({ message, msgId, senderId }) {
  recvSubscriberConnections.forEach((connection) => {
    connection.write({ message, message_id: msgId, sender_id: senderId });
  });
}

function onRecvError({ error }) {
  recvSubscriberConnections.forEach((connection) => {
    connection.write({ error });
  });
}

// Send
function sendMessage(call, callback) {
  const { mq_address: mqAddress, payload, call_id: callId } = call.request;
  const { ip, port } = mqAddress;

  sendCalls[callId] = call;

  mqSend.send({ ip, port }, payload);
  callback(null);
}

function initialize() {
  mqSend = new MQSend({ timeout: 60000, totalTimeout: 600000 });
  mqRecv = new MQRecv({ port: config.mqPort, maxMsgSize: 3300000 });

  mqRecv.on('message', async ({ message, msgId, senderId, sendAck }) => {
    // TODO: refactor MQRecv to accept ack with msgId as a parameter
    // to eliminate functino caching
    acks[msgId] = sendAck;
    onRecvMessage({ message, msgId, senderId });
  });

  //should tell client via error callback?
  mqSend.on('error', (error) => {
    logger.error(error.getInfoForLog());
    // TODO: get msgId from send controller and send error back to client
  });
  // TODO: sender should have closed event after sending socket is closed and cleaned up
  // mqSend.on('closed', () => {
  //   // TODO: send event back to client
  // });

  mqRecv.on('error', (error) => {
    logger.error(error.getInfoForLog());
    onRecvError({ error: { code: error.code, message: error.message } });
  });

  logger.info({
    message: 'Message queue initialized',
  });

  // Define server with the methods and start it
  server.addService(proto.MessageQueue.service, {
    subscribeToRecvMessages,
    sendAckForRecvMessage,
    sendMessage,
  });

  server.bind(SERVER_ADDRESS, grpc.ServerCredentials.createInsecure());

  server.start();

  logger.info({
    message: 'Server initialized',
  });
}

function shutDown() {
  server.tryShutdown(() => {
    logger.info({
      message: 'Shutdown gracefully',
    });
  });
}

process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

initialize();
