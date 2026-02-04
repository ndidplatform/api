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

import RequestQueue from '../request_queue';

import logger from '../../logger';

const yourDataRequestQueue = new RequestQueue();

export function enqueue(nodeId, requestId, fn, ...args) {
  logger.debug({
    message: 'Adding task to YourData request queue',
    nodeId,
    requestId,
  });

  // queue task without waiting for task to start and finish
  yourDataRequestQueue.enqueue(requestId, fn, ...args);
}

async function waitForAllTasksToFinish() {
  logger.debug({
    message: 'Waiting for YourData request processes in queue to finish',
  });
  await yourDataRequestQueue.onIdle();
}

export async function stop() {
  await waitForAllTasksToFinish();
}
