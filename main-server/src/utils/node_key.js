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

import path from 'path';
import crypto from 'crypto';

import { readFileAsync, verifySignature } from '.';
import * as cryptoUtils from './crypto';

// import { parseKey } from './asn1parser';
import * as node from '../node';
import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import logger from '../logger';

import * as config from '../config';

let signingPrivateKey;
let signingMasterPrivateKey;
let encryptionPrivateKey;

let nodeBehindProxySigningPrivateKeys = {};
let nodeBehindProxySigningPrivateKeyPassphrases = {};
let nodeBehindProxySigningMasterPrivateKeys = {};
let nodeBehindProxySigningMasterPrivateKeyPassphrases = {};
let nodeBehindProxyEncryptionPrivateKeys = {};
let nodeBehindProxyEncryptionPrivateKeyPassphrases = {};

async function readNodeSigningPrivateKeyFromFile() {
  let privateKey;
  try {
    privateKey = await readFileAsync(config.signingPrivateKeyPath, 'utf8');
  } catch (error) {
    throw new CustomError({
      message: 'Cannot read node signing private key file',
      cause: error,
    });
  }
  try {
    validateSigningKey(
      privateKey,
      null,
      null,
      config.signingPrivateKeyPassphrase
    );
  } catch (error) {
    throw new CustomError({
      message: 'Error verifying signing node private key',
      cause: error,
    });
  }
  return privateKey;
}

async function readNodeSigningMasterPrivateKeyFromFile() {
  let masterPrivateKey;
  try {
    masterPrivateKey = await readFileAsync(
      config.signingMasterPrivateKeyPath,
      'utf8'
    );
  } catch (error) {
    throw new CustomError({
      message: 'Cannot read node signing master private key file',
      cause: error,
    });
  }
  try {
    validateSigningKey(
      masterPrivateKey,
      null,
      null,
      config.signingMasterPrivateKeyPassphrase
    );
  } catch (error) {
    throw new CustomError({
      message: 'Error verifying node signing master private key',
      cause: error,
    });
  }
  return masterPrivateKey;
}

async function readNodeEncryptionPrivateKeyFromFile() {
  let privateKey;
  try {
    privateKey = await readFileAsync(config.encryptionPrivateKeyPath, 'utf8');
  } catch (error) {
    throw new CustomError({
      message: 'Cannot read node encryption private key file',
      cause: error,
    });
  }
  try {
    validateEncryptionKey(
      privateKey,
      null,
      null,
      config.encryptionPrivateKeyPassphrase
    );
  } catch (error) {
    throw new CustomError({
      message: 'Error verifying encryption node private key',
      cause: error,
    });
  }
  return privateKey;
}

async function readNodeBehindProxySigningPrivateKeyFromFile(nodeId) {
  const keyFilePath = path.join(
    config.nodeBehindProxySigningPrivateKeyDirectoryPath,
    nodeId
  );
  let key;
  try {
    key = await readFileAsync(keyFilePath, 'utf8');
  } catch (error) {
    throw new CustomError({
      message: 'Cannot read node behind proxy signing private key file',
      cause: error,
      details: {
        nodeId,
      },
    });
  }

  const passphraseFilePath = path.join(
    config.nodeBehindProxySigningPrivateKeyDirectoryPath,
    `${nodeId}_passphrase`
  );

  let passphrase;
  try {
    passphrase = await readFileAsync(passphraseFilePath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw new CustomError({
        message:
          'Cannot read node behind proxy signing private key passpharse file',
        cause: error,
        details: {
          nodeId,
        },
      });
    }
  }
  try {
    validateSigningKey(key, null, null, passphrase);
  } catch (error) {
    throw new CustomError({
      message: 'Error verifying node behind proxy signing private key',
      cause: error,
      details: {
        nodeId,
        keyFilePath,
        passphraseExists: passphrase != null,
        passphraseFilePath,
      },
    });
  }
  return {
    key,
    passphrase,
  };
}

async function readNodeBehindProxySigningMasterPrivateKeyFromFile(nodeId) {
  const keyFilePath = path.join(
    config.nodeBehindProxySigningMasterPrivateKeyDirectoryPath,
    `${nodeId}_master`
  );
  let key;
  try {
    key = await readFileAsync(keyFilePath, 'utf8');
  } catch (error) {
    throw new CustomError({
      message: 'Cannot read node behind proxy signing master private key file',
      cause: error,
      details: {
        nodeId,
      },
    });
  }

  const passphraseFilePath = path.join(
    config.nodeBehindProxySigningMasterPrivateKeyDirectoryPath,
    `${nodeId}_master_passphrase`
  );

  let passphrase;
  try {
    passphrase = await readFileAsync(passphraseFilePath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw new CustomError({
        message:
          'Cannot read node behind proxy signing master private key passpharse file',
        cause: error,
        details: {
          nodeId,
        },
      });
    }
  }
  try {
    validateSigningKey(key, null, null, passphrase);
  } catch (error) {
    throw new CustomError({
      message: 'Error verifying node behind proxy signing master private key',
      cause: error,
      details: {
        nodeId,
        keyFilePath,
        passphraseExists: passphrase != null,
        passphraseFilePath,
      },
    });
  }
  return {
    key,
    passphrase,
  };
}

async function readNodeBehindProxyEncryptionPrivateKeyFromFile(nodeId) {
  const keyFilePath = path.join(
    config.nodeBehindProxyEncryptionPrivateKeyDirectoryPath,
    nodeId
  );
  let key;
  try {
    key = await readFileAsync(keyFilePath, 'utf8');
  } catch (error) {
    throw new CustomError({
      message: 'Cannot read node behind proxy encryption private key file',
      cause: error,
      details: {
        nodeId,
      },
    });
  }

  const passphraseFilePath = path.join(
    config.nodeBehindProxyEncryptionPrivateKeyDirectoryPath,
    `${nodeId}_passphrase`
  );

  let passphrase;
  try {
    passphrase = await readFileAsync(passphraseFilePath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw new CustomError({
        message:
          'Cannot read node behind proxy encryption private key passpharse file',
        cause: error,
        details: {
          nodeId,
        },
      });
    }
  }
  try {
    validateEncryptionKey(key, null, null, passphrase);
  } catch (error) {
    throw new CustomError({
      message: 'Error verifying node behind proxy encryption private key',
      cause: error,
      details: {
        nodeId,
        keyFilePath,
        passphraseExists: passphrase != null,
        passphraseFilePath,
      },
    });
  }
  return {
    key,
    passphrase,
  };
}

export async function initialize() {
  logger.info({
    message: 'Reading node keys from files',
  });

  const newSigningPrivateKey = await readNodeSigningPrivateKeyFromFile();
  const newSigningMasterPrivateKey =
    await readNodeSigningMasterPrivateKeyFromFile();
  const newEncryptionPrivateKey = await readNodeEncryptionPrivateKeyFromFile();

  // Nodes behind proxy
  if (node.role === 'proxy') {
    const nodesBehindProxyWithKeyOnProxy =
      await node.getNodesBehindProxyWithKeyOnProxy();
    const nodeIds = nodesBehindProxyWithKeyOnProxy.map((node) => node.node_id);

    const newNodeBehindProxySigningPrivateKeys = {};
    const newNodeBehindProxySigningPrivateKeyPassphrases = {};

    const newNodeBehindProxySigningMasterPrivateKeys = {};
    const newNodeBehindProxySigningMasterPrivateKeyPassphrases = {};

    const newNodeBehindProxyEncryptionPrivateKeys = {};
    const newNodeBehindProxyEncryptionPrivateKeyPassphrases = {};

    await Promise.all(
      nodeIds.map(async (nodeId) => {
        const [
          { key: signingPrivateKey, passphrase: signingPrivateKeyPassphrase },
          {
            key: signingMasterPrivateKey,
            passphrase: signingMasterPrivateKeyPassphrase,
          },
          {
            key: encryptionPrivateKey,
            passphrase: encryptionPrivateKeyPassphrase,
          },
        ] = await Promise.all([
          readNodeBehindProxySigningPrivateKeyFromFile(nodeId),
          readNodeBehindProxySigningMasterPrivateKeyFromFile(nodeId),
          readNodeBehindProxyEncryptionPrivateKeyFromFile(nodeId),
        ]);
        [nodeId] = signingPrivateKey;
        if (signingPrivateKeyPassphrase != null) {
          newNodeBehindProxySigningPrivateKeyPassphrases[nodeId] =
            signingPrivateKeyPassphrase;
        }
        newNodeBehindProxySigningMasterPrivateKeys[nodeId] =
          signingMasterPrivateKey;
        if (signingMasterPrivateKeyPassphrase != null) {
          newNodeBehindProxySigningMasterPrivateKeyPassphrases[nodeId] =
            signingMasterPrivateKeyPassphrase;
        }
        newNodeBehindProxyEncryptionPrivateKeys[nodeId] = encryptionPrivateKey;
        if (encryptionPrivateKeyPassphrase != null) {
          newNodeBehindProxyEncryptionPrivateKeyPassphrases[nodeId] =
            encryptionPrivateKeyPassphrase;
        }
      })
    );

    nodeBehindProxySigningPrivateKeys = newNodeBehindProxySigningPrivateKeys;
    nodeBehindProxySigningPrivateKeyPassphrases =
      newNodeBehindProxySigningPrivateKeyPassphrases;

    nodeBehindProxySigningMasterPrivateKeys =
      newNodeBehindProxySigningMasterPrivateKeys;
    nodeBehindProxySigningMasterPrivateKeyPassphrases =
      newNodeBehindProxySigningMasterPrivateKeyPassphrases;

    nodeBehindProxyEncryptionPrivateKeys =
      newNodeBehindProxyEncryptionPrivateKeys;
    nodeBehindProxyEncryptionPrivateKeyPassphrases =
      newNodeBehindProxyEncryptionPrivateKeyPassphrases;
  }

  signingPrivateKey = newSigningPrivateKey;
  signingMasterPrivateKey = newSigningMasterPrivateKey;
  encryptionPrivateKey = newEncryptionPrivateKey;
}

export function verifyNewSigningKey(
  algorithm,
  signature,
  publicKey,
  plainText,
  isMaster
) {
  if (!verifySignature(algorithm, signature, publicKey, plainText)) {
    throw new CustomError({
      errorType: isMaster
        ? errorType.UPDATE_MASTER_KEY_CHECK_FAILED
        : errorType.UPDATE_NODE_KEY_CHECK_FAILED,
    });
  }
}

export function validateSigningKey(
  key,
  keyAlgorithm,
  signingAlgorithm,
  passphrase
) {
  let keyObject;
  try {
    keyObject = crypto.createPublicKey({
      key,
      type: 'spki',
      format: 'pem',
      passphrase,
    });
  } catch (error) {
    throw new CustomError({
      errorType: errorType.INVALID_KEY_FORMAT,
      cause: error,
    });
  }
  if (keyAlgorithm != null) {
    if (keyAlgorithm === cryptoUtils.keyAlgorithm.RSA) {
      if (keyObject.asymmetricKeyType !== 'rsa') {
        throw new CustomError({
          errorType: errorType.MISMATCHED_KEY_TYPE,
        });
      }
    } else if (keyAlgorithm === cryptoUtils.keyAlgorithm.EC) {
      if (keyObject.asymmetricKeyType !== 'ec') {
        throw new CustomError({
          errorType: errorType.MISMATCHED_KEY_TYPE,
        });
      }
    } else if (keyAlgorithm === cryptoUtils.keyAlgorithm.Ed25519) {
      if (keyObject.asymmetricKeyType !== 'ed25519') {
        throw new CustomError({
          errorType: errorType.MISMATCHED_KEY_TYPE,
        });
      }
    }
  } else {
    if (
      keyObject.asymmetricKeyType !== 'rsa' &&
      keyObject.asymmetricKeyType !== 'ec' &&
      keyObject.asymmetricKeyType !== 'ed25519'
    ) {
      throw new CustomError({
        errorType: errorType.UNSUPPORTED_KEY_TYPE,
      });
    }
  }

  // Check RSA key length to be at least 2048-bit
  if (keyObject.asymmetricKeyType === 'rsa') {
    if (keyObject.asymmetricKeyDetails.modulusLength < 2048) {
      throw new CustomError({
        errorType: errorType.RSA_KEY_LENGTH_TOO_SHORT,
      });
    }
  }

  // Check EC key algorithm and signing algorithm
  if (keyObject.asymmetricKeyType === 'ec') {
    if (
      keyObject.asymmetricKeyDetails.namedCurve === 'prime256v1' ||
      keyObject.asymmetricKeyDetails.namedCurve === 'secp256k1'
    ) {
      if (
        signingAlgorithm != null &&
        signingAlgorithm !== cryptoUtils.signatureAlgorithm.ECDSA_SHA_256.name
      ) {
        throw new CustomError({
          errorType: errorType.UNSUPPORTED_SIGNING_ALGORITHM,
          details: {
            asymmetricKeyDetails: keyObject.asymmetricKeyDetails,
            signingAlgorithm,
          },
        });
      }
    } else if (keyObject.asymmetricKeyDetails.namedCurve === 'secp384r1') {
      if (
        signingAlgorithm != null &&
        signingAlgorithm !== cryptoUtils.signatureAlgorithm.ECDSA_SHA_384.name
      ) {
        throw new CustomError({
          errorType: errorType.UNSUPPORTED_SIGNING_ALGORITHM,
          details: {
            asymmetricKeyDetails: keyObject.asymmetricKeyDetails,
            signingAlgorithm,
          },
        });
      }
    } else {
      throw new CustomError({
        errorType: errorType.UNSUPPORTED_KEY_TYPE,
        details: {
          asymmetricKeyType: keyObject.asymmetricKeyType,
          asymmetricKeyDetails: keyObject.asymmetricKeyDetails,
        },
      });
    }
  }
}

export function validateEncryptionKey(
  key,
  keyAlgorithm,
  encryptionAlgorithm,
  passphrase
) {
  let keyObject;
  try {
    keyObject = crypto.createPublicKey({
      key,
      type: 'spki',
      format: 'pem',
      passphrase,
    });
  } catch (error) {
    throw new CustomError({
      errorType: errorType.INVALID_KEY_FORMAT,
      cause: error,
    });
  }
  if (keyAlgorithm != null) {
    if (keyAlgorithm === cryptoUtils.keyAlgorithm.RSA) {
      if (keyObject.asymmetricKeyType !== 'rsa') {
        throw new CustomError({
          errorType: errorType.MISMATCHED_KEY_TYPE,
        });
      }
    }
  } else {
    if (keyObject.asymmetricKeyType !== 'rsa') {
      throw new CustomError({
        errorType: errorType.UNSUPPORTED_KEY_TYPE,
      });
    }
  }
  // Check RSA key length to be at least 2048-bit
  if (keyObject.asymmetricKeyType === 'rsa') {
    if (keyObject.asymmetricKeyDetails.modulusLength < 2048) {
      throw new CustomError({
        errorType: errorType.RSA_KEY_LENGTH_TOO_SHORT,
      });
    }
  }
}

export function validateAccessorKey(key, keyAlgorithm, passphrase) {
  let keyObject;
  try {
    keyObject = crypto.createPublicKey({
      key,
      type: 'spki',
      format: 'pem',
      passphrase,
    });
  } catch (error) {
    throw new CustomError({
      errorType: errorType.INVALID_KEY_FORMAT,
      cause: error,
    });
  }
  if (keyAlgorithm != null) {
    if (keyAlgorithm === cryptoUtils.keyAlgorithm.RSA) {
      if (keyObject.asymmetricKeyType !== 'rsa') {
        throw new CustomError({
          errorType: errorType.MISMATCHED_KEY_TYPE,
        });
      }
    } else {
      throw new CustomError({
        errorType: errorType.UNSUPPORTED_KEY_TYPE,
      });
    }
  }
  if (keyObject.asymmetricKeyType !== 'rsa') {
    throw new CustomError({
      errorType: errorType.UNSUPPORTED_KEY_TYPE,
    });
  }
  // Check RSA key length to be at least 2048-bit
  if (keyObject.asymmetricKeyType === 'rsa') {
    if (keyObject.asymmetricKeyDetails.modulusLength < 2048) {
      throw new CustomError({
        errorType: errorType.RSA_KEY_LENGTH_TOO_SHORT,
      });
    }
  }
}

export function getLocalNodeSigningPrivateKey(nodeId) {
  if (nodeId === config.nodeId) {
    return signingPrivateKey;
  }

  // Assume nodes behind proxy
  if (nodeBehindProxySigningPrivateKeys[nodeId] == null) {
    throw new CustomError({
      errorType: errorType.NODE_KEY_NOT_FOUND,
    });
  }

  return nodeBehindProxySigningPrivateKeys[nodeId];
}

export function getLocalNodeSigningMasterPrivateKey(nodeId) {
  if (nodeId === config.nodeId) {
    return signingMasterPrivateKey;
  }

  // Assume nodes behind proxy
  if (nodeBehindProxySigningMasterPrivateKeys[nodeId] == null) {
    throw new CustomError({
      errorType: errorType.NODE_KEY_NOT_FOUND,
    });
  }

  return nodeBehindProxySigningMasterPrivateKeys[nodeId];
}

export function getLocalNodeEncryptionPrivateKey(nodeId) {
  if (nodeId === config.nodeId) {
    return encryptionPrivateKey;
  }

  // Assume nodes behind proxy
  if (nodeBehindProxyEncryptionPrivateKeys[nodeId] == null) {
    throw new CustomError({
      errorType: errorType.NODE_KEY_NOT_FOUND,
    });
  }

  return nodeBehindProxyEncryptionPrivateKeys[nodeId];
}

export function getLocalNodeSigningPrivateKeyPassphrase(nodeId) {
  if (nodeId === config.nodeId) {
    return config.signingPrivateKeyPassphrase;
  }

  // Assume nodes behind proxy
  return nodeBehindProxySigningPrivateKeyPassphrases[nodeId];
}

export function getLocalNodeSigningMasterPrivateKeyPassphrase(nodeId) {
  if (nodeId === config.nodeId) {
    return config.signingMasterPrivateKeyPassphrase;
  }

  // Assume nodes behind proxy
  return nodeBehindProxySigningMasterPrivateKeyPassphrases[nodeId];
}

export function getLocalNodeEncryptionPrivateKeyPassphrase(nodeId) {
  if (nodeId === config.nodeId) {
    return config.encryptionPrivateKeyPassphrase;
  }

  // Assume nodes behind proxy
  return nodeBehindProxyEncryptionPrivateKeyPassphrases[nodeId];
}
