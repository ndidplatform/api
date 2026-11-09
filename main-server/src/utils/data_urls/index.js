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

// Lookup table for ASCII hex characters (0-9, A-F, a-f) -> 0-15 (-1 for invalid)
const HEX_MAP = new Int8Array(256).fill(-1);
for (let i = 0; i <= 9; i++) HEX_MAP[48 + i] = i; // '0'-'9'
for (let i = 0; i < 6; i++) {
  HEX_MAP[65 + i] = 10 + i; // 'A'-'F'
  HEX_MAP[97 + i] = 10 + i; // 'a'-'f'
}

function decodePercentEncodedToBuffer(str, startIdx, endIdx) {
  const len = endIdx - startIdx;
  const out = Buffer.allocUnsafe(len);
  let outIdx = 0;

  for (let i = startIdx; i < endIdx; i++) {
    const code = str.charCodeAt(i);

    if (code === 0x25 /* '%' */ && i + 2 < endIdx) {
      const h = HEX_MAP[str.charCodeAt(i + 1)];
      const l = HEX_MAP[str.charCodeAt(i + 2)];

      if (h !== -1 && l !== -1) {
        out[outIdx++] = (h << 4) | l;
        i += 2;
        continue;
      }
    }
    out[outIdx++] = code;
  }

  return out.subarray(0, outIdx);
}

/**
 * Decodes base64 payload, stripping percent-encodings (%3D -> =) on the fly
 */
function decodeBase64ToBuffer(str, startIdx, endIdx) {
  // Fast path: check if string contains '%' without regex
  const percentIdx = str.indexOf('%', startIdx);
  if (percentIdx === -1 || percentIdx >= endIdx) {
    return Buffer.from(str.slice(startIdx, endIdx), 'base64');
  }

  // Slow path: percent-encoded base64 payload
  const rawBuf = decodePercentEncodedToBuffer(str, startIdx, endIdx);
  return Buffer.from(rawBuf.toString('latin1'), 'base64');
}

export function parseDataURL(dataUrlString) {
  if (typeof dataUrlString !== 'string' || !dataUrlString.startsWith('data:')) {
    return null;
  }

  const commaIndex = dataUrlString.indexOf(',');
  if (commaIndex === -1) return null;

  const meta = dataUrlString.substring(5, commaIndex);

  let isBase64 = false;
  let charset = null;
  const metaParts = meta.split(';');
  const filteredParts = [];

  for (let i = 0; i < metaParts.length; i++) {
    const part = metaParts[i];
    const partLower = part.toLowerCase();

    if (partLower === 'base64') {
      isBase64 = true;
    } else {
      if (partLower.startsWith('charset=')) {
        charset = part.substring(8);
      }
      filteredParts.push(part);
    }
  }

  // Reconstruct MIME type
  let mimeType = filteredParts.join(';');
  if (!mimeType || mimeType.startsWith(';')) {
    mimeType = 'text/plain' + (mimeType || ';charset=US-ASCII');
  }

  // Determine Encoding
  let finalEncoding = 'ascii'; // Default RFC 2397 fallback
  if (charset) {
    const cs = charset.toLowerCase();
    if (cs === 'iso-8859-1' || cs === 'latin1' || cs === 'windows-1252') {
      finalEncoding = 'latin1';
    } else if (cs === 'ascii' || cs === 'us-ascii') {
      finalEncoding = 'ascii';
    } else {
      finalEncoding = 'utf-8';
    }
  }

  // Zero-copy Slice to Buffer
  const buffer = isBase64
    ? decodeBase64ToBuffer(dataUrlString, commaIndex + 1, dataUrlString.length)
    : decodePercentEncodedToBuffer(
        dataUrlString,
        commaIndex + 1,
        dataUrlString.length
      );

  return {
    mimeType,
    buffer,
    toString: (encoding) => buffer.toString(encoding || finalEncoding),
    //
    meta,
    isBase64,
  };
}
