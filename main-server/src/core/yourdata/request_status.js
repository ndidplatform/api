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

// state order
//
// 1. "pending"
// 2. "data_decryption_pending" or "errored"
// 3. "data_decryption_key_requested"
// 4. "data_decryption_key_available"
// 5. "completed"
//

export default {
  PENDING: 'pending',
  DATA_DECRYPTION_PENDING: 'data_decryption_pending',
  DATA_DECRYPTION_KEY_REQUESTED: 'data_decryption_key_requested',
  DATA_DECRYPTION_KEY_AVAILABLE: 'data_decryption_key_available',
  COMPLETED: 'completed',
  ERRORED: 'errored',
};
