import express from 'express';

const router = express.Router();

router.post('/service/:service_id', async (req, res, next) => {
  try {
    const { service_id, service_name, min_ial, min_aal, url } = req.body;

    // Not Implemented
    // TODO

    res.status(501).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.get('/service/:service_id', async (req, res, next) => {
  try {
    const { service_id } = req.params;

    // Not Implemented
    // TODO

    res.status(501).end();
  } catch (error) {
    res.status(500).end();
  }
});

export default router;
