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

import * as tendermintNdid from '../tendermint/ndid';

export async function getMessageDetails({ messageId }) {
  const messageDetail = await tendermintNdid.getMessageDetail({ messageId });

  if (messageDetail == null) {
    return null;
  }

  let message;

  message = {
    ...messageDetail,
  };

  const {
    purpose, // eslint-disable-line no-unused-vars
    creation_chain_id,
    creation_block_height,
  } = message;

  return {
    ...message,
    creation_block_height: `${creation_chain_id}:${creation_block_height}`,
  };
}
