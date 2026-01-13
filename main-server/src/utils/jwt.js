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

import base64url from 'base64url';

import { createSignature } from '.';
import * as cryptoUtils from './crypto';

const JWT_ALG = {
  RS256: 'RS256',
  RS384: 'RS384',
  RS512: 'RS512',
  PS256: 'PS256',
  PS384: 'PS384',
  PS512: 'PS512',
  ES256: 'ES256',
  ES384: 'ES384',
  ES512: 'ES512',
  ES256K: 'ES256K', // EC secp256k1
  EdDSA: 'EdDSA',
};

const signingAlgorithmMap = {
  [cryptoUtils.signatureAlgorithm.RSASSA_PKCS1_V1_5_SHA_256.name]:
    JWT_ALG.RS256,
  [cryptoUtils.signatureAlgorithm.RSASSA_PKCS1_V1_5_SHA_384.name]:
    JWT_ALG.RS384,
  [cryptoUtils.signatureAlgorithm.RSASSA_PKCS1_V1_5_SHA_512.name]:
    JWT_ALG.RS512,
  [cryptoUtils.signatureAlgorithm.RSASSA_PSS_SHA_256.name]: JWT_ALG.PS256,
  [cryptoUtils.signatureAlgorithm.RSASSA_PSS_SHA_384.name]: JWT_ALG.PS384,
  [cryptoUtils.signatureAlgorithm.RSASSA_PSS_SHA_512.name]: JWT_ALG.PS512,
  [cryptoUtils.signatureAlgorithm.ECDSA_SHA_256.name]: JWT_ALG.ES256,
  [cryptoUtils.signatureAlgorithm.ECDSA_SHA_384.name]: JWT_ALG.ES384,
  [cryptoUtils.signatureAlgorithm.Ed25519.name]: JWT_ALG.EdDSA,
};

export async function createJWT({ nodeId, publicKey, payload }) {
  // `publicKey` from result of tendermintNdid.getNodeSigningPubKey(nodeId)

  const jwtAlg = signingAlgorithmMap[publicKey.algorithm];
  if (jwtAlg == null) {
    throw new Error('unsupported jwt signing algorithm');
  }
  const header = {
    alg: jwtAlg,
    typ: 'JWT',
  };

  const headerJSON = JSON.stringify(header);
  const encodedHeader = base64url(headerJSON);

  const payloadJSON = JSON.stringify(payload);
  const encodedPayload = base64url(payloadJSON);

  const token = encodedHeader + '.' + encodedPayload;
  const signature = await createSignature(
    publicKey.algorithm,
    publicKey.version,
    token,
    nodeId,
    false
  );

  let jwtSignature;
  if (
    [JWT_ALG.ES256, JWT_ALG.ES384, JWT_ALG.ES512, JWT_ALG.ES256K].includes(
      jwtAlg
    )
  ) {
    jwtSignature = cryptoUtils.convertEcdsaASN1SigToIEEEP1363Sig(
      publicKey.algorithm,
      signature
    );
  } else {
    jwtSignature = signature;
  }

  const signedToken = token + '.' + base64url(jwtSignature);

  return signedToken;
}
