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

import { redactedLogger } from '../../../logger';

const MAX_CAPTURE_BYTES = 1024 * 1024; // 1MB

export default function loggingHandler(req, res, next) {
  const { method, originalUrl, params, query, body } = req;

  redactedLogger.debug({
    message: 'Incoming HTTP request',
    method,
    originalUrl,
    params,
    query,
    body,
  });

  res._bodyCaptured = false;
  res._capturedBody = null;

  // --- TIER 1: Intercept res.json (Fast Track) ---
  const originalJson = res.json;
  res.json = function (obj) {
    if (!res._bodyCaptured) {
      res._capturedBody = obj;
      res._bodyCaptured = true;
    }
    return originalJson.call(this, obj);
  };

  // --- TIER 2: Intercept res.send ---
  const originalSend = res.send;
  res.send = function (body) {
    if (!res._bodyCaptured && body !== undefined) {
      if (Buffer.isBuffer(body)) {
        res._capturedBody = `[Binary Buffer Data, size: ${body.length} bytes]`;
      } else {
        res._capturedBody = body;
      }
      res._bodyCaptured = true;
    }
    return originalSend.apply(this, arguments);
  };

  // --- TIER 3: Low-Level Stream Sniffing (Fallback Track) ---
  const originalWrite = res.write;
  const originalEnd = res.end;

  const chunks = [];
  let totalBytes = 0;
  let isTruncated = false;

  res.write = function (chunk) {
    if (res._bodyCaptured || !chunk || isTruncated) {
      return originalWrite.apply(this, arguments);
    }

    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.length;

    if (totalBytes > MAX_CAPTURE_BYTES) {
      isTruncated = true;
      chunks.length = 0; // Free memory immediately
      res._capturedBody = '[Response body too large to log]';
      res._bodyCaptured = true;
    } else {
      chunks.push(buf);
    }

    return originalWrite.apply(this, arguments);
  };

  res.end = function (chunk) {
    if (!res._bodyCaptured && chunk && !isTruncated) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buf.length;
      if (totalBytes <= MAX_CAPTURE_BYTES) {
        chunks.push(buf);
      }
    }

    // Restore original methods
    res.write = originalWrite;
    res.end = originalEnd;
    const result = originalEnd.apply(this, arguments);

    // Finalize the body resolution
    let finalResBody = res._capturedBody;

    if (!res._bodyCaptured) {
      const contentType = res.getHeaders()['content-type'] || '';
      const responseBodyString = Buffer.concat(chunks).toString('utf8');

      if (contentType.includes('json') && responseBodyString) {
        try {
          finalResBody = JSON.parse(responseBodyString);
        } catch {
          finalResBody = responseBodyString;
        }
      } else {
        finalResBody = responseBodyString;
      }
    }

    const logPayload = {
      message: 'Outgoing HTTP response',
      method,
      originalUrl,
      status: res.statusCode,
    };

    if (
      finalResBody !== null &&
      finalResBody !== undefined &&
      finalResBody !== ''
    ) {
      logPayload.body = finalResBody;
    }

    redactedLogger.debug(logPayload);

    return result;
  };

  next();
}
