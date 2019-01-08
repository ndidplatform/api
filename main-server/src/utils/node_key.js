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

import { readFileAsync } from '.';

import { parseKey } from './asn1parser';
import * as node from '../node';
import CustomError from 'ndid-error/custom_error';
import errorType from 'ndid-error/type';
import logger from '../logger';
import { verifySignature } from '../utils';

import * as config from '../config';
import { internalEmitter } from '../master-worker-interface/server';

let privateKey;
let masterPrivateKey;

let nodeBehindProxyPrivateKeys = {};
let nodeBehindProxyMasterPrivateKeys = {};
let nodeBehindProxyPrivateKeyPassphrases = {};
let nodeBehindProxyMasterPrivateKeyPassphrases = {};

async function readNodePrivateKeyFromFile() {
  let privateKey;
  try {
    privateKey = await readFileAsync(config.privateKeyPath, 'utf8');
  } catch (error) {
    throw new CustomError({
      message: 'Cannot read node private key file',
      cause: error,
    });
  }
  try {
    validateKey(privateKey, null, config.privateKeyPassphrase);
  } catch (error) {
    throw new CustomError({
      message: 'Error verifying node private key',
      cause: error,
    });
  }
  return privateKey;
}

async function readNodeMasterPrivateKeyFromFile() {
  let masterPrivateKey;
  try {
    masterPrivateKey = await readFileAsync(config.masterPrivateKeyPath, 'utf8');
  } catch (error) {
    throw new CustomError({
      message: 'Cannot read node master private key file',
      cause: error,
    });
  }
  try {
    validateKey(masterPrivateKey, null, config.masterPrivateKeyPassphrase);
  } catch (error) {
    throw new CustomError({
      message: 'Error verifying node master private key',
      cause: error,
    });
  }
  return masterPrivateKey;
}

async function readNodeBehindProxyPrivateKeyFromFile(nodeId) {
  const keyFilePath = path.join(
    config.nodeBehindProxyPrivateKeyDirectoryPath,
    nodeId
  );
  let key;
  try {
    key = await readFileAsync(keyFilePath, 'utf8');
  } catch (error) {
    throw new CustomError({
      message: 'Cannot read node behind proxy private key file',
      cause: error,
      details: {
        nodeId,
      },
    });
  }

  const passphraseFilePath = path.join(
    config.nodeBehindProxyPrivateKeyDirectoryPath,
    `${nodeId}_passphrase`
  );

  let passphrase;
  try {
    passphrase = await readFileAsync(passphraseFilePath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw new CustomError({
        message: 'Cannot read node behind proxy private key passpharse file',
        cause: error,
        details: {
          nodeId,
        },
      });
    }
  }
  try {
    validateKey(key, null, passphrase);
  } catch (error) {
    throw new CustomError({
      message: 'Error verifying node behind proxy private key',
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

async function readNodeBehindProxyMasterPrivateKeyFromFile(nodeId) {
  const keyFilePath = path.join(
    config.nodeBehindProxyMasterPrivateKeyDirectoryPath,
    `${nodeId}_master`
  );
  let key;
  try {
    key = await readFileAsync(keyFilePath, 'utf8');
  } catch (error) {
    throw new CustomError({
      message: 'Cannot read node behind proxy master private key file',
      cause: error,
      details: {
        nodeId,
      },
    });
  }

  const passphraseFilePath = path.join(
    config.nodeBehindProxyMasterPrivateKeyDirectoryPath,
    `${nodeId}_master_passphrase`
  );

  let passphrase;
  try {
    passphrase = await readFileAsync(passphraseFilePath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw new CustomError({
        message:
          'Cannot read node behind proxy master private key passpharse file',
        cause: error,
        details: {
          nodeId,
        },
      });
    }
  }
  try {
    validateKey(key, null, passphrase);
  } catch (error) {
    throw new CustomError({
      message: 'Error verifying node behind proxy master private key',
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

  if(config.isMaster) internalEmitter.emit('reInitKey');
  logger.info({
    message: 'Reading node keys from files',
  });

  const newPrivateKey = await readNodePrivateKeyFromFile();
  const newMasterPrivateKey = await readNodeMasterPrivateKeyFromFile();

  // Nodes behind proxy
  if (node.role === 'proxy') {
    const nodesBehindProxyWithKeyOnProxy = await node.getNodesBehindProxyWithKeyOnProxy();
    const nodeIds = nodesBehindProxyWithKeyOnProxy.map((node) => node.node_id);

    logger.debug({
      message: 'List nodes behind proxy',
      nodeIds
    });

    const newNodeBehindProxyPrivateKeys = {};
    const newNodeBehindProxyPrivateKeyPassphrases = {};

    const newNodeBehindProxyMasterPrivateKeys = {};
    const newNodeBehindProxyMasterPrivateKeyPassphrases = {};

    await Promise.all(
      nodeIds.map(async (nodeId) => {
        const [
          { key: privateKey, passphrase: privateKeyPassphrase },
          { key: masterPrivateKey, passphrase: masterPrivateKeyPassphrase },
        ] = await Promise.all([
          readNodeBehindProxyPrivateKeyFromFile(nodeId),
          readNodeBehindProxyMasterPrivateKeyFromFile(nodeId),
        ]);
        newNodeBehindProxyPrivateKeys[nodeId] = privateKey;
        if (privateKeyPassphrase != null) {
          newNodeBehindProxyPrivateKeyPassphrases[
            nodeId
          ] = privateKeyPassphrase;
        }
        newNodeBehindProxyMasterPrivateKeys[nodeId] = masterPrivateKey;
        if (masterPrivateKeyPassphrase != null) {
          newNodeBehindProxyMasterPrivateKeyPassphrases[
            nodeId
          ] = masterPrivateKeyPassphrase;
        }
      })
    );
    nodeBehindProxyPrivateKeys = newNodeBehindProxyPrivateKeys;
    nodeBehindProxyPrivateKeyPassphrases = newNodeBehindProxyPrivateKeyPassphrases;

    nodeBehindProxyMasterPrivateKeys = newNodeBehindProxyMasterPrivateKeys;
    nodeBehindProxyMasterPrivateKeyPassphrases = newNodeBehindProxyMasterPrivateKeyPassphrases;

    logger.debug({
      message: 'New node behind proxy object',
      list: Object.keys(nodeBehindProxyPrivateKeys)
    });
  }

  privateKey = newPrivateKey;
  masterPrivateKey = newMasterPrivateKey;
}

export function verifyNewKey(signature, publicKey, plainText, isMaster) {
  if (!verifySignature(signature, publicKey, plainText)) {
    throw new CustomError({
      errorType: isMaster
        ? errorType.UPDATE_MASTER_KEY_CHECK_FAILED
        : errorType.UPDATE_NODE_KEY_CHECK_FAILED,
    });
  }
}

export function validateKey(key, keyType, passphrase) {
  let parsedKey;
  try {
    parsedKey = parseKey({
      key,
      passphrase,
    });
  } catch (error) {
    throw new CustomError({
      errorType: errorType.INVALID_KEY_FORMAT,
      cause: error,
    });
  }
  if (keyType != null) {
    if (keyType === 'RSA') {
      if (parsedKey.type !== 'rsa') {
        throw new CustomError({
          errorType: errorType.MISMATCHED_KEY_TYPE,
        });
      }
    }
  } else {
    // Default to RSA type
    if (parsedKey.type !== 'rsa') {
      throw new CustomError({
        errorType: errorType.UNSUPPORTED_KEY_TYPE,
      });
    }
  }
  // Check RSA key length to be at least 2048-bit
  if (parsedKey.type === 'rsa') {
    if (
      (parsedKey.data && parsedKey.data.modulus.bitLength() < 2048) ||
      (parsedKey.privateKey && parsedKey.privateKey.modulus.bitLength() < 2048)
    ) {
      throw new CustomError({
        errorType: errorType.RSA_KEY_LENGTH_TOO_SHORT,
      });
    }
  }
}

export function getLocalNodePrivateKey(nodeId) {
  if (nodeId === config.nodeId) {
    return privateKey;
  }

  // Assume nodes behind proxy
  if (nodeBehindProxyPrivateKeys[nodeId] == null) {
    throw new CustomError({
      errorType: errorType.NODE_KEY_NOT_FOUND,
    });
  }

  return nodeBehindProxyPrivateKeys[nodeId];
}

export function getLocalNodeMasterPrivateKey(nodeId) {
  if (nodeId === config.nodeId) {
    return masterPrivateKey;
  }

  // Assume nodes behind proxy
  if (nodeBehindProxyMasterPrivateKeys[nodeId] == null) {
    throw new CustomError({
      errorType: errorType.NODE_KEY_NOT_FOUND,
    });
  }

  return nodeBehindProxyMasterPrivateKeys[nodeId];
}

export function getLocalNodePrivateKeyPassphrase(nodeId) {
  if (nodeId === config.nodeId) {
    return config.privateKeyPassphrase;
  }

  // Assume nodes behind proxy
  return nodeBehindProxyPrivateKeyPassphrases[nodeId];
}

export function getLocalNodeMasterPrivateKeyPassphrase(nodeId) {
  if (nodeId === config.nodeId) {
    return config.masterPrivateKeyPassphrase;
  }

  // Assume nodes behind proxy
  return nodeBehindProxyMasterPrivateKeyPassphrases[nodeId];
}
