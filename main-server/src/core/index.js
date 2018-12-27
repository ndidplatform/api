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

import * as asWorker from './as';
import * as commonWorker from './common';
import * as identityWorker from './identity';
import * as ndidWorker from './ndid';
import * as proxyWorker from './proxy';
import * as idpWorker from './idp';
import * as rpWorker from './rp';
import * as debug from './debug';
import * as dpki from './dpki';

import * as config from '../config';
import * as coreMaster from './master-worker-interface';

let exportElement = {
  debug, dpki
};

if(config.isMaster) {
  // some function cannot be delegated (it set internal memory)
  // eg. isMqAddressesSet, setMessageQueueAddress in common
  let commonKeys = [
    'isMqAddressesSet',
    'setMessageQueueAddress',
    'readCallbackUrlsFromFiles',
    'initialize',
    'getFunction',
    'resumeTimeoutScheduler',
    'stopAllTimeoutScheduler',
    'timeoutRequest',
    'runTimeoutScheduler',
    'setTimeoutScheduler',
    'removeTimeoutScheduler',
    'incrementProcessingInboundMessagesCount',
    'decrementProcessingInboundMessagesCount',
    'getProcessingInboundMessagesCount'
  ];

  let asKeys = [
    'readCallbackUrlsFromFiles',
    'setCallbackUrls',
    'getCallbackUrls',
    'getErrorCallbackUrl',
    'setServiceCallbackUrl',
    'getServiceCallbackUrl',
  ];

  let idpKeys = [
    'readCallbackUrlsFromFiles',
    'setCallbackUrls',
    'getCallbackUrls',
    'getErrorCallbackUrl',
    'isAccessorSignUrlSet',
  ];

  let rpKeys = [
    'readCallbackUrlsFromFiles',
    'setCallbackUrls',
    'getCallbackUrls',
    'getErrorCallbackUrl',
  ];

  commonKeys.forEach((key) => {
    coreMaster.common[key] = commonWorker[key];
  });

  asKeys.forEach((key) => {
    coreMaster.as[key] = asWorker[key];
  });

  idpKeys.forEach((key) => {
    coreMaster.idp[key] = idpWorker[key];
  });

  rpKeys.forEach((key) => {
    coreMaster.rp[key] = rpWorker[key];
  });

  exportElement = {
    ...coreMaster,
    ...exportElement
  };
}
else {
  exportElement = {
    as: asWorker,
    common: commonWorker,
    identity: identityWorker,
    ndid: ndidWorker,
    proxy: proxyWorker,
    idp: idpWorker,
    rp: rpWorker,
    ...exportElement,
  };
}

export default exportElement;