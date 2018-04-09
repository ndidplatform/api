import express from 'express';
import rpRouter from './relyingParty';
import idpRouter from './identityProvider';
import asRouter from './authoritativeSource';

const router = express.Router();

const env = process.env.NODE_ENV || 'development';

// FOR DEBUG
if (env === 'development') {
  router.use((req, res, next) => {
    if (req.method === 'POST') {
      console.log(req.method, req.originalUrl, req.params, req.body);
    }
    if (req.method === 'GET') {
      console.log(req.method, req.originalUrl, req.params, req.query);
    }
    next();
  });
}

router.use('/rp', rpRouter);
router.use('/idp', idpRouter);
router.use('/as', asRouter);

// All other paths besides stated above are invalid
router.get('*', function(req, res) {
  res.status(404).end();
});

export default router;
