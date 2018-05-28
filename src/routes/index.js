import express from 'express';

import errorCode from '../error/code';
import errorMessage from '../error/message';

import logger from '../logger';

import errorHandler from './middleware/errorHandler';
import rpRouter from './rp';
import idpRouter from './idp';
import asRouter from './as';
import identityRouter from './identity';
import utilityRouter from './utility';
import dpkiRouter from './dpki';
import ndidRouter from './ndid';
import * as tendermint from '../tendermint/ndid';

import * as config from '../config';

const router = express.Router();

const env = process.env.NODE_ENV || 'development';

// FOR DEBUG
if (env === 'development') {
  router.use((req, res, next) => {
    if (req.method === 'POST') {
      const { method, originalUrl, params, body } = req;
      logger.debug({
        message: 'Incoming HTTP',
        method,
        originalUrl,
        params,
        body,
      });
    }
    if (req.method === 'GET') {
      const { method, originalUrl, params, query } = req;
      logger.debug({
        message: 'Incoming HTTP',
        method,
        originalUrl,
        params,
        query,
      });
    }
    next();
  });
}

router.use((req, res, next) => {
  // Reject all requests when tendermint is not yet ready.
  // This includes when tendermint is syncing (happens when starting a new node or resuming tendermint)

  if (tendermint.connected !== true) {
    res.status(503).json({
      error: {
        message: errorMessage.TENDERMINT_NOT_CONNECTED,
        code: errorCode.TENDERMINT_NOT_CONNECTED,
      },
    });
    return;
  }

  if (tendermint.syncing == null || tendermint.syncing === true) {
    res.status(503).json({
      error: {
        message: errorMessage.TENDERMINT_SYNCING,
        code: errorCode.TENDERMINT_SYNCING,
      },
    });
    return;
  }
  next();
});

if (config.role === 'rp') {
  router.use('/rp', rpRouter);
} else if (config.role === 'idp') {
  router.use('/idp', idpRouter);
} else if (config.role === 'as') {
  router.use('/as', asRouter);
} else if (config.role === 'ndid') {
  router.use('/ndid', ndidRouter);
}
router.use('/identity', identityRouter);
router.use('/utility', utilityRouter);
router.use('/dpki', dpkiRouter);

router.use(errorHandler);

// All other paths besides stated above are invalid
router.get('*', function(req, res) {
  res.status(404).end();
});

export default router;
