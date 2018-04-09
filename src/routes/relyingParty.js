import express from 'express';

const router = express.Router();

router.post('/requests/:namespace/:identifier', async (req, res, next) => {
  try {
    const { namespace, identifier } = req.params;

    // TO-DO

    res.status(200).send({});
  } catch (error) {
    res.status(500).end();
  }
});

router.get('/requests/:request_id', async (req, res, next) => {
  try {
    const { request_id } = req.params;

    // TO-DO

    res.status(200).send({});
  } catch (error) {
    res.status(500).end();
  }
});

router.get('/requests/reference/:reference_number', async (req, res, next) => {
  try {
    // Not Implemented
    // TO-DO

    res.status(501).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.get('/requests/data/:request_id', async (req, res, next) => {
  try {
    // Not Implemented
    // TO-DO

    res.status(501).end();
  } catch (error) {
    res.status(500).end();
  }
});

export default router;
