const chai = require('chai');
const expect = chai.expect;
const chaiHttp = require('chai-http');

chai.use(chaiHttp);

const server = require('../server');

// TODO

it('should POST a new request', async () => {
  const res = await chai
    .request(server)
    .post('/rp/requests/someNamespace/someIdentifier')
    .send({
      reference_number: 'ref12345',
      // idp_list,
      callback_url: 'http://test/cb',
      // as_service_list,
      request_message: 'test message',
      // min_ial,
      // min_aal,
      // min_idp,
      request_timeout: 24 * 60 * 60,
    });
  expect(res).to.have.status(200);
});