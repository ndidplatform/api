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

import * as common from './core/common';
import * as rp from './core/rp';
import * as idp from './core/idp';
import * as as from './core/as';
import * as identity from './core/identity';
import * as mq from './mq';
import * as callback from './utils/callback';

import CustomError from 'ndid-error/custom_error';

export function getFunction(fnName) {
  switch (fnName) {
    // Core module
    case 'common.createRequestInternalAsyncAfterBlockchain':
      return common.createRequestInternalAsyncAfterBlockchain;
    case 'common.closeRequestInternalAsyncAfterBlockchain':
      return common.closeRequestInternalAsyncAfterBlockchain;
    case 'common.isRequestClosedOrTimedOut':
      return common.isRequestClosedOrTimedOut;
    case 'common.timeoutRequestAfterBlockchain':
      return common.timeoutRequestAfterBlockchain;
    case 'common.handleRequestTimeoutWorkerLost':
      return common.handleRequestTimeoutWorkerLost;
    case 'idp.requestChallengeAfterBlockchain':
      return idp.requestChallengeAfterBlockchain;
    case 'idp.createResponseAfterBlockchain':
      return idp.createResponseAfterBlockchain;
    case 'idp.processIdpResponseAfterAddAccessor':
      return idp.processIdpResponseAfterAddAccessor;
    case 'as.afterGotDataFromCallback':
      return as.afterGotDataFromCallback;
    case 'as.registerOrUpdateASServiceInternalAsyncAfterBlockchain':
      return as.registerOrUpdateASServiceInternalAsyncAfterBlockchain;
    case 'as.processDataForRPInternalAsyncAfterBlockchain':
      return as.processDataForRPInternalAsyncAfterBlockchain;
    case 'identity.updateIalInternalAsyncAfterBlockchain':
      return identity.updateIalInternalAsyncAfterBlockchain;
    case 'identity.createIdentityInternalAsyncAfterCreateRequestBlockchain':
      return identity.createIdentityInternalAsyncAfterCreateRequestBlockchain;
    case 'identity.createIdentityInternalAsyncAfterBlockchain':
      return identity.createIdentityInternalAsyncAfterBlockchain;
    case 'identity.createIdentityInternalAsyncAfterExistedIdentityCheckBlockchain':
      return identity.createIdentityInternalAsyncAfterExistedIdentityCheckBlockchain;
    case 'identity.checkForExistedIdentityAfterBlockchain':
      return identity.checkForExistedIdentityAfterBlockchain;
    case 'identity.createIdentityInternalAsyncAfterClearRegisterIdentityTimeout':
      return identity.createIdentityInternalAsyncAfterClearRegisterIdentityTimeout;
    case 'identity.addAccessorAfterCloseConsentRequest':
      return identity.addAccessorAfterCloseConsentRequest;
    case 'identity.addAccessorAfterConsentAfterAddAccessorMethod':
      return identity.addAccessorAfterConsentAfterAddAccessorMethod;
    case 'identity.addAccessorAfterConsentAfterRegisterMqDest':
      return identity.addAccessorAfterConsentAfterRegisterMqDest;
    case 'identity.notifyResultOfCreateRequestToRevokeAccessor':
      return identity.notifyResultOfCreateRequestToRevokeAccessor;
    case 'identity.revokeAccessorAfterCloseConsentRequest':
      return identity.revokeAccessorAfterCloseConsentRequest;
    case 'identity.notifyRevokeAccessorAfterConsent':
      return identity.notifyRevokeAccessorAfterConsent;
    case 'idp.processIdpResponseAfterRevokeAccessor':
      return idp.processIdpResponseAfterRevokeAccessor;
    case 'rp.processAsDataAfterSetDataReceived':
      return rp.processAsDataAfterSetDataReceived;
    // Core module - process task by request ID
    case 'rp.processMessage':
      return rp.processMessage;
    case 'rp.processRequestUpdate':
      return rp.processRequestUpdate;
    case 'idp.processMessage':
      return idp.processMessage;
    case 'idp.processRequestUpdate':
      return idp.processRequestUpdate;
    case 'idp.processCreateIdentityRequest':
      return idp.processCreateIdentityRequest;
    case 'as.processMessage':
      return as.processMessage;
    case 'as.processRequestUpdate':
      return as.processRequestUpdate;
    // MQ
    case 'mq.processRawMessage':
      return mq.processRawMessage;
    case 'mq.handleMqWorkerLost':
      return mq.handleMqWorkerLost;
    // callback
    case 'callback.handleCallbackWorkerLost':
      return callback.handleCallbackWorkerLost;
    default:
      throw new CustomError({
        message: 'Unknown function name',
        details: {
          fnName,
        },
      });
  }
}
