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
import * as debug from '../../core/debug';
import * as common from '../../core/common';
import * as rp from '../../core/rp';
import * as idp from '../../core/idp';
import * as as from '../../core/as';

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';

import * as config from '../../config';

const router = express.Router();

async function testErrorCallback(getErrorCallbackUrl) {
  const callbackUrl = await getErrorCallbackUrl();
  await common.notifyError({
    nodeId: config.nodeId,
    callbackUrl,
    action: 'mqService',
    error: new CustomError({
      errorType: errorType.TEST,
    }),
  });
}

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

router.get('/error_callback_test/rp', async (req, res) => {
  try {
    await testErrorCallback(rp.getErrorCallbackUrl);
    res.status(204).end();
  } catch (error) {
    res.status(500).send(error);
  }
});

router.get('/error_callback_test/idp', async (req, res) => {
  try {
    await testErrorCallback(idp.getErrorCallbackUrl);
    res.status(204).end();
  } catch (error) {
    res.status(500).send(error);
  }
});

router.get('/error_callback_test/as', async (req, res) => {
  try {
    await testErrorCallback(as.getErrorCallbackUrl);
    res.status(204).end();
  } catch (error) {
    res.status(500).send(error);
  }
});

export default router;
