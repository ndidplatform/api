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
import * as debugWorker from './debug';
import * as dpkiWoker from './dpki';

import * as config from '../config';
import coreMaster from '../master-worker-interface/server';

let exportElement = {
  debug: debugWorker, 
  dpki: dpkiWoker
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
    'registerOrUpdateASService',
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

  //All NDID operation is done by master
  for(let key in coreMaster.ndid) {
    coreMaster.ndid[key] = ndidWorker[key];
  }

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
export const as = exportElement.as;
export const rp = exportElement.rp;
export const idp = exportElement.idp;
export const ndid = exportElement.ndid;
export const identity = exportElement.identity;
export const proxy = exportElement.proxy;
export const common = exportElement.common;
export const debug = exportElement.debug;
export const dpki = exportElement.dpki;