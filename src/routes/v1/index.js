import express from 'express';

import rpRouter from './rp';
import idpRouter from './idp';
import asRouter from './as';
import identityRouter from './identity';
import utilityRouter from './utility';
import dpkiRouter from './dpki';

const router = express.Router();

router.use('/rp', rpRouter);
router.use('/idp', idpRouter);
router.use('/as', asRouter);
router.use('/identity', identityRouter);
router.use('/utility', utilityRouter);
router.use('/dpki', dpkiRouter);

export default router;
