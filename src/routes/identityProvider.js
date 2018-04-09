import express from 'express';

const router = express.Router();

router.get('/callback', async (req, res, next) => {
  try {
    // TO-DO

    res.status(200).send({});
  } catch (error) {
    res.status(500).end();
  }
});

router.post('/callback', async (req, res, next) => {
  try {
    const url = req.body;

    // TO-DO

    res.status(200).send({});
  } catch (error) {
    res.status(500).end();
  }
});

router.post('/response', async (req, res, next) => {
  try {
    const {
      status,
      request_id,
      namespace,
      identifier,
      // secret,
      // aal,
      // signature,
      // accessor_id,
    } = req.body;

    // TO-DO

    res.status(200).send({});
  } catch (error) {
    res.status(500).end();
  }
});

export default router;
