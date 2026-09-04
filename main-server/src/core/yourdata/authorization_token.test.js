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

import { expect } from 'chai';
import sinon from 'sinon';

import errorType from 'ndid-error/type';

import { validateAuthorization, USAGE_TYPE } from './authorization_token';

describe('validateAuthorization', () => {
  let defaultPayload;
  let defaultParams;
  let clock;

  beforeEach(() => {
    // Freeze time to a specific Unix timestamp (e.g., 1700000000000 ms / 1700000000 seconds)
    clock = sinon.useFakeTimers(1700000000000);

    // Setup a valid base payload matching parameters
    defaultPayload = {
      usage_type: USAGE_TYPE.ONE_TIME,
      expiration_datetime: 1700000060, // 60 seconds into the future
      requester_node_id: 'node-rp-1',
      as_node_id: 'node-as-1',
      validate_identifier: true,
      namespace: 'citizen_id',
      identifier: '1234567890123',
      validate_service_id: true,
      service_id_list: [
        {
          service_id: 'bank_statement',
          service_extension: ['ext_a', 'ext_b'],
        },
      ],
      validate_service_extension: true,
    };

    // Setup standard matching arguments
    defaultParams = {
      parsedAuthorizationTokenPayload: defaultPayload,
      requesterNodeId: 'node-rp-1',
      asNodeId: 'node-as-1',
      namespace: 'citizen_id',
      identifier: '1234567890123',
      serviceId: 'bank_statement',
      serviceExtension: ['ext_a'],
    };
  });

  afterEach(() => {
    clock.restore();
  });

  // =========================================================================
  // 1. SUCCESS CASES
  // =========================================================================
  describe('Success Cases', () => {
    it('should successfully validate when all fields match perfectly', () => {
      expect(() => validateAuthorization(defaultParams)).to.not.throw();
    });

    it('should skip expiration check if usage_type is CONTINUOUS_NO_EXPIRE', () => {
      defaultPayload.usage_type = USAGE_TYPE.CONTINUOUS_NO_EXPIRE;
      defaultPayload.expiration_datetime = 1600000000; // Past time

      expect(() => validateAuthorization(defaultParams)).to.not.throw();
    });

    it('should bypass identifier verification if validate_identifier is false', () => {
      defaultPayload.validate_identifier = false;

      const mixedParams = {
        ...defaultParams,
        namespace: 'mismatched_namespace',
        identifier: 'mismatched_id',
      };

      expect(() => validateAuthorization(mixedParams)).to.not.throw();
    });

    it('should bypass service and extension checks if validate_service_id is false', () => {
      defaultPayload.validate_service_id = false;

      const mixedParams = {
        ...defaultParams,
        serviceId: 'wrong_service',
        serviceExtension: ['wrong_ext'],
      };

      expect(() => validateAuthorization(mixedParams)).to.not.throw();
    });

    it('should bypass extension array match if validate_service_extension is false', () => {
      defaultPayload.validate_service_extension = false;

      const mixedParams = {
        ...defaultParams,
        serviceExtension: ['unauthorized_extension'],
      };

      expect(() => validateAuthorization(mixedParams)).to.not.throw();
    });

    it('should skip service extension validation if not provided when validate_service_extension is true', () => {
      defaultPayload.validate_service_extension = true;

      const mixedParams = {
        ...defaultParams,
      };
      delete mixedParams.serviceExtension;

      expect(() => validateAuthorization(mixedParams)).to.not.throw();
    });
  });

  // =========================================================================
  // 2. ERROR / FAILURE CASES
  // =========================================================================
  describe('Error Cases', () => {
    it('should throw TOKEN_EXPIRED error if token is expired', () => {
      // Set expiration 60 seconds in the past relative to mock clock
      defaultPayload.expiration_datetime = 1700000000 - 60;

      try {
        validateAuthorization(defaultParams);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.code).to.equal(errorType.TOKEN_EXPIRED.code);
        expect(err.details.expiration_datetime).to.equal(
          defaultPayload.expiration_datetime
        );
      }
    });

    it('should throw TOKEN_REQUESTER_NODE_ID_MISMATCH error on wrong requester node ID', () => {
      defaultParams.requesterNodeId = 'wrong-rp-node';

      try {
        validateAuthorization(defaultParams);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.code).to.equal(
          errorType.TOKEN_REQUESTER_NODE_ID_MISMATCH.code
        );
        expect(err.details.requesterNodeId).to.equal('wrong-rp-node');
      }
    });

    it('should throw TOKEN_AS_NODE_ID_MISMATCH error on wrong AS node ID', () => {
      defaultParams.asNodeId = 'wrong-as-node';

      try {
        validateAuthorization(defaultParams);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.code).to.equal(errorType.TOKEN_AS_NODE_ID_MISMATCH.code);
        expect(err.details.requestAsNodeId).to.equal('wrong-as-node');
      }
    });

    it('should throw TOKEN_NAMESPACE_MISMATCH error if namespaces disagree', () => {
      defaultParams.namespace = 'wrong_namespace';

      try {
        validateAuthorization(defaultParams);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.code).to.equal(errorType.TOKEN_NAMESPACE_MISMATCH.code);
        expect(err.details.requestNamespace).to.equal('wrong_namespace');
      }
    });

    it('should throw TOKEN_IDENTIFIER_MISMATCH error if identifiers disagree', () => {
      defaultParams.identifier = 'wrong_id';

      try {
        validateAuthorization(defaultParams);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.code).to.equal(errorType.TOKEN_IDENTIFIER_MISMATCH.code);
        expect(err.details.requestIdentifier).to.equal('wrong_id');
      }
    });

    it('should throw REQUESTED_SERVICE_ID_NOT_FOUND_IN_TOKEN error if service_id missing from token', () => {
      defaultParams.serviceId = 'unregistered_service';

      try {
        validateAuthorization(defaultParams);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.code).to.equal(
          errorType.REQUESTED_SERVICE_ID_NOT_FOUND_IN_TOKEN.code
        );
        expect(err.details.requestServiceId).to.equal('unregistered_service');
      }
    });

    it('should throw REQUESTED_SERVICE_EXTENSION_NOT_FOUND_IN_TOKEN if an extension parameter is not allowed', () => {
      defaultParams.serviceExtension = ['ext_a', 'forbidden_extension'];

      try {
        validateAuthorization(defaultParams);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.code).to.equal(
          errorType.REQUESTED_SERVICE_EXTENSION_NOT_FOUND_IN_TOKEN.code
        );
        expect(err.details.requestServiceExtension).to.deep.equal([
          'ext_a',
          'forbidden_extension',
        ]);
      }
    });
  });
});
