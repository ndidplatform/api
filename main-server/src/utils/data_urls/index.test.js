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

import { parseDataURL } from '.';

const chai = require('chai');
const assert = chai.assert;

// Some tests are modified from "data-urls" library
// https://github.com/jsdom/data-urls/blob/main/test/api.js

describe('Data URL parser', () => {
  describe('Smoke tests', () => {
    it('should parse no-type as expected', () => {
      const textExample = parseDataURL('data:,Hello%2C%20World!');
      assert.equal(textExample.mimeType, 'text/plain;charset=US-ASCII');
      assert.equal(textExample.buffer.constructor, Buffer);
      assert.deepEqual(
        textExample.buffer,
        Buffer.from(
          new Uint8Array([
            72, 101, 108, 108, 111, 44, 32, 87, 111, 114, 108, 100, 33,
          ])
        )
      );
    });

    it('should round-trip no-type as expected', () => {
      const textExample = parseDataURL('data:,H%E9llo!');
      assert.equal(textExample.mimeType, 'text/plain;charset=US-ASCII');
      assert.equal(textExample.buffer.constructor, Buffer);

      const encodingLabel = 'US-ASCII';

      const correctDecoder = new TextDecoder(encodingLabel);
      const bodyCorrectlyDecoded = correctDecoder.decode(textExample.buffer);
      assert.equal(bodyCorrectlyDecoded, 'Héllo!', 'correctly decoded');

      const incorrectDecoder = new TextDecoder('utf-8');
      const bodyIncorrectlyDecoded = incorrectDecoder.decode(
        textExample.buffer
      );
      assert.equal(bodyIncorrectlyDecoded, 'H�llo!', 'incorrectly decoded');
    });

    it('should parse text/html as expected', () => {
      const htmlExample = parseDataURL(
        'data:text/html,%3Ch1%3EHello%2C%20World!%3C%2Fh1%3E'
      );
      assert.equal(htmlExample.mimeType, 'text/html');
      assert.equal(htmlExample.buffer.constructor, Buffer);
      assert.deepEqual(
        htmlExample.buffer,
        Buffer.from(
          new Uint8Array([
            60, 104, 49, 62, 72, 101, 108, 108, 111, 44, 32, 87, 111, 114, 108,
            100, 33, 60, 47, 104, 49, 62,
          ])
        )
      );
    });

    it('should parse img/png base64 as expected', () => {
      const pngExample = parseDataURL(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=='
      );
      assert.equal(pngExample.mimeType.toString(), 'image/png');
      assert.equal(pngExample.buffer.constructor, Buffer);
      assert.deepEqual(
        pngExample.buffer,
        Buffer.from(
          new Uint8Array([
            137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0,
            0, 5, 0, 0, 0, 5, 8, 6, 0, 0, 0, 141, 111, 38, 229, 0, 0, 0, 28, 73,
            68, 65, 84, 8, 215, 99, 248, 255, 255, 63, 195, 127, 6, 32, 5, 195,
            32, 18, 132, 208, 49, 241, 130, 88, 205, 4, 0, 14, 245, 53, 203,
            209, 142, 14, 31, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
          ])
        )
      );
    });
  });

  describe('Additional coverage', () => {
    it('should return null for non-data: URLs', () => {
      assert.equal(parseDataURL('https://example.com/'), null);
    });
  });

  describe('Invalid Percent Encoding Hex Validation', () => {
    it('should treat non-hex characters after % literally rather than decoding fake bytes', () => {
      // '%:0' -> ':' (ASCII 58) is not a hex char, should remain raw '%:0'
      const res1 = parseDataURL('data:,%:0');
      assert.equal(res1.toString('utf-8'), '%:0');

      // '%`0' -> '`' (ASCII 96) is not a hex char, should remain raw '%`0'
      const res2 = parseDataURL('data:,%`0');
      assert.equal(res2.toString('utf-8'), '%`0');

      // '%G1' and '%1G' contain invalid hex digits
      const res3 = parseDataURL('data:,%G1%1G');
      assert.equal(res3.toString('utf-8'), '%G1%1G');
    });

    it('should correctly decode valid lowercase, uppercase, and digit hex combinations', () => {
      // %61 = 'a', %42 = 'B', %39 = '9'
      const res = parseDataURL('data:,%61%42%39');
      assert.equal(res.toString('utf-8'), 'aB9');
    });
  });

  describe('Percent-Encoded Base64 Payload Support', () => {
    it('should percent-decode base64 payloads prior to base64 decoding (%3D -> =)', () => {
      // 'SGVsbG8%3D' -> Base64 'SGVsbG8=' -> 'Hello'
      const res = parseDataURL('data:text/plain;base64,SGVsbG8%3D');
      assert.equal(res.toString('utf-8'), 'Hello');
    });

    it('should handle percent-encoded spaces and line breaks inside base64 strings (%20, %0A)', () => {
      // 'SGVs%20bG8=' -> Base64 'SGVs bG8=' -> decoded correctly
      const res = parseDataURL('data:text/plain;base64,SGVs%20bG8%3D');
      assert.equal(res.toString('utf-8'), 'Hello');
    });
  });

  describe('MIME Type Normalization & Parameter Parsing', () => {
    it('should prepend text/plain when parameters are passed without a primary type', () => {
      const res = parseDataURL('data:;charset=utf-8,hello');
      assert.equal(res.mimeType, 'text/plain;charset=utf-8');
    });

    it('should preserve parameters when stripping base64 token', () => {
      const res = parseDataURL('data:text/plain;charset=utf-8;base64,SGVsbG8=');
      assert.equal(res.mimeType, 'text/plain;charset=utf-8');
      assert.equal(res.toString(), 'Hello');
    });

    it('should handle base64 token in middle or start of parameter list', () => {
      const res = parseDataURL(
        'data:text/html;base64;charset=utf-8,PGgxPkhpPC9oMT4='
      );
      assert.equal(res.mimeType, 'text/html;charset=utf-8');
      assert.equal(res.toString(), '<h1>Hi</h1>');
    });
  });

  describe('Additional Edge Cases & Input Validation', () => {
    it('should return null for non-data URLs or invalid data URL structures', () => {
      assert.equal(parseDataURL('https://example.com/'), null);
      assert.equal(parseDataURL('data:missing-comma'), null);
      assert.equal(parseDataURL(''), null);
      assert.equal(parseDataURL(null), null);
      assert.equal(parseDataURL(123), null);
    });

    it('should correctly parse empty payload data URLs', () => {
      const res = parseDataURL('data:,');
      assert.equal(res.mimeType, 'text/plain;charset=US-ASCII');
      assert.equal(res.buffer.length, 0);
      assert.equal(res.toString('utf-8'), '');
    });

    it('should parse iso-8859-1 strings correctly using explicit charset', () => {
      const res = parseDataURL('data:text/plain;charset=iso-8859-1,H%E9llo!');
      assert.equal(res.mimeType, 'text/plain;charset=iso-8859-1');
      assert.equal(res.toString(), 'Héllo!');
    });
  });
});
