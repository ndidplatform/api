import express from 'express';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const {
      namespace,
      identifier,
      secret,
      accessor_type,
      accessor_key,
      accessor_id,
    } = req.body;

    // Not Implemented
    // TODO

    res.status(501).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.get('/:namespace/:identifier', async (req, res, next) => {
  try {
    const { namespace, identifier } = req.params;

    // Not Implemented
    // TODO

    res.status(501).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.post('/:namespace/:identifier', async (req, res, next) => {
  try {
    const { namespace, identifier } = req.params;

    // Not Implemented
    // TODO

    res.status(501).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.get('/:namespace/:identifier/endorsement', async (req, res, next) => {
  try {
    const { namespace, identifier } = req.params;

    // Not Implemented
    // TODO

    res.status(501).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.post('/:namespace/:identifier/endorsement', async (req, res, next) => {
  try {
    const { namespace, identifier } = req.params;
    const { secret, accessor_type, accessor_key, accessor_id } = req.body;

    // Not Implemented
    // TODO

    res.status(501).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.post('/:namespace/:identifier/accessors', async (req, res, next) => {
  try {
    const { namespace, identifier } = req.params;
    const { accessor_type, accessor_key, accessor_id } = req.body;

    // Not Implemented
    // TODO

    res.status(501).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.get(
  '/:namespace/:identifier/requests/history',
  async (req, res, next) => {
    try {
      const { namespace, identifier } = req.params;
      const { count } = req.query;

      // Not Implemented
      // TODO

      res.status(501).end();
    } catch (error) {
      res.status(500).end();
    }
  }
);

export default router;
