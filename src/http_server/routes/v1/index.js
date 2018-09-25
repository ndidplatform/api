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

import rpRouter from './rp';
import idpRouter from './idp';
import asRouter from './as';
import identityRouter from './identity';
import utilityRouter from './utility';
import dpkiRouter from './dpki';

const router = express.Router();

router.use('/rp', rpRouter);
router.use('/idp', idpRouter);
router.use('/as', asRouter);
router.use('/identity', identityRouter);
router.use('/utility', utilityRouter);
router.use('/dpki', dpkiRouter);

export default router;
