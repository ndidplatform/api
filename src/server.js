import 'source-map-support/register';

import http from 'http';
import * as config from './config';

import bodyParser from 'body-parser';

import express from 'express';
import morgan from 'morgan';
import routes from './routes';

import fs from 'fs';
import registerMsqDestination from './main/idp'

process.on('unhandledRejection', function(reason, p) {
  console.error('Unhandled Rejection:', p, '\nreason:', reason.stack || reason);
});

const env = process.env.NODE_ENV || 'development';

const app = express();

app.use(bodyParser.urlencoded({ extended: false, limit: '2mb' }));
app.use(bodyParser.json({ limit: '2mb' }));

app.use(morgan('combined'));
// app.use(morgan('dev'));

app.use(routes);

const server = http.createServer(app);
server.listen(config.serverPort);

console.log(`Server listening on port ${config.serverPort}`);

if(config.isIdp) {
  //TODO register as IDP of some users
  let userList = JSON.parse(
    fs.readFileSync(process.env.ASSOC_USERS,'utf8').toString()
  );
  registerMsqDestination({
    users: userList,
    ip: config.msqRegister.ip,
    port: config.msqRegister.port
  });
}

// For testing
module.exports = server;