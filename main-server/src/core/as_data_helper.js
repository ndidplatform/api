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

import util from 'util';
import zlib from 'zlib';

import parseDataURL from 'data-urls';

import { dataUrlRegex } from '../data_url';

const gzip = util.promisify(zlib.gzip);
const unzip = util.promisify(zlib.unzip);

const COMPRESSION_ALGORITHM = 'gzip';

export async function packData(data, compressMinLength, maxUncompressedLength) {
  if (typeof data !== 'string') {
    throw new Error('"data" must be a string');
  }

  // check for base64 data URL
  let dataBuffer;
  const metadata = {};
  const dataUrlParsedData = parseDataURL(data);
  if (dataUrlParsedData != null) {
    const match = data.match(dataUrlRegex);
    if (match[4] && match[4].endsWith('base64')) {
      // Convert data with data URL format to Buffer for transferring over P2P
      // In case it is base64 encoded, MQ message payload size is reduced
      const dataDataUrlPrefix = match[1];
      dataBuffer = dataUrlParsedData.body;

      metadata.base64_data_url = true;
      metadata.data_url_prefix = dataDataUrlPrefix;
    }
  }
  if (dataBuffer == null) {
    dataBuffer = Buffer.from(data);
  }

  if (dataBuffer.length > maxUncompressedLength) {
    throw new Error('data size larger than limit');
  }

  // compress
  let buffer;
  if (compressMinLength && dataBuffer.length >= compressMinLength) {
    buffer = await gzip(dataBuffer);
    metadata.compression_algorithm = COMPRESSION_ALGORITHM;
  } else {
    buffer = dataBuffer;
    metadata.compression_algorithm = null;
  }

  return {
    buffer_base64: buffer.toString('base64'),
    metadata,
  };
}

export async function unpackData(packedData, maxUncompressedLength) {
  const { buffer_base64: bufferBase64, metadata } = packedData;
  const { compression_algorithm: compressionAlgorithm } = metadata;

  const buffer = Buffer.from(bufferBase64, 'base64');

  // uncompress
  let uncompressedBuffer;
  if (compressionAlgorithm) {
    if (compressionAlgorithm !== COMPRESSION_ALGORITHM) {
      throw new Error('Unsupported message compression algorithm');
    }
    uncompressedBuffer = await unzip(buffer, {
      // Prevent large uncompressed file
      maxOutputLength: maxUncompressedLength,
    });
  } else {
    uncompressedBuffer = buffer;
  }

  let data;

  // data URL
  if (metadata.base64_data_url) {
    data = `${metadata.data_url_prefix}${uncompressedBuffer.toString(
      'base64'
    )}`;
  } else {
    data = uncompressedBuffer.toString();
  }

  return data;
}
