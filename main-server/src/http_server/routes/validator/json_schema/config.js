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

export default {
  GET: {
    '/config/telemetry/reissue_token': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
      },
    },
  },
  POST: {
    '/config/set': {
      body: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          CALLBACK_API_VERSION: { type: 'string', enum: ['4.0', '5.0'] },
          AUTO_CLOSE_REQUEST_ON_COMPLETED: { type: 'boolean' },
          AUTO_CLOSE_REQUEST_ON_REJECTED: { type: 'boolean' },
          AUTO_CLOSE_REQUEST_ON_COMPLICATED: { type: 'boolean' },
          AUTO_CLOSE_REQUEST_ON_ERRORED: { type: 'boolean' },
        },
      },
    },
  },
};
