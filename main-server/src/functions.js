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
import * as proxy from './core/proxy';
import * as identity from './core/identity';
import * as dpki from './core/dpki';
import * as tendermint from './tendermint';
import * as mq from './mq';
import * as callback from './callback';
import * as externalCryptoService from './external_crypto_service';

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
    case 'common.runTimeoutScheduler':
      return common.runTimeoutScheduler;
    case 'common.removeTimeoutSchedulerInternal':
      return common.removeTimeoutSchedulerInternal;
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
    case 'identity.createIdentityAfterCloseConsentRequest':
      return identity.createIdentityAfterCloseConsentRequest;
    case 'identity.createIdentityAfterCloseConsentAndBlockchain':
      return identity.createIdentityAfterCloseConsentAndBlockchain;
    case 'identity.addAccessorInternalAsyncAfterCreateRequestBlockchain':
      return identity.addAccessorInternalAsyncAfterCreateRequestBlockchain;
    case 'identity.addAccessorInternalAsyncAfterBlockchain':
      return identity.addAccessorInternalAsyncAfterBlockchain;
    case 'identity.addAccessorAfterCloseConsentRequest':
      return identity.addAccessorAfterCloseConsentRequest;
    case 'identity.addAccessorAfterConsentAndBlockchain':
      return identity.addAccessorAfterConsentAndBlockchain;
    case 'identity.notifyResultOfCreateRequestToRevokeAccessor':
      return identity.notifyResultOfCreateRequestToRevokeAccessor;
    case 'identity.revokeAccessorInternalAsyncAfterBlockchain':
      return identity.revokeAccessorInternalAsyncAfterBlockchain;
    case 'identity.revokeAccessorAfterCloseConsentRequest':
      return identity.revokeAccessorAfterCloseConsentRequest;
    case 'identity.revokeAccessorAfterConsentAndBlockchain':
      return identity.revokeAccessorAfterConsentAndBlockchain;
    case 'identity.afterIdentityOperationSuccess':
      return identity.afterIdentityOperationSuccess;
    case 'identity.afterCloseFailedIdentityConsentRequest':
      return identity.afterCloseFailedIdentityConsentRequest;
    case 'rp.processAsDataAfterSetDataReceived':
      return rp.processAsDataAfterSetDataReceived;
    case 'dpki.updateNodeInternalAsyncAfterBlockchain':
      return dpki.updateNodeInternalAsyncAfterBlockchain;
    // Callback
    case 'rp.getCallbackUrls':
      return rp.getCallbackUrls;
    case 'rp.getErrorCallbackUrl':
      return rp.getErrorCallbackUrl;
    case 'idp.getCallbackUrls':
      return idp.getCallbackUrls;
    case 'idp.getErrorCallbackUrl':
      return idp.getErrorCallbackUrl;
    case 'idp.getIncomingRequestCallbackUrl':
      return idp.getIncomingRequestCallbackUrl;
    case 'idp.getIncomingRequestStatusUpdateCallbackUrl':
      return idp.getIncomingRequestStatusUpdateCallbackUrl;
    case 'as.getCallbackUrls':
      return as.getCallbackUrls;
    case 'as.getErrorCallbackUrl':
      return as.getErrorCallbackUrl;
    case 'as.getServiceCallbackUrl':
      return as.getServiceCallbackUrl;
    case 'as.getIncomingRequestStatusUpdateCallbackUrl':
      return as.getIncomingRequestStatusUpdateCallbackUrl;
    case 'proxy.getErrorCallbackUrl':
      return proxy.getErrorCallbackUrl;
    // Core module - process task by request ID
    case 'rp.processMessage':
      return rp.processMessage;
    case 'rp.processRequestUpdate':
      return rp.processRequestUpdate;
    case 'idp.processMessage':
      return idp.processMessage;
    case 'idp.processRequestUpdate':
      return idp.processRequestUpdate;
    case 'idp.processIdentityRequest':
      return idp.processIdentityRequest;
    case 'as.processMessage':
      return as.processMessage;
    case 'as.processRequestUpdate':
      return as.processRequestUpdate;
    // MQ
    case 'mq.processRawMessage':
      return mq.processRawMessage;
    case 'mq.resumePendingOutboundMessageSendOnWorker':
      return mq.resumePendingOutboundMessageSendOnWorker;
    // callback
    case 'callback.resumeCallbackToClientOnWorker':
      return callback.resumeCallbackToClientOnWorker;
    case 'callback.continueCallbackWithRetry':
      return callback.continueCallbackWithRetry;
    case 'externalCryptoService.checkAndEmitAllCallbacksSet':
      return externalCryptoService.checkAndEmitAllCallbacksSet;
    // tendermint
    case 'tendermint.loadExpectedTxOnWorker':
      return tendermint.loadExpectedTxOnWorker;
    case 'tendermint.retryBacklogTransactRequest':
      return tendermint.retryBacklogTransactRequest;
    default:
      throw new CustomError({
        message: 'Unknown function name',
        details: {
          fnName,
        },
      });
  }
}
