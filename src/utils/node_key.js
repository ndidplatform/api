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
import fs from 'fs';

import { readFileAsync } from '.';

import { parseKey } from './asn1parser';
import * as node from '../node';
import CustomError from '../error/custom_error';
import errorType from '../error/type';
import logger from '../logger';

import * as config from '../config';

let privateKey;
let masterPrivateKey;

let nodeBehindProxyPrivateKeys = {};
let nodeBehindProxyMasterPrivateKeys = {};
let nodeBehindProxyPrivateKeyPassphrases = {};
let nodeBehindProxyMasterPrivateKeyPassphrases = {};

function readNodePrivateKeyFromFile() {
  privateKey = fs.readFileSync(config.privateKeyPath, 'utf8');
  try {
    validateKey(privateKey, null, config.privateKeyPassphrase);
  } catch (error) {
    throw new CustomError({
      message: 'Error verifying node private key',
      cause: error,
    });
  }
}

function readNodeMasterPrivateKeyFromFile() {
  masterPrivateKey = fs.readFileSync(config.masterPrivateKeyPath, 'utf8');
  try {
    validateKey(masterPrivateKey, null, config.masterPrivateKeyPassphrase);
  } catch (error) {
    throw new CustomError({
      message: 'Error verifying node master private key',
      cause: error,
    });
  }
}

async function readNodeBehindProxyPrivateKeyFromFile(nodeId) {
  const keyFilePath = path.join(
    config.nodeBehindProxyPrivateKeyDirectoryPath,
    nodeId
  );
  const key = await readFileAsync(keyFilePath, 'utf8');

  const passphraseFilePath = path.join(
    config.nodeBehindProxyPrivateKeyDirectoryPath,
    `${nodeId}_passphrase`
  );

  let passphrase;
  try {
    passphrase = await readFileAsync(passphraseFilePath, 'utf8');
    nodeBehindProxyPrivateKeyPassphrases[nodeId] = passphrase;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw new CustomError({
        message: 'Cannot read private key passpharse file',
        cause: error,
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
  nodeBehindProxyPrivateKeys[nodeId] = key;
}

async function readNodeBehindProxyMasterPrivateKeyFromFile(nodeId) {
  const keyFilePath = path.join(
    config.nodeBehindProxyMasterPrivateKeyDirectoryPath,
    `${nodeId}_master`
  );
  const key = await readFileAsync(keyFilePath, 'utf8');

  const passphraseFilePath = path.join(
    config.nodeBehindProxyMasterPrivateKeyDirectoryPath,
    `${nodeId}_master_passphrase`
  );

  let passphrase;
  try {
    passphrase = await readFileAsync(passphraseFilePath, 'utf8');
    nodeBehindProxyMasterPrivateKeyPassphrases[nodeId] = passphrase;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw new CustomError({
        message: 'Cannot read master private key passpharse file',
        cause: error,
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
  nodeBehindProxyMasterPrivateKeys[nodeId] = key;
}

export async function initialize() {
  if (!config.useExternalCryptoService) {
    logger.info({
      message: 'Reading node keys from files',
    });

    readNodePrivateKeyFromFile();
    readNodeMasterPrivateKeyFromFile();

    // Nodes behind proxy
    if (node.role === 'proxy') {
      const nodesBehindProxyWithKeyOnProxy = await node.getNodesBehindProxyFromBlockchain(
        { withConfig: 'KEY_ON_PROXY' }
      );
      const nodeIds = nodesBehindProxyWithKeyOnProxy.map(
        (node) => node.node_id
      );
      await Promise.all(
        nodeIds.map((nodeId) => {
          return Promise.all([
            readNodeBehindProxyPrivateKeyFromFile(nodeId),
            readNodeBehindProxyMasterPrivateKeyFromFile(nodeId),
          ]);
        })
      );
    }
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
  return nodeBehindProxyPrivateKeys[nodeId];
}

export function getLocalNodeMasterPrivateKey(nodeId) {
  if (nodeId === config.nodeId) {
    return masterPrivateKey;
  }

  // Assume nodes behind proxy
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
