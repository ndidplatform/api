import express from 'express';
import * as p2p from '../libp2p';

const router = express.Router();

router.post('/dial2', async (req, res, next) => {
    try {
        console.log('call dial');
      var receivers = req.body;
      var a = {
          'name': 'piti',
          'age': 25
      }
      await p2p.send(receivers, JSON.stringify(a));  
      // Not Implemented
      // TODO
      console.log('send complete');
      res.status(200).end();
    } catch (error) {
        console.log(error);
      res.status(500).end();
    }
  });

export default router;

