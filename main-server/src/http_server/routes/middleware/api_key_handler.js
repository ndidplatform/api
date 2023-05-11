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

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';

import * as cryptoUtils from '../../../utils/crypto';

import { useApiKey, apiKeyHash } from '../../../config';

let apiKeyHashBuffer;
if (useApiKey) {
  apiKeyHashBuffer = Buffer.from(apiKeyHash, 'hex');
}

export default function apiKeyHandler(req, res, next) {
  const { 'x-api-key': apiKey } = req.headers;

  if (useApiKey) {
    if (!apiKey) {
      next(
        new CustomError({
          errorType: errorType.INVALID_API_KEY,
        })
      );
      return;
    }

    const inputApiKeyHashBuffer = cryptoUtils.sha256(apiKey);
    if (Buffer.compare(inputApiKeyHashBuffer, apiKeyHashBuffer) !== 0) {
      next(
        new CustomError({
          errorType: errorType.INVALID_API_KEY,
        })
      );
      return;
    }
  }
  next();
}
