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

import { v4 as uuidv4 } from 'uuid';

import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';

import { USAGE_TYPE } from './authorization_token';

import * as tendermintNdid from '../../tendermint/ndid';
import * as jwtUtils from '../../utils/jwt';

import * as config from '../../config';
import { role } from '../../node';

export async function createSignedToken({ nodeId, payload }) {
  if (role === 'proxy') {
    if (nodeId == null) {
      throw new CustomError({
        errorType: errorType.MISSING_NODE_ID,
      });
    }
  } else {
    nodeId = config.nodeId;
  }

  const nodeInfo = await tendermintNdid.getNodeInfo(nodeId);
  if (nodeInfo == null) {
    throw new CustomError({
      errorType: errorType.NODE_INFO_NOT_FOUND,
      details: {
        nodeId,
      },
    });
  }
  if (nodeInfo.role.toLowerCase() !== 'as') {
    throw new CustomError({
      errorType: errorType.MUST_BE_AS_NODE,
    });
  }

  const nowUnixSeconds = Math.floor(Date.now() / 1000);

  // validations

  if (
    payload.expiration_datetime != null &&
    payload.expiration_datetime <= nowUnixSeconds
  ) {
    throw new CustomError({
      errorType:
        errorType.TOKEN_EXPIRATION_TIME_MUST_BE_LATER_THAN_CURRENT_TIME,
      details: {
        nowUnixSeconds,
        expirationDatetime: payload.expiration_datetime,
      },
    });
  }

  if (payload.issue_datetime != null && payload.expiration_datetime != null) {
    if (payload.issue_datetime >= payload.expiration_datetime) {
      throw new CustomError({
        errorType:
          errorType.TOKEN_EXPIRATION_TIME_MUST_BE_LATER_THAN_ISSUE_TIME,
        details: {
          issueDatetime: payload.issue_datetime,
          expirationDatetime: payload.expiration_datetime,
        },
      });
    }
  }

  // TODO: other validations?
  // - rp_node_id ?
  // - namespace + identifier ?
  // - source_request_id_list ?

  // - usage_type
  // if not "continuous_no_expire", "expiration_datetime" must not be present, otherwise "expiration_datetime" must be included?
  if (payload.usage_type === USAGE_TYPE.CONTINUOUS_NO_EXPIRE) {
    if (payload.expiration_datetime != null) {
      throw new CustomError({
        errorType: errorType.TOKEN_MUST_NOT_HAVE_EXPIRATION_TIME,
      });
    }
  } else {
    if (payload.expiration_datetime == null) {
      throw new CustomError({
        errorType: errorType.TOKEN_MUST_HAVE_EXPIRATION_TIME,
      });
    }
  }

  //

  const tokenId = uuidv4();

  const publicKey = nodeInfo.signing_public_key;

  const asNodeSigningKeyVersion = publicKey.version;

  const payloadtoSign = {
    token_id: tokenId,
    ...payload,
    as_node_signing_key_version: asNodeSigningKeyVersion,
  };

  if (payload.issue_datetime == null) {
    payloadtoSign.issue_datetime = nowUnixSeconds;
  }

  const jwt = await jwtUtils.createJWT({
    nodeId,
    publicKey,
    payload: payloadtoSign,
  });

  return {
    token: jwt,
  };
}
