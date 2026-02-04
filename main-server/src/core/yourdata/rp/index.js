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

import * as cacheDb from '../../../db/cache';

export * from './create_request';
export * from './as_data';
export * from './timeout_request';
export * from './message_handlers';

export async function cleanupRequestCacheData({
  nodeId,
  requestId,
  referenceId,
}) {
  await Promise.all([
    cacheDb.removeYourDataRequestData(nodeId, requestId),
    cacheDb.removeYourDataCurrentRequestStatus(nodeId, requestId),
    cacheDb.removeRequestIdByReferenceId(nodeId, referenceId),
  ]);
}
