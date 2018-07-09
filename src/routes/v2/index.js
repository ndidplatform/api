import express from 'express';

import rpRouter from './rp';
import idpRouter from './idp';
import asRouter from './as';
import identityRouter from './identity';
import utilityRouter from './utility';
import dpkiRouter from './dpki';

import * as config from '../../config';

const router = express.Router();

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

export default router;