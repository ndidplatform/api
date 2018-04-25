import express from 'express';
import rpRouter from './relyingParty';
import idpRouter from './identityProvider';
import asRouter from './authoritativeSource';
import identityRouter from './identity';
import utilityRouter from './utility';
import dpkiRouter from './dpki';
import p2pRouter from './p2p';

import * as config from '../config';

const router = express.Router();

const env = process.env.NODE_ENV || 'development';

// FOR DEBUG
// if (env === 'development') {
//   router.use((req, res, next) => {
//     if (req.method === 'POST') {
//       console.log(req.method, req.originalUrl, req.params, req.body);
//     }
//     if (req.method === 'GET') {
//       console.log(req.method, req.originalUrl, req.params, req.query);
//     }
//     next();
//   });
// }

if (config.role === 'rp') {
  router.use('/rp', rpRouter);
} else if (config.role === 'idp') {
  router.use('/idp', idpRouter);
} else if (config.role === 'as') {
  router.use('/as', asRouter);
}
router.use('/identity', identityRouter);
router.use('/utility', utilityRouter);
router.use('/dpki', dpkiRouter);
router.use('/p2p', p2pRouter);

// All other paths besides stated above are invalid
router.get('*', function(req, res) {
  res.status(404).end();
});

export default router;
