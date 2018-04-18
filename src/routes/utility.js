import express from 'express';

const router = express.Router();

router.get('/idp', async (req, res, next) => {
  try {
    const { min_ial, min_aal } = req.query;

    // Not Implemented
    // TODO

    res.status(501).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.get('/idp/:namespace/:identifier', async (req, res, next) => {
  try {
    const { namespace, identifier } = req.params;
    const { min_ial, min_aal } = req.query;

    // Not Implemented
    // TODO

    res.status(501).end();
  } catch (error) {
    res.status(500).end();
  }
});

export default router;
