import EventEmitter from 'events';
import zmq from 'zeromq';

const receivingSocket = zmq.socket('pull');
const sendingSocket = zmq.socket('push');

export const eventEmitter = new EventEmitter();

receivingSocket.on('message', function(jsonMessageStr){
  // TODO - Receiving Queue
  // In case of messages arrive before listener function is added

  const message = JSON.parse(jsonMessageStr);

  eventEmitter.emit('message', message);
});

export const send = (receivers, message) => {
  const jsonMessageStr = JSON.stringify(message);
  receivers.forEach(receiver => {
    sendingSocket.connect(`tcp://${receiver.ip}:${receiver.port}`);
    sendingSocket.send(jsonMessageStr);
    sendingSocket.disconnect(`tcp://${receiver.ip}:${receiver.port}`);
  });
};
