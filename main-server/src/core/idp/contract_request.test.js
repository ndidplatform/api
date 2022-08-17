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

import express from 'express';
import * as cryptoUtils from '../../utils/crypto';

// file server

/*
{
  '9d1fef01b78f395f3b3551a41b80330038dbfb0b4879c6cb34e93659315877e4': <Buffer 64 63 6f 6e 74 72 61 63 74 20 74 65 73 74 31>,
  'c94192554f552f60646ce91a337c3b8519b09c91e8366966b8a75f0431d9872c': <Buffer 64 63 6f 6e 74 72 61 63 74 20 74 65 73 74 32>,
  'dd70ea42bf138777da3af75663003144cedb1d7900793b29f122d39d9b1e63d7': <Buffer 64 63 6f 6e 74 72 61 63 74 20 74 65 73 74 33>,
  'd44d485b40467623635d205e1a254d286eecf770f5617b53d286282c21546b2e': <Buffer 64 63 6f 6e 74 72 61 63 74 20 74 65 73 74 34>,
  '58cd2090e9fe339c1a9773ffa12d3eafcce440600f0613306c7e8c88de928de5': <Buffer 64 63 6f 6e 74 72 61 63 74 20 74 65 73 74 35>
}
*/

const testData = [
  Buffer.from(`dcontract test1`),
  Buffer.from(`dcontract test2`),
  Buffer.from(`dcontract test3`),
  Buffer.from(`dcontract test4`),
  Buffer.from(`dcontract test5`),
];

const testDataWithHash = {};
const testDataWithHashArr = testData.map((data) => {
  const hash = cryptoUtils.sha256(data);

  const hashHex = hash.toString('hex');

  testDataWithHash[hashHex] = data;

  return {
    data,
    hashHex,
  };
});

const fileServerPort = 3010;

let server;
const app = express();

app.get('/dcontract/:dcontract_hash', async function (req, res) {
  const { dcontract_hash } = req.params;

  const data = testDataWithHash[dcontract_hash];

  if (data == null) {
    res.status(404).end();
    return;
  }

  const fileName = `${dcontract_hash}.txt`;
  const fileType = 'text/plain';

  res.set('Content-disposition', 'attachment; filename=' + fileName);
  res.set('Content-Type', fileType);

  res.status(200).end(data);
});

app.get('/no_res_body', async function (req, res) {
  res.status(200).end();
});

//

const chai = require('chai');
const expect = chai.expect;
const rewire = require('rewire');

const contractRequest = rewire('./contract_request.js');

const extractURLFromRequestMessage = contractRequest.__get__(
  'extractURLFromRequestMessage'
);
const checkContractHash = contractRequest.__get__('checkContractHash');

const defaultLogger = console;

describe('Test dcontract functions', function () {
  before(function () {
    server = app.listen(fileServerPort);
  });

  describe('Request Message Extraction', function () {
    it('single value', function () {
      const message = `: ท่านกำลังยืนยันตัวตนและลงนามสัญญาด้วยลายมือชื่ออิเล็กทรอนิกส์ [ธนาคาร B จำกัด (มหาชน)] ที่ท่านเลือก (Ref:477701) สามารถอ่านสัญญาได้ที่
https://example.com/78e6bf906d2586f00a9a6d945caef729272daf7c5de7c96631590821c7889abb`;
      const result = extractURLFromRequestMessage(message);
      expect(result.length).to.be.equal(1);
      expect(result[0]).to.be.equal(
        'https://example.com/78e6bf906d2586f00a9a6d945caef729272daf7c5de7c96631590821c7889abb'
      );
    });
    it('multiple value', function () {
      const message = `: ท่านกำลังยืนยันตัวตนและลงนามสัญญาด้วยลายมือชื่ออิเล็กทรอนิกส์ [ธนาคารเกียรตินาคินภัทร จำกัด (มหาชน)] ที่ท่านเลือก (Ref:477701) สามารถอ่านสัญญาได้ที่
https://example.com/78e6bf906d2586f00a9a6d945caef729272daf7c5de7c96631590821c7889abb
      
https://example.com/46eca8c06c993311439151404d2360ded2322c3dbbe49d91d6e9330ed78c6260
      
https://example.com/18c3ffddedab9a36f5300db4c597b2a88e35693f178820e2123941d674c4f480
      
      
      
      `;
      const result = extractURLFromRequestMessage(message);
      expect(result.length).to.be.equal(3);
      expect(result[0]).to.be.equal(
        'https://example.com/78e6bf906d2586f00a9a6d945caef729272daf7c5de7c96631590821c7889abb'
      );
      expect(result[1]).to.be.equal(
        'https://example.com/46eca8c06c993311439151404d2360ded2322c3dbbe49d91d6e9330ed78c6260'
      );
      expect(result[2]).to.be.equal(
        'https://example.com/18c3ffddedab9a36f5300db4c597b2a88e35693f178820e2123941d674c4f480'
      );
    });

    it('invalid value: without http', function () {
      const message =
        ': ท่านกำลังยืนยันตัวตนและลงนามสัญญาด้วยลายมือชื่ออิเล็กทรอนิกส์ [ธนาคาร ฺB จำกัด (มหาชน)] ที่ท่านเลือก (Ref:477701) สามารถอ่านสัญญาได้ที่';
      const result = extractURLFromRequestMessage(message);
      expect(result.length).to.be.equal(0);
    });

    it('invalid value: hacker message', function () {
      const message =
        'ยินดีด้วยคะ เงินเดือนของคุณ 20,000 บาท เข้าบัญชียูสเซอร์ของคุณแล้วเสร็จงานภารกิจถอนเงินสดเข้าบัญชีได้ทันที กรุณากดที่ http://tinyurl/xxxx';
      const result = extractURLFromRequestMessage(message);
      expect(result.length).to.be.equal(0);
    });

    it('invalid value: empty message', function () {
      const message = '';
      const result = extractURLFromRequestMessage(message);
      expect(result.length).to.be.equal(0);
    });

    it('invalid value: non-string', function () {
      const message = false;
      const result = extractURLFromRequestMessage(message);
      expect(result.length).to.be.equal(0);
    });
  });

  describe('Validate Request Message', function () {
    it('one contract', async function () {
      const message = `: ท่านกำลังยืนยันตัวตนและลงนามสัญญาด้วยลายมือชื่ออิเล็กทรอนิกส์ [ธนาคาร B จำกัด (มหาชน)] ที่ท่านเลือก (Ref:477701) สามารถอ่านสัญญาได้ที่
http://localhost:${fileServerPort}/dcontract/${testDataWithHashArr[0].hashHex}`;
      const result = await checkContractHash(message, {
        logger: defaultLogger,
      });
      expect(result).to.be.equal(true);
    });

    it('multiple contracts', async function () {
      const message = `: ท่านกำลังยืนยันตัวตนและลงนามสัญญาด้วยลายมือชื่ออิเล็กทรอนิกส์ [ธนาคาร B จำกัด (มหาชน)] ที่ท่านเลือก (Ref:477701) สามารถอ่านสัญญาได้ที่
http://localhost:${fileServerPort}/dcontract/${testDataWithHashArr[0].hashHex}
http://localhost:${fileServerPort}/dcontract/${testDataWithHashArr[1].hashHex}
http://localhost:${fileServerPort}/dcontract/${testDataWithHashArr[2].hashHex}
    `;
      const result = await checkContractHash(message, {
        logger: defaultLogger,
      });
      expect(result).to.be.equal(true);
    });

    it('no response body', async function () {
      const message = `: ท่านกำลังยืนยันตัวตนและลงนามสัญญาด้วยลายมือชื่ออิเล็กทรอนิกส์ [ธนาคาร B จำกัด (มหาชน)] ที่ท่านเลือก (Ref:477701) สามารถอ่านสัญญาได้ที่
http://localhost:${fileServerPort}/no_res_body`;
      const result = await checkContractHash(message);
      expect(result).to.be.equal(false);
    });

    it('URL Not found', async function () {
      const message = `: ท่านกำลังยืนยันตัวตนและลงนามสัญญาด้วยลายมือชื่ออิเล็กทรอนิกส์ [ธนาคาร B จำกัด (มหาชน)] ที่ท่านเลือก (Ref:477701) สามารถอ่านสัญญาได้ที่
http://localhost:3010/file/26ac627c6f6094bfa7e19f97`;
      const result = await checkContractHash(message, {
        logger: defaultLogger,
      });
      expect(result).to.be.equal(false);
    });

    it('Invalid Hash Message', async function () {
      const message = `: ท่านกำลังยืนยันตัวตนและลงนามสัญญาด้วยลายมือชื่ออิเล็กทรอนิกส์ [ธนาคาร B จำกัด (มหาชน)] ที่ท่านเลือก (Ref:477701) สามารถอ่านสัญญาได้ที่
http://localhost:3010/file/26ac627c6f6094bfa7e19f970d9a53b0d881c663f577b3128abbc758357f01ff`;
      const result = await checkContractHash(message);
      expect(result).to.be.equal(false);
    });

    it('Invalid format request message', async function () {
      const message =
        'ยินดีด้วยคะ เงินเดือนของคุณ 20,000 บาท เข้าบัญชียูสเซอร์ของคุณแล้วเสร็จงานภารกิจถอนเงินสดเข้าบัญชีได้ทันที กรุณากดที่ http://tinyurl/xxxx';
      const result = await checkContractHash(message);
      expect(result).to.be.equal(false);
    });

    it('Host not found', async function () {
      const message = `: ท่านกำลังยืนยันตัวตนและลงนามสัญญาด้วยลายมือชื่ออิเล็กทรอนิกส์ [ธนาคาร B จำกัด (มหาชน)] ที่ท่านเลือก (Ref:477701) สามารถอ่านสัญญาได้ที่
http://localhost23:3010/file/26ac627c6f6094bfa7e19f970d9a53b0d881c663f577b3128abbc758357f01ff`;
      const result = await checkContractHash(message, {
        logger: defaultLogger,
      });
      expect(result).to.be.equal(false);
    });

    it('Host reject', async function () {
      const message = `: ท่านกำลังยืนยันตัวตนและลงนามสัญญาด้วยลายมือชื่ออิเล็กทรอนิกส์ [ธนาคาร B จำกัด (มหาชน)] ที่ท่านเลือก (Ref:477701) สามารถอ่านสัญญาได้ที่
http://localhost:3011/file/26ac627c6f6094bfa7e19f970d9a53b0d881c663f577b3128abbc758357f01ff`;
      const result = await checkContractHash(message, {
        logger: defaultLogger,
      });
      expect(result).to.be.equal(false);
    });

    it('Host timeout', async function () {
      this.timeout(5000);

      const message = `: ท่านกำลังยืนยันตัวตนและลงนามสัญญาด้วยลายมือชื่ออิเล็กทรอนิกส์ [ธนาคาร B จำกัด (มหาชน)] ที่ท่านเลือก (Ref:477701) สามารถอ่านสัญญาได้ที่
http://10.255.255.1:5000/file/26ac627c6f6094bfa7e19f970d9a53b0d881c663f577b3128abbc758357f01ff`;
      const result = await checkContractHash(message, {
        logger: defaultLogger,
        timeout: 2000,
      });
      expect(result).to.be.equal(false);
    });
  });

  after(function () {
    server.close();
  });
});
