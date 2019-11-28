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
import * as utils from '.';

const chai = require('chai');
const expect = chai.expect;

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

const privateKey2 = `-----BEGIN RSA PRIVATE KEY-----
MIIEpQIBAAKCAQEAvIVvTX5LlDTwauqbjVGFOhhArFAEToHNDWyEkN5j1ZxE8Ers
Mzi87/MPYsGXYdIxcYfWgnP5XvF7kiPB5z3gTmYVlL0ELUHxV9vBaZk/5Q6qccUX
potPB4DCWwpRtWMRb5uVwIM64l9mm67YaYKjDILHwgia2756KjAsAr4B5sJGbyA+
m1xzgx0zuKyPhUXnK22Jn1dWoa22CjOJFH6fwxNQw2TWJgKSDb6ugT4sjrdXsUci
LLcHxi68X6CmWhzN5eSp0l1dnfufVT01C1WAC1QkMQdBg9Sy+OYzjwmNs3InPchQ
TUtPxdYy1qWuuNJ9HxT1wVxHNDwDMeV2tATpZwIDAQABAoIBAQCmqYhWh/qlEZAh
1TqjWphfXaV/MFY+WX5ACdnAgPrdk4NWs8XRGq3dq5HEisUcE8jmR2KafZDOIMpP
zhDUL92nMZSOo/OXVx7Xv01j37me9LI2VjmsYKgDSA+KkLrfkq+NbYycXuelzRVX
OOHVlUoz+0JCBX1yGxjBR0kBO51OtJhN4dMpmh5NoIIGoUMzXiy2jqyL7kWdt2Gy
AwvUaSlVZ7+xSB6xp2nfBurjksRoVyKJcWlGYtFoMCHlN7cXdjsS6/g7CWsN4Vx8
zcN8q+zeEVXOKf1jml2xr93wbOUFhMMLh10klV3I+pAsVG1LY9V7KlkTaABDI9W9
2MPd1XQhAoGBAOvBIsMbtQMJG0Sw7m8Iq0O1k3WmYag8q8/JK/jDlZ05kwYCHMll
aMUnoWnVv0u2g0f3YmZJBJMP3VG0zQrrMe4YPq65bM58AV24i6lwpZVbESqjFTPR
iiLk7aiDN+mIPpeDtnYKWvE6hjbsx1RfdJ0ylBkD7tMiOjO+WF+szmAfAoGBAMy1
6poWDgCcFqGu+lNVDWDRKuoQisgZ/oj9m8m5TDTsYfwnZOljNeZbPucBB+D/q+xO
BSLcBG3b6a2p6MU+smBwXCs6cULhjcMuD8X4joYNa7SMXVZJH3Dx5a/DQ2BXu2/p
iBkTSZPY/0v9pKhYddiBUdtl1sZNf18yKeeEhC25AoGBAKDb9kkkZZz9oLJ8+yOd
yaX4hfYXobi2NREhFbS2VyahOzU1SckNPbCQeu2I3+7cSLVZEbXzCoEBqSRv9hwG
INpxhouXj6tQJ2p4Wisx5nmDWrI59mSWC+gFRjfd2M+qm/Kr91qRdD32jc96PgPO
4fXEphJvgYxkZUwbC5e0hFhHAoGBALmBvPgnNkctK4EXLLdpYrcytT3pAaq1i6ie
kZdq+HkZIO480MCCbCy00TrK/1XQuv5n8VWWpdjcKVV7nHlqCIFGMO/nhQ3DkhCm
ZBrV1Gn8LXcun8J6fyh9vNPbEepzdmLC8NcwWEPHqAo37wezKg+pmQFFtyx6vAsL
TVgFCTbZAoGAe6YqrYAcbO7UueOGUFqI/TpWCbPhOwudhst61cFA95Ft+FeNMlsk
btNSAoLFz9Ir9QNUBkZ2s4l2HElCLURQQehRo80UfEEAob3kWN8LgcEw4gANCKSU
Dm0+FxMh7MdwXDtje3WyQUAyjHN1eGWKDTDgiebJKuX+0Zv/XzYiXiU=
-----END RSA PRIVATE KEY-----`;

const publicKey2 = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvIVvTX5LlDTwauqbjVGF
OhhArFAEToHNDWyEkN5j1ZxE8ErsMzi87/MPYsGXYdIxcYfWgnP5XvF7kiPB5z3g
TmYVlL0ELUHxV9vBaZk/5Q6qccUXpotPB4DCWwpRtWMRb5uVwIM64l9mm67YaYKj
DILHwgia2756KjAsAr4B5sJGbyA+m1xzgx0zuKyPhUXnK22Jn1dWoa22CjOJFH6f
wxNQw2TWJgKSDb6ugT4sjrdXsUciLLcHxi68X6CmWhzN5eSp0l1dnfufVT01C1WA
C1QkMQdBg9Sy+OYzjwmNs3InPchQTUtPxdYy1qWuuNJ9HxT1wVxHNDwDMeV2tATp
ZwIDAQAB
-----END PUBLIC KEY-----`;

describe('Test hash with custom padding for accessor encrypt (request response signature)', () => {
  it('should create hash correctly', () => {
    const requestId = '8a1cef0f345655c1597c2158b7d25a6866c4baf9d3e543dd3abc4982e3905f04';
    const requestMessage = 'test';
    const initialSalt = 'd9UV7tfs38e+s/5RAtcAfw==';

    const requestMessageForConsentHash = utils.hashRequestMessageForConsent(
      requestMessage,
      initialSalt,
      requestId,
      publicKey
    );

    const expectedRequestMessageForConsentHash = 'A/nQfv5vp/BVym2F2J36n9NEJjPIMMgYUQrl1cKTi5h1+iV1bnwNU5mfksEdPGIC6uNfW5eIrtzfTN9pFGDE/myQL/PBBfFMiCMmf6CBV2S0z6HjSbnqS4HVnf+O6KLpvJYwLitdQr/Z/TPFQV+j4ZoOXvwlHffrRj9F2UXK63Xx3BgqlpvwXX7IpFluYYFC+UXRCh9PggOdewc4vXXi4GEHqc5Jv3Q7VMjdaaQv0iZHD/MBYRnHrenBUeLh7RD1+mwRpUVcgH/sKILscWuaXrZ1wn6G/1j0CFPQFWHYQhxkEXOdLfeV3wOktaOWikNzEzV5ByDNoOKI13uJo9Fi5g==';

    // return type is Buffer
    expect(requestMessageForConsentHash).to.be.equals(expectedRequestMessageForConsentHash);
    const requestMessageForConsentHashBuffer = Buffer.from(
      requestMessageForConsentHash,
      'base64'
    );
    expect(requestMessageForConsentHashBuffer).to.have.lengthOf.at.most(256);
  });

  it('should create hash then sign and verify correctly', () => {
    const requestId = utils.createRequestId();
    const requestMessage = 'test';
    const initialSalt = crypto.randomBytes(16).toString('base64');

    const requestMessageForConsentHash = utils.hashRequestMessageForConsent(
      requestMessage,
      initialSalt,
      requestId,
      publicKey
    );
    // return type is Buffer
    expect(requestMessageForConsentHash).to.be.a('string');
    const requestMessageForConsentHashBuffer = Buffer.from(
      requestMessageForConsentHash,
      'base64'
    );
    expect(requestMessageForConsentHashBuffer).to.have.lengthOf.at.most(256);

    const signature = crypto
      .privateEncrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_NO_PADDING,
        },
        Buffer.from(requestMessageForConsentHash, 'base64')
      )
      .toString('base64');

    const valid = utils.verifyResponseSignature(
      signature,
      publicKey,
      requestMessage,
      initialSalt,
      requestId
    );

    expect(valid).to.be.true;
  });

  it('should verify invalid signature correctly', () => {
    const requestId = utils.createRequestId();
    const requestMessage = 'test';
    const initialSalt = crypto.randomBytes(16).toString('base64');

    const requestMessageForConsentHash = utils.hashRequestMessageForConsent(
      requestMessage,
      initialSalt,
      requestId,
      publicKey
    );

    const requestMessageForConsentHash2 = utils.hashRequestMessageForConsent(
      requestMessage,
      initialSalt,
      requestId,
      publicKey2
    );

    expect(requestMessageForConsentHash).to.be.a('string');
    const requestMessageForConsentHashBuffer = Buffer.from(
      requestMessageForConsentHash,
      'base64'
    );
    expect(requestMessageForConsentHashBuffer).to.have.lengthOf.at.most(256);

    const signature = crypto
      .privateEncrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_NO_PADDING,
        },
        Buffer.from(requestMessageForConsentHash, 'base64')
      )
      .toString('base64');

    const signature2 = crypto
      .privateEncrypt(
        {
          key: privateKey2,
          padding: crypto.constants.RSA_NO_PADDING,
        },
        Buffer.from(requestMessageForConsentHash2, 'base64')
      )
      .toString('base64');

    const signature3 = crypto
      .privateEncrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_NO_PADDING,
        },
        Buffer.from(requestMessageForConsentHash, 'base64')
      )
      .toString('base64');

    let valid;

    valid = utils.verifyResponseSignature(
      signature2,
      publicKey,
      requestId,
      initialSalt,
      requestId
    );
    expect(valid).to.be.false;

    valid = utils.verifyResponseSignature(
      signature3,
      publicKey,
      requestId,
      initialSalt,
      requestId
    );
    expect(valid).to.be.false;

    valid = utils.verifyResponseSignature(
      signature,
      publicKey2,
      requestMessage,
      initialSalt,
      requestId
    );
    expect(valid).to.be.false;

    valid = utils.verifyResponseSignature(
      signature,
      publicKey,
      'some_string',
      initialSalt,
      requestId
    );
    expect(valid).to.be.false;

    valid = utils.verifyResponseSignature(
      signature,
      publicKey,
      requestMessage,
      'some_string',
      requestId
    );
    expect(valid).to.be.false;

    valid = utils.verifyResponseSignature(
      signature,
      publicKey,
      requestMessage,
      initialSalt,
      'some_string'
    );
    expect(valid).to.be.false;
  });
});
