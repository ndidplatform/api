/*
Copyright (c) 2018, 2019 National Digital ID COMPANY LIMITED 

This file is part of NDID software.

NDID is the free software: you can redistribute it and/or modify  it under the terms of the Affero GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or any later version.

NDID is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the Affero GNU General Public License for more details.

You should have received a copy of the Affero GNU General Public License along with the NDID source code.  If not, see https://www.gnu.org/licenses/agpl.txt.

please contact info@ndid.co.th for any further questions
*/
import express from 'express';

import { validateBody } from './middleware/validation';
import * as ndid from '../core/ndid';

const router = express.Router();

router.post('/initNDID', async (req, res, next) => {
  try {
    await ndid.initNDID(req.body.public_key);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/registerNode', async (req, res, next) => {
  try {
    const {
      node_id,
      public_key,
      master_public_key,
      role,
      max_aal,
      max_ial,
    } = req.body;

    await ndid.registerNode({
      node_id,
      public_key,
      master_public_key,
      role,
      max_aal,
      max_ial,
    });

    res.status(201).end();
  } catch (error) {
    next(error);
  }
});

router.post('/setNodeToken', async (req, res, next) => {
  try {
    const { node_id, amount } = req.body;

    await ndid.setNodeToken({
      node_id,
      amount,
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/addNodeToken', async (req, res, next) => {
  try {
    const { node_id, amount } = req.body;

    await ndid.addNodeToken({
      node_id,
      amount,
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/reduceNodeToken', async (req, res, next) => {
  try {
    const { node_id, amount } = req.body;

    await ndid.reduceNodeToken({
      node_id,
      amount,
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/namespaces', async (req, res, next) => {
  try {
    const { namespace, description } = req.body;

    await ndid.addNamespace({
      namespace,
      description,
    });
    res.status(201).end();
  } catch (error) {
    next(error);
  }
});

router.delete('/namespaces/:namespace', async (req, res, next) => {
  try {
    const { namespace } = req.params;

    await ndid.deleteNamespace({
      namespace,
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/services', async (req, res, next) => {
  try {
    const { service_id, service_name } = req.body;

    await ndid.addService({
      service_id,
      service_name,
    });
    res.status(201).end();
  } catch (error) {
    next(error);
  }
});

router.delete('/services/:service_id', async (req, res, next) => {
  try {
    const { service_id } = req.params;

    await ndid.deleteService({
      service_id,
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
