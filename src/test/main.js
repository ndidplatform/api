import * as rp from '../core/rp';
import * as idp from '../core/idp';
import * as common from '../core/common';

const chai = require('chai');
const expect = chai.expect;

// TODO

describe('Identity proof flow', () => {
  it('should have no error', async () => {
    let requestId = await rp.createRequest({
      message: 'test message',
      namespace: 'cid',
      identifier: '1234567890123',
    });
    expect(requestId).to.be.a('string');

    const request1 = await common.getRequest({ requestId });

    expect(request1).to.be.an('object');
    expect(request1).to.have.property('status', 'pending');

    await idp.createIdpResponse({
      requestId,
      status: 'accept',
    });
    // console.log('IDP responded');

    const request2 = await common.getRequest({ requestId });

    expect(request2).to.be.an('object');
    expect(request2).to.have.property('status', 'completed');
  });
});