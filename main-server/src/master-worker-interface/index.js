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

// import gRPC client

// import worker
import * as asWorker from '../core/as';
import * as commonWorker from '../core/common';
import * as identityWorker from '../core/identity';
import * as ndidWorker from '../core/ndid';
import * as proxyWorker from '../core/proxy';
import * as idpWorker from '../core/idp';
import * as rpWorker from '../core/rp';

let as = {}, 
  common = {}, 
  identity = {},
  ndid = {},
  proxy = {},
  idp = {},
  rp = {};

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
  common[key] = commonWorker[key];
});

asKeys.forEach((key) => {
  as[key] = asWorker[key];
});

idpKeys.forEach((key) => {
  idp[key] = idpWorker[key];
});

rpKeys.forEach((key) => {
  rp[key] = rpWorker[key];
});

export default {
  as,
  common,
  identity,
  ndid,
  proxy,
  idp,
  rp,
};