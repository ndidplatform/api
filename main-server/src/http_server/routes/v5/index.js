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

import ndidRouter from './ndid';
import rpRouter from './rp';
import idpRouter from './idp';
import asRouter from './as';
import proxyRouter from './proxy';
import identityRouter from './identity';
import identityRequestRouter from './identity_request';
import utilityRouter from './utility';
import nodeRouter from './node';

const router = express.Router();

router.use('/ndid', ndidRouter);
router.use('/rp', rpRouter);
router.use('/idp', idpRouter);
router.use('/as', asRouter);
router.use('/proxy', proxyRouter);
router.use('/identity', identityRouter);
router.use('/identity_request', identityRequestRouter);
router.use('/utility', utilityRouter);
router.use('/node', nodeRouter);

export default router;
