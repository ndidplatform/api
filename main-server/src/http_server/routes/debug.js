/**
 * Copyright (c) 2018, 2019 National Digital ID COMPANY LIMITED
 *
 * This file is part of NDID software.
 *
 * NDID is the free software: you can redistribute it and/or modify it under
 * the terms of the Affero GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or any later
 * version.
 *
 * NDID is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the Affero GNU General Public License for more details.
 *
 * You should have received a copy of the Affero GNU General Public License
 * along with the NDID source code. If not, see https://www.gnu.org/licenses/agpl.txt.
 *
 * Please contact info@ndid.co.th for any further questions
 *
 */

import express from 'express';
import { debug } from '../../core';

const router = express.Router();

router.post('/tmQuery/:fnName', async (req, res) => {
  try {
    res.status(200).json(
      await debug.tmQuery({
        fnName: req.params.fnName,
        jsonParameter: req.body,
      })
    );
  } catch (error) {
    res.status(500).send(error);
  }
});

router.post('/tmTransact/:fnName', async (req, res) => {
  let {
    debug_callbackUrl,
    debug_useMasterKey,
    debug_sync,
    nodeId,
    ...jsonParameter
  } = req.body;
  try {
    let sync = debug_sync || !debug_callbackUrl;
    let result = await debug.tmTransact({
      nodeId,
      fnName: req.params.fnName,
      jsonParameter,
      callbackUrl: debug_callbackUrl,
      useMasterKey: debug_useMasterKey,
      sync: debug_sync,
    });
    res.status(sync ? 200 : 204).json(result);
  } catch (error) {
    res.status(500).send(error);
  }
});

export default router;
