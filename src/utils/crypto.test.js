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

import crypto from 'crypto';
import * as cryptoUtils from './crypto';

const chai = require('chai');
const expect = chai.expect;

describe('Test crypto functions', () => {
  it('should SHA-256 hash correctly', () => {
    // action
    const hashedBuffer = cryptoUtils.sha256('test');
    // return type is Buffer
    expect(hashedBuffer).to.be.instanceof(Buffer);
    expect(hashedBuffer.length).to.equal(32);

    const hashedBuffer2 = cryptoUtils.sha256('test2');
    expect(hashedBuffer2.length).to.equal(32);

    expect(hashedBuffer.equals(hashedBuffer2)).to.equal(false);
  });

  it('should encrypt with public key and decrypt with private key correctly', () => {
    const privateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEogIBAAKCAQEAs0uVwMOTYpU3P3Vd/tC6KwgmZeKyOn8WIMhyCxD3P5Z8nK2s
MRelkH/273ZuCvWEpFQJB6jWaug6za1FtWoA1sYea51Nk7dzt6jolJTG/od8Qed+
8WVird/A9plLgLWfvBtRX7yN+W2yCFkH9cbxIEGkprTfMSePlTS6u01p3tjsAzwA
UeGAi4KIs8Dvb9FEBtoXEXSHigiSwohRN2zt1bBSc3A9+CnzmLldPU0jgYXDKnMf
8WyrUA3seQ67qpPQMdav1cjgu0L5PGOFGC9/UD2i0AoPyO3Md0ouC9zyIiP2lq3o
ZUyNW+Zs4mfzZVE2oOdWq3GO2T47OXGw5g9wNQIDAQABAoIBAAMQZ57DuOEWa7tJ
5jFUn9ncacuT9DfLtDUbN9e4koEjsT18OlUcclfl1/J/s6G8UGf+h6j52bA6B8c8
DtTq2tjQyfRM2+aKXA/ncxIW+M+gwR7fNewqL2WJTWLpe8DXWcN9NAbO0h5RIZnC
67/nhndmp8mxjZ7pbiq+m/JXgFeulgbq0udaumCxztnkK6CONfc9z5f5IiyOaSUD
agVP/tuw/3hswLw9ahZx2Qk1Bt+itEuD90aYYtsHiIqNoiogBQ4dbpF5Qx0hY4xe
vgQx2rpzudU8WcUKSlKqxh9X6399ZjB1OO6RnaAdeUKWLGE6nQCISUmP2n4dT2Cx
PlZm0AECgYEA2ujmUhETo6H9G8oIiecBbRvobWGKiNYueVY2yFbj9qukHoEi6ktU
H0Ou/4PheV6ssi+uINUhPFMQsDaCWAgRMKSImp30sP0AEqJYUdf0zmqMPH1kgrU0
PRpU1uD4E+sBwcjZ1epiln84qw9hYBFCIhewLIgj1D1nE0MQyXQNXFUCgYEA0axt
CS8PS6w4urIsKfCezltzwfcP53WL/wpcuhUaTEOuORtk1UbbsokrZis8GnEdp1RP
VHfM7jUg/ZyQy+snYc6Qq2k9MfBuoaDVoEs67+m0E9E7uKUVIlgi39OR7s6zMaL9
z8j1zjzieKrtNjU0DlTOhSTfFoB0/IiFsn91pGECgYA8n0SxM2Nx7DkwyelFb0CY
26KpL9ryfAXQukxffJiSxgOkIvTtV0ELi23Z+salGs/OZJ/fHcafcw1rDx1XjZxd
ESN3VgjePqIXhvfYamq0AxOk6MC95bp6tWELRK/OrEUHSjzxHYCB1ud1j8PSm9Tp
pg+2tVjevMZfsjHi6A2PJQKBgCrrN5qEpoXf5/DXXdDr7yXgdG6Eyx2e4xw+m8J/
ZVWtGPGZmOdLTNdb2qVcPj5PXzmMOXzZ1PoBqBIhxUXoibQsm1JrBVq+k3bEPFZG
b/cCCJlx396o9A2GqwTUAvA2IVoMuhWZVi90KQt4OXw6IcC5PVjltkCd5NR4gZ2L
F6KhAoGAYuIX+UXazF8xAJ1YMbfbYbNK5CcFV0T4XezKinO/wINheDmc8wt9oD4R
atXY1kMK6l266egFWG+HR5nX2Op4EHe6V/yK9vgtroT/YMCflNVoexk5SkQl6Bs8
Sdq+nlVNj4nJZVv06SWvZuNy7S3xQMvaIKXRUxZ5AaT/6Y9yNhM=
-----END RSA PRIVATE KEY-----`;

    const publicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAs0uVwMOTYpU3P3Vd/tC6
KwgmZeKyOn8WIMhyCxD3P5Z8nK2sMRelkH/273ZuCvWEpFQJB6jWaug6za1FtWoA
1sYea51Nk7dzt6jolJTG/od8Qed+8WVird/A9plLgLWfvBtRX7yN+W2yCFkH9cbx
IEGkprTfMSePlTS6u01p3tjsAzwAUeGAi4KIs8Dvb9FEBtoXEXSHigiSwohRN2zt
1bBSc3A9+CnzmLldPU0jgYXDKnMf8WyrUA3seQ67qpPQMdav1cjgu0L5PGOFGC9/
UD2i0AoPyO3Md0ouC9zyIiP2lq3oZUyNW+Zs4mfzZVE2oOdWq3GO2T47OXGw5g9w
NQIDAQAB
-----END PUBLIC KEY-----`;

    const encryptedMessage = cryptoUtils.publicEncrypt(publicKey, 'test');

    expect(encryptedMessage).to.be.a('string');

    const decryptedMessage = cryptoUtils.privateDecrypt(
      privateKey,
      encryptedMessage
    );

    expect(decryptedMessage).to.be.instanceof(Buffer);
    const decryptedMessageStr = decryptedMessage.toString('utf8');
    expect(decryptedMessageStr).to.equal('test');
  });

  it('should encrypt and decrypt AES256-GCM correctly', () => {
    const message = 'test';
    const symKeyBuffer = crypto.randomBytes(32);
    const encryptedMessage = cryptoUtils.encryptAES256GCM(
      symKeyBuffer,
      message,
      false
    );
    const decryptedMessage = cryptoUtils.decryptAES256GCM(
      symKeyBuffer,
      encryptedMessage,
      false
    );
    expect(decryptedMessage).to.be.a('string');
    expect(decryptedMessage).to.equal('test');
  });
});
