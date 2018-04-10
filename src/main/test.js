import * as rp from './rp';
import * as idp from './idp';
import * as share from './share';

async function run() {
  let requestId = await rp.createRequest({
    message: 'test message'
  });
  console.log('Create request with ID:',requestId);

  console.log('Get request',await share.getRequest({requestId}))

  await idp.createIdpResponse({
    requestId, status: 'accept'
  })
  console.log('IDP responsed');

  console.log('Get request',await share.getRequest({requestId}))
}

run();