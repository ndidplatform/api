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

import * as utils from '.';

const chai = require('chai');
const expect = chai.expect;

describe('Test derive request status from request details', () => {
  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        '5406a969690221c1a3c714bbd8fe660de6ae76ac4e49d278de4e0b8be0f38fcc',
      min_idp: 1,
      min_aal: 1,
      min_ial: 1.1,
      request_timeout: 86400,
      idp_id_list: ['idp1'],
      data_request_list: [],
      request_message_hash: '0aEgNrIf4WEFMp+V/b+rVbSggvTBDoK6vldi9fOIwO0=',
      response_list: [],
      closed: false,
      timed_out: false,
      purpose: '',
      mode: 1,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 118,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('pending');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        '5406a969690221c1a3c714bbd8fe660de6ae76ac4e49d278de4e0b8be0f38fcc',
      min_idp: 1,
      min_aal: 1,
      min_ial: 1.1,
      request_timeout: 86400,
      idp_id_list: ['idp1'],
      data_request_list: [],
      request_message_hash: '0aEgNrIf4WEFMp+V/b+rVbSggvTBDoK6vldi9fOIwO0=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature: 'Some signature',
          idp_id: 'idp1',
          valid_ial: null,
          valid_signature: null,
        },
      ],
      closed: false,
      timed_out: false,
      purpose: '',
      mode: 1,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 118,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('completed');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        '5406a969690221c1a3c714bbd8fe660de6ae76ac4e49d278de4e0b8be0f38fcc',
      min_idp: 1,
      min_aal: 1,
      min_ial: 1.1,
      request_timeout: 86400,
      idp_id_list: ['idp1'],
      data_request_list: [],
      request_message_hash: '0aEgNrIf4WEFMp+V/b+rVbSggvTBDoK6vldi9fOIwO0=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'reject',
          signature: 'Some signature',
          idp_id: 'idp1',
          valid_ial: null,
          valid_signature: null,
        },
      ],
      closed: false,
      timed_out: false,
      purpose: '',
      mode: 1,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 118,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('rejected');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        'eda0a281eef39d36289349d6b04b27e7cad484722e395d0217595eb781b6226c',
      min_idp: 2,
      min_aal: 1,
      min_ial: 1.1,
      request_timeout: 86400,
      idp_id_list: ['idp1', 'idp2'],
      data_request_list: [],
      request_message_hash: '0aEgNrIf4WEFMp+V/b+rVbSggvTBDoK6vldi9fOIwO0=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature: 'Some signature',
          idp_id: 'idp1',
          valid_ial: null,
          valid_signature: null,
        },
      ],
      closed: false,
      timed_out: false,
      purpose: '',
      mode: 1,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 118,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('confirmed');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        'eda0a281eef39d36289349d6b04b27e7cad484722e395d0217595eb781b6226c',
      min_idp: 2,
      min_aal: 1,
      min_ial: 1.1,
      request_timeout: 86400,
      idp_id_list: ['idp1', 'idp2'],
      data_request_list: [],
      request_message_hash: '0aEgNrIf4WEFMp+V/b+rVbSggvTBDoK6vldi9fOIwO0=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature: 'Some signature',
          idp_id: 'idp1',
          valid_ial: null,
          valid_signature: null,
        },
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature: 'Some signature',
          idp_id: 'idp2',
          valid_ial: null,
          valid_signature: null,
        },
      ],
      closed: false,
      timed_out: false,
      purpose: '',
      mode: 1,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 118,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('completed');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        'eda0a281eef39d36289349d6b04b27e7cad484722e395d0217595eb781b6226c',
      min_idp: 2,
      min_aal: 1,
      min_ial: 1.1,
      request_timeout: 86400,
      idp_id_list: ['idp1', 'idp2'],
      data_request_list: [],
      request_message_hash: '0aEgNrIf4WEFMp+V/b+rVbSggvTBDoK6vldi9fOIwO0=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature: 'Some signature',
          idp_id: 'idp1',
          valid_ial: null,
          valid_signature: null,
        },
        {
          ial: 2.3,
          aal: 3,
          status: 'reject',
          signature: 'Some signature',
          idp_id: 'idp2',
          valid_ial: null,
          valid_signature: null,
        },
      ],
      closed: false,
      timed_out: false,
      purpose: '',
      mode: 1,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 118,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('complicated');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        'eda0a281eef39d36289349d6b04b27e7cad484722e395d0217595eb781b6226c',
      min_idp: 1,
      min_aal: 1,
      min_ial: 1.1,
      request_timeout: 86400,
      idp_id_list: ['idp1', 'idp2'],
      data_request_list: [],
      request_message_hash: '0aEgNrIf4WEFMp+V/b+rVbSggvTBDoK6vldi9fOIwO0=',
      response_list: [
        {
          idp_id: 'idp1',
          valid_ial: null,
          valid_signature: null,
          error_code: 1000,
        },
      ],
      closed: false,
      timed_out: false,
      purpose: '',
      mode: 1,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 118,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('pending');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        'eda0a281eef39d36289349d6b04b27e7cad484722e395d0217595eb781b6226c',
      min_idp: 2,
      min_aal: 1,
      min_ial: 1.1,
      request_timeout: 86400,
      idp_id_list: ['idp1', 'idp2'],
      data_request_list: [],
      request_message_hash: '0aEgNrIf4WEFMp+V/b+rVbSggvTBDoK6vldi9fOIwO0=',
      response_list: [
        {
          idp_id: 'idp1',
          valid_ial: null,
          valid_signature: null,
          error_code: 1000,
        },
      ],
      closed: false,
      timed_out: false,
      purpose: '',
      mode: 1,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 118,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('errored');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        'eda0a281eef39d36289349d6b04b27e7cad484722e395d0217595eb781b6226c',
      min_idp: 1,
      min_aal: 1,
      min_ial: 1.1,
      request_timeout: 86400,
      idp_id_list: ['idp1', 'idp2'],
      data_request_list: [],
      request_message_hash: '0aEgNrIf4WEFMp+V/b+rVbSggvTBDoK6vldi9fOIwO0=',
      response_list: [
        {
          idp_id: 'idp1',
          valid_ial: null,
          valid_signature: null,
          error_code: 1000,
        },
        {
          idp_id: 'idp2',
          valid_ial: null,
          valid_signature: null,
          error_code: 1000,
        },
      ],
      closed: false,
      timed_out: false,
      purpose: '',
      mode: 1,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 118,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('errored');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        '7ec0acc8cc870d2c86f88d2f9eb9efb91ebcefc041cc2d83226083ee12bdbea1',
      min_idp: 1,
      min_aal: 1,
      min_ial: 1.1,
      request_timeout: 86400,
      idp_id_list: ['idp1'],
      data_request_list: [],
      request_message_hash: '8upYFT0tfOqfTW88g2Buy/tiyZ+1eg0X8l70EnyaU2s=',
      response_list: [],
      closed: false,
      timed_out: false,
      purpose: 'RegisterIdentity',
      mode: 3,
      request_type: null,
      requester_node_id: 'idp2',
      creation_block_height: 88,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('pending');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        '7ec0acc8cc870d2c86f88d2f9eb9efb91ebcefc041cc2d83226083ee12bdbea1',
      min_idp: 1,
      min_aal: 1,
      min_ial: 1.1,
      request_timeout: 86400,
      idp_id_list: ['idp1'],
      data_request_list: [],
      request_message_hash: '8upYFT0tfOqfTW88g2Buy/tiyZ+1eg0X8l70EnyaU2s=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'DJWdGVGtqLM2JA+fAkKG+2vbpkArbI2kIbAwjIcSdzVgqjVKpWIMDr7f2qQXcSVZB00LpgHROET1raGcHlxSPnoJd5QqdRwqF0W+TmzdTEt5c1DjjStGVe37VJflEK98rZBQHgTnwIVik20ZYi2iVjknsz9w0WlqCV0sOVxIouOYKe5SH9zDIbNgMkVs3lTGrmd+AvWJ390GkiYsQCzCk1sbrvnks96uf3Fhq6WMrZzws3Hr/CVm83UYPGvnzcEaMT6hXTc8g9NwVqYMlpI8jeWWXrJyacBlUUaFtJAkcbV3+5L4qZB1K1zMXgfSfXWLYL/3thUO3n+Vn6FaFSJ7dA==',
          idp_id: 'idp1',
          valid_ial: null,
          valid_signature: null,
        },
      ],
      closed: false,
      timed_out: false,
      purpose: 'RegisterIdentity',
      mode: 3,
      request_type: null,
      requester_node_id: 'idp2',
      creation_block_height: 88,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('completed');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        'a5974cfbc6015b92e683ab6c4d432b2bc4f7ad56d7eb214b0a4c3e4e36f81e85',
      min_idp: 1,
      min_aal: 1,
      min_ial: 1.1,
      request_timeout: 86400,
      idp_id_list: ['idp1', 'idp2'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1'],
          min_as: 1,
          request_params_hash: 'zaWTDk3EnxboynYfe5P+ygNFyPevkDK1t0TpECOGSvQ=',
          response_list: [],
        },
      ],
      request_message_hash: 'iXVFxq9/i+U1PCxP6KPikpOu2EqA4VTNbE+q5llhW4I=',
      response_list: [],
      closed: false,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 74,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('pending');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        'a5974cfbc6015b92e683ab6c4d432b2bc4f7ad56d7eb214b0a4c3e4e36f81e85',
      min_idp: 1,
      min_aal: 1,
      min_ial: 1.1,
      request_timeout: 86400,
      idp_id_list: ['idp1', 'idp2'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1'],
          min_as: 1,
          request_params_hash: 'zaWTDk3EnxboynYfe5P+ygNFyPevkDK1t0TpECOGSvQ=',
          response_list: [],
        },
      ],
      request_message_hash: 'iXVFxq9/i+U1PCxP6KPikpOu2EqA4VTNbE+q5llhW4I=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'VqbDUzBOOwNkhvvFe2oukLJOeTDKOmlJxcyfoUl6BtuEmCqa0QlhCVv7i5HmVzBLwQ5G9MVB0s2NS1zrhI566GYzR+wAhxtBfYN4ADteRsq/nhVlA6VrvQ7LaFSrnls2hyAVKiKaKe1QV97zKwraXzifgJrIdS5Hbv1veqU79pvrIvdAMUeO9IsFS/KGJYnNIg7yr/aURuOHb6fAjBVKEWrk9JL0HGxj0BnTRIyvnD4q21jk6EZTJzarkV0m2VU2I5NI9y+La9gyWRosE2CFsfxBTeSpnWFNZ5B4HLX47cghFmGpxLN1ewpneeFjJF10dh4YWpFHS+0Biudz2FXk/g==',
          idp_id: 'idp2',
          valid_ial: null,
          valid_signature: null,
        },
      ],
      closed: false,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 74,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('confirmed');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        'a5974cfbc6015b92e683ab6c4d432b2bc4f7ad56d7eb214b0a4c3e4e36f81e85',
      min_idp: 1,
      min_aal: 1,
      min_ial: 1.1,
      request_timeout: 86400,
      idp_id_list: ['idp1', 'idp2'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1'],
          min_as: 1,
          request_params_hash: 'zaWTDk3EnxboynYfe5P+ygNFyPevkDK1t0TpECOGSvQ=',
          response_list: [
            {
              as_id: 'as1',
              signed: true,
              received_data: false,
            },
          ],
        },
      ],
      request_message_hash: 'iXVFxq9/i+U1PCxP6KPikpOu2EqA4VTNbE+q5llhW4I=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'VqbDUzBOOwNkhvvFe2oukLJOeTDKOmlJxcyfoUl6BtuEmCqa0QlhCVv7i5HmVzBLwQ5G9MVB0s2NS1zrhI566GYzR+wAhxtBfYN4ADteRsq/nhVlA6VrvQ7LaFSrnls2hyAVKiKaKe1QV97zKwraXzifgJrIdS5Hbv1veqU79pvrIvdAMUeO9IsFS/KGJYnNIg7yr/aURuOHb6fAjBVKEWrk9JL0HGxj0BnTRIyvnD4q21jk6EZTJzarkV0m2VU2I5NI9y+La9gyWRosE2CFsfxBTeSpnWFNZ5B4HLX47cghFmGpxLN1ewpneeFjJF10dh4YWpFHS+0Biudz2FXk/g==',
          idp_id: 'idp2',
          valid_ial: null,
          valid_signature: null,
        },
      ],
      closed: false,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 74,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('confirmed');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        'a5974cfbc6015b92e683ab6c4d432b2bc4f7ad56d7eb214b0a4c3e4e36f81e85',
      min_idp: 1,
      min_aal: 1,
      min_ial: 1.1,
      request_timeout: 86400,
      idp_id_list: ['idp1', 'idp2'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1'],
          min_as: 1,
          request_params_hash: 'zaWTDk3EnxboynYfe5P+ygNFyPevkDK1t0TpECOGSvQ=',
          response_list: [
            {
              as_id: 'as1',
              signed: true,
              received_data: true,
            },
          ],
        },
      ],
      request_message_hash: 'iXVFxq9/i+U1PCxP6KPikpOu2EqA4VTNbE+q5llhW4I=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'VqbDUzBOOwNkhvvFe2oukLJOeTDKOmlJxcyfoUl6BtuEmCqa0QlhCVv7i5HmVzBLwQ5G9MVB0s2NS1zrhI566GYzR+wAhxtBfYN4ADteRsq/nhVlA6VrvQ7LaFSrnls2hyAVKiKaKe1QV97zKwraXzifgJrIdS5Hbv1veqU79pvrIvdAMUeO9IsFS/KGJYnNIg7yr/aURuOHb6fAjBVKEWrk9JL0HGxj0BnTRIyvnD4q21jk6EZTJzarkV0m2VU2I5NI9y+La9gyWRosE2CFsfxBTeSpnWFNZ5B4HLX47cghFmGpxLN1ewpneeFjJF10dh4YWpFHS+0Biudz2FXk/g==',
          idp_id: 'idp2',
          valid_ial: null,
          valid_signature: null,
        },
      ],
      closed: false,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 74,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('completed');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        'a5974cfbc6015b92e683ab6c4d432b2bc4f7ad56d7eb214b0a4c3e4e36f81e85',
      min_idp: 1,
      min_aal: 1,
      min_ial: 1.1,
      request_timeout: 86400,
      idp_id_list: ['idp1', 'idp2'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1'],
          min_as: 1,
          request_params_hash: 'zaWTDk3EnxboynYfe5P+ygNFyPevkDK1t0TpECOGSvQ=',
          response_list: [
            {
              as_id: 'as1',
              signed: true,
              received_data: true,
            },
          ],
        },
      ],
      request_message_hash: 'iXVFxq9/i+U1PCxP6KPikpOu2EqA4VTNbE+q5llhW4I=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'VqbDUzBOOwNkhvvFe2oukLJOeTDKOmlJxcyfoUl6BtuEmCqa0QlhCVv7i5HmVzBLwQ5G9MVB0s2NS1zrhI566GYzR+wAhxtBfYN4ADteRsq/nhVlA6VrvQ7LaFSrnls2hyAVKiKaKe1QV97zKwraXzifgJrIdS5Hbv1veqU79pvrIvdAMUeO9IsFS/KGJYnNIg7yr/aURuOHb6fAjBVKEWrk9JL0HGxj0BnTRIyvnD4q21jk6EZTJzarkV0m2VU2I5NI9y+La9gyWRosE2CFsfxBTeSpnWFNZ5B4HLX47cghFmGpxLN1ewpneeFjJF10dh4YWpFHS+0Biudz2FXk/g==',
          idp_id: 'idp2',
          valid_ial: true,
          valid_signature: true,
        },
      ],
      closed: true,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 74,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('completed');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        'b5974cfbc6015b92e683ab6c4d432b2bc4f7ad56d7eb214b0a4c3e4e36f81e85',
      min_idp: 1,
      min_aal: 1,
      min_ial: 1.1,
      request_timeout: 86400,
      idp_id_list: ['idp1', 'idp2'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1'],
          min_as: 1,
          request_params_hash: 'zaWTDk3EnxboynYfe5P+ygNFyPevkDK1t0TpECOGSvQ=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
          ],
        },
      ],
      request_message_hash: 'iXVFxq9/i+U1PCxP6KPikpOu2EqA4VTNbE+q5llhW4I=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'VqbDUzBOOwNkhvvFe2oukLJOeTDKOmlJxcyfoUl6BtuEmCqa0QlhCVv7i5HmVzBLwQ5G9MVB0s2NS1zrhI566GYzR+wAhxtBfYN4ADteRsq/nhVlA6VrvQ7LaFSrnls2hyAVKiKaKe1QV97zKwraXzifgJrIdS5Hbv1veqU79pvrIvdAMUeO9IsFS/KGJYnNIg7yr/aURuOHb6fAjBVKEWrk9JL0HGxj0BnTRIyvnD4q21jk6EZTJzarkV0m2VU2I5NI9y+La9gyWRosE2CFsfxBTeSpnWFNZ5B4HLX47cghFmGpxLN1ewpneeFjJF10dh4YWpFHS+0Biudz2FXk/g==',
          idp_id: 'idp2',
          valid_ial: null,
          valid_signature: null,
        },
      ],
      closed: false,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 74,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('errored');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        'b5974cfbc6015b92e683ab6c4d432b2bc4f7ad56d7eb214b0a4c3e4e36f81e85',
      min_idp: 1,
      min_aal: 1,
      min_ial: 1.1,
      request_timeout: 86400,
      idp_id_list: ['idp1', 'idp2'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1', 'as2'],
          min_as: 2,
          request_params_hash: 'zaWTDk3EnxboynYfe5P+ygNFyPevkDK1t0TpECOGSvQ=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
          ],
        },
      ],
      request_message_hash: 'iXVFxq9/i+U1PCxP6KPikpOu2EqA4VTNbE+q5llhW4I=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'VqbDUzBOOwNkhvvFe2oukLJOeTDKOmlJxcyfoUl6BtuEmCqa0QlhCVv7i5HmVzBLwQ5G9MVB0s2NS1zrhI566GYzR+wAhxtBfYN4ADteRsq/nhVlA6VrvQ7LaFSrnls2hyAVKiKaKe1QV97zKwraXzifgJrIdS5Hbv1veqU79pvrIvdAMUeO9IsFS/KGJYnNIg7yr/aURuOHb6fAjBVKEWrk9JL0HGxj0BnTRIyvnD4q21jk6EZTJzarkV0m2VU2I5NI9y+La9gyWRosE2CFsfxBTeSpnWFNZ5B4HLX47cghFmGpxLN1ewpneeFjJF10dh4YWpFHS+0Biudz2FXk/g==',
          idp_id: 'idp2',
          valid_ial: null,
          valid_signature: null,
        },
      ],
      closed: false,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 74,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('errored');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        '1804ac0308d22b4203dfc12a930394efa081f30a734c748d2f1966b8c62bb326',
      min_idp: 1,
      min_aal: 3,
      min_ial: 2.3,
      request_timeout: 86400,
      idp_id_list: ['idp1'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1', 'as2'],
          min_as: 0,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              signed: true,
              received_data: true,
            },
            {
              as_id: 'as2',
              signed: true,
              received_data: true,
            },
          ],
        },
      ],
      request_message_hash: '/+m2u2JBZ3zADwVdtLiMkvMjONWL8ZsDTqduLp3csGU=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'NHzTRPXXCcCFNHBrA3DSJnVDvXaz+u76Qix55ADLxiWktvJGFY7/wXTK/OCH6Gs1diVM6KNuh6rLP5cPWiaJdkx2zP+3An+1/ox+HqqKb6AKIO0EAKaH3seO1F4wqLrf1ymLN7dobEwntuR3n4XI9eaXsrhNNlTuilYDG4+iA/xzBuCB9QBEhb6hBvBGPsG2BpQiHVveh4t0+6MxdpgkzQuNyzMLqvrj7e71YQjY2cMBC0zGbzcwsyI4rM6NEptsVsf7IJKXW5YNBygp8dxuLCXm5dcksN2MouYp+VU36mTYiAr74sn8isXOsWeVwgbvEOh93uB7ZjQomcU0L1UXDQ==',
          idp_id: 'idp1',
          valid_ial: true,
          valid_signature: true,
        },
      ],
      closed: true,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 488,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('completed');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        '1804ac0308d22b4203dfc12a930394efa081f30a734c748d2f1966b8c62bb326',
      min_idp: 1,
      min_aal: 3,
      min_ial: 2.3,
      request_timeout: 86400,
      idp_id_list: ['idp1'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1', 'as2'],
          min_as: 0,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
          ],
        },
      ],
      request_message_hash: '/+m2u2JBZ3zADwVdtLiMkvMjONWL8ZsDTqduLp3csGU=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'NHzTRPXXCcCFNHBrA3DSJnVDvXaz+u76Qix55ADLxiWktvJGFY7/wXTK/OCH6Gs1diVM6KNuh6rLP5cPWiaJdkx2zP+3An+1/ox+HqqKb6AKIO0EAKaH3seO1F4wqLrf1ymLN7dobEwntuR3n4XI9eaXsrhNNlTuilYDG4+iA/xzBuCB9QBEhb6hBvBGPsG2BpQiHVveh4t0+6MxdpgkzQuNyzMLqvrj7e71YQjY2cMBC0zGbzcwsyI4rM6NEptsVsf7IJKXW5YNBygp8dxuLCXm5dcksN2MouYp+VU36mTYiAr74sn8isXOsWeVwgbvEOh93uB7ZjQomcU0L1UXDQ==',
          idp_id: 'idp1',
          valid_ial: true,
          valid_signature: true,
        },
      ],
      closed: true,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 488,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('confirmed');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        '1804ac0308d22b4203dfc12a930394efa081f30a734c748d2f1966b8c62bb326',
      min_idp: 1,
      min_aal: 3,
      min_ial: 2.3,
      request_timeout: 86400,
      idp_id_list: ['idp1'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1', 'as2'],
          min_as: 0,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              signed: true,
              received_data: true,
            },
            {
              as_id: 'as2',
              error_code: 10101,
            },
          ],
        },
      ],
      request_message_hash: '/+m2u2JBZ3zADwVdtLiMkvMjONWL8ZsDTqduLp3csGU=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'NHzTRPXXCcCFNHBrA3DSJnVDvXaz+u76Qix55ADLxiWktvJGFY7/wXTK/OCH6Gs1diVM6KNuh6rLP5cPWiaJdkx2zP+3An+1/ox+HqqKb6AKIO0EAKaH3seO1F4wqLrf1ymLN7dobEwntuR3n4XI9eaXsrhNNlTuilYDG4+iA/xzBuCB9QBEhb6hBvBGPsG2BpQiHVveh4t0+6MxdpgkzQuNyzMLqvrj7e71YQjY2cMBC0zGbzcwsyI4rM6NEptsVsf7IJKXW5YNBygp8dxuLCXm5dcksN2MouYp+VU36mTYiAr74sn8isXOsWeVwgbvEOh93uB7ZjQomcU0L1UXDQ==',
          idp_id: 'idp1',
          valid_ial: true,
          valid_signature: true,
        },
      ],
      closed: true,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 488,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('partial_completed');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        '1804ac0308d22b4203dfc12a930394efa081f30a734c748d2f1966b8c62bb326',
      min_idp: 1,
      min_aal: 3,
      min_ial: 2.3,
      request_timeout: 86400,
      idp_id_list: ['idp1'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1', 'as2'],
          min_as: 0,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
            {
              as_id: 'as2',
              error_code: 10101,
            },
          ],
        },
      ],
      request_message_hash: '/+m2u2JBZ3zADwVdtLiMkvMjONWL8ZsDTqduLp3csGU=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'NHzTRPXXCcCFNHBrA3DSJnVDvXaz+u76Qix55ADLxiWktvJGFY7/wXTK/OCH6Gs1diVM6KNuh6rLP5cPWiaJdkx2zP+3An+1/ox+HqqKb6AKIO0EAKaH3seO1F4wqLrf1ymLN7dobEwntuR3n4XI9eaXsrhNNlTuilYDG4+iA/xzBuCB9QBEhb6hBvBGPsG2BpQiHVveh4t0+6MxdpgkzQuNyzMLqvrj7e71YQjY2cMBC0zGbzcwsyI4rM6NEptsVsf7IJKXW5YNBygp8dxuLCXm5dcksN2MouYp+VU36mTYiAr74sn8isXOsWeVwgbvEOh93uB7ZjQomcU0L1UXDQ==',
          idp_id: 'idp1',
          valid_ial: true,
          valid_signature: true,
        },
      ],
      closed: true,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 488,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('errored');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        '1804ac0308d22b4203dfc12a930394efa081f30a734c748d2f1966b8c62bb326',
      min_idp: 1,
      min_aal: 3,
      min_ial: 2.3,
      request_timeout: 86400,
      idp_id_list: ['idp1'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1', 'as2'],
          min_as: 0,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
          ],
        },
        {
          service_id: 'bank_statement_2',
          as_id_list: ['as1', 'as2'],
          min_as: 1,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [],
        },
      ],
      request_message_hash: '/+m2u2JBZ3zADwVdtLiMkvMjONWL8ZsDTqduLp3csGU=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'NHzTRPXXCcCFNHBrA3DSJnVDvXaz+u76Qix55ADLxiWktvJGFY7/wXTK/OCH6Gs1diVM6KNuh6rLP5cPWiaJdkx2zP+3An+1/ox+HqqKb6AKIO0EAKaH3seO1F4wqLrf1ymLN7dobEwntuR3n4XI9eaXsrhNNlTuilYDG4+iA/xzBuCB9QBEhb6hBvBGPsG2BpQiHVveh4t0+6MxdpgkzQuNyzMLqvrj7e71YQjY2cMBC0zGbzcwsyI4rM6NEptsVsf7IJKXW5YNBygp8dxuLCXm5dcksN2MouYp+VU36mTYiAr74sn8isXOsWeVwgbvEOh93uB7ZjQomcU0L1UXDQ==',
          idp_id: 'idp1',
          valid_ial: true,
          valid_signature: true,
        },
      ],
      closed: true,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 488,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('confirmed');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        '9804ac0308d22b4203dfc12a930394efa081f30a734c748d2f1966b8c62bb326',
      min_idp: 1,
      min_aal: 3,
      min_ial: 2.3,
      request_timeout: 86400,
      idp_id_list: ['idp1'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1'],
          min_as: 1,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
          ],
        },
        {
          service_id: 'bank_statement_2',
          as_id_list: ['as1', 'as2'],
          min_as: 1,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              signed: true,
              received_data: true,
            },
          ],
        },
      ],
      request_message_hash: '/+m2u2JBZ3zADwVdtLiMkvMjONWL8ZsDTqduLp3csGU=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'NHzTRPXXCcCFNHBrA3DSJnVDvXaz+u76Qix55ADLxiWktvJGFY7/wXTK/OCH6Gs1diVM6KNuh6rLP5cPWiaJdkx2zP+3An+1/ox+HqqKb6AKIO0EAKaH3seO1F4wqLrf1ymLN7dobEwntuR3n4XI9eaXsrhNNlTuilYDG4+iA/xzBuCB9QBEhb6hBvBGPsG2BpQiHVveh4t0+6MxdpgkzQuNyzMLqvrj7e71YQjY2cMBC0zGbzcwsyI4rM6NEptsVsf7IJKXW5YNBygp8dxuLCXm5dcksN2MouYp+VU36mTYiAr74sn8isXOsWeVwgbvEOh93uB7ZjQomcU0L1UXDQ==',
          idp_id: 'idp1',
          valid_ial: true,
          valid_signature: true,
        },
      ],
      closed: true,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 488,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('errored');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        'a804ac0308d22b4203dfc12a930394efa081f30a734c748d2f1966b8c62bb326',
      min_idp: 1,
      min_aal: 3,
      min_ial: 2.3,
      request_timeout: 86400,
      idp_id_list: ['idp1'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1', 'as2'],
          min_as: 1,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
          ],
        },
        {
          service_id: 'bank_statement_2',
          as_id_list: ['as1', 'as2'],
          min_as: 1,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [],
        },
      ],
      request_message_hash: '/+m2u2JBZ3zADwVdtLiMkvMjONWL8ZsDTqduLp3csGU=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'NHzTRPXXCcCFNHBrA3DSJnVDvXaz+u76Qix55ADLxiWktvJGFY7/wXTK/OCH6Gs1diVM6KNuh6rLP5cPWiaJdkx2zP+3An+1/ox+HqqKb6AKIO0EAKaH3seO1F4wqLrf1ymLN7dobEwntuR3n4XI9eaXsrhNNlTuilYDG4+iA/xzBuCB9QBEhb6hBvBGPsG2BpQiHVveh4t0+6MxdpgkzQuNyzMLqvrj7e71YQjY2cMBC0zGbzcwsyI4rM6NEptsVsf7IJKXW5YNBygp8dxuLCXm5dcksN2MouYp+VU36mTYiAr74sn8isXOsWeVwgbvEOh93uB7ZjQomcU0L1UXDQ==',
          idp_id: 'idp1',
          valid_ial: true,
          valid_signature: true,
        },
      ],
      closed: true,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 488,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('confirmed');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        'a804ac0308d22b4203dfc12a930394efa081f30a734c748d2f1966b8c62bb326',
      min_idp: 1,
      min_aal: 3,
      min_ial: 2.3,
      request_timeout: 86400,
      idp_id_list: ['idp1'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1', 'as2'],
          min_as: 1,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
          ],
        },
        {
          service_id: 'bank_statement_2',
          as_id_list: ['as1', 'as2'],
          min_as: 1,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              signed: true,
              received_data: true,
            },
          ],
        },
      ],
      request_message_hash: '/+m2u2JBZ3zADwVdtLiMkvMjONWL8ZsDTqduLp3csGU=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'NHzTRPXXCcCFNHBrA3DSJnVDvXaz+u76Qix55ADLxiWktvJGFY7/wXTK/OCH6Gs1diVM6KNuh6rLP5cPWiaJdkx2zP+3An+1/ox+HqqKb6AKIO0EAKaH3seO1F4wqLrf1ymLN7dobEwntuR3n4XI9eaXsrhNNlTuilYDG4+iA/xzBuCB9QBEhb6hBvBGPsG2BpQiHVveh4t0+6MxdpgkzQuNyzMLqvrj7e71YQjY2cMBC0zGbzcwsyI4rM6NEptsVsf7IJKXW5YNBygp8dxuLCXm5dcksN2MouYp+VU36mTYiAr74sn8isXOsWeVwgbvEOh93uB7ZjQomcU0L1UXDQ==',
          idp_id: 'idp1',
          valid_ial: true,
          valid_signature: true,
        },
      ],
      closed: true,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 488,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('confirmed');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        'a804ac0308d22b4203dfc12a930394efa081f30a734c748d2f1966b8c62bb326',
      min_idp: 1,
      min_aal: 3,
      min_ial: 2.3,
      request_timeout: 86400,
      idp_id_list: ['idp1'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1', 'as2'],
          min_as: 1,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
            {
              as_id: 'as2',
              signed: true,
              received_data: true,
            },
          ],
        },
        {
          service_id: 'bank_statement_2',
          as_id_list: ['as1', 'as2'],
          min_as: 1,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              signed: true,
              received_data: true,
            },
          ],
        },
      ],
      request_message_hash: '/+m2u2JBZ3zADwVdtLiMkvMjONWL8ZsDTqduLp3csGU=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'NHzTRPXXCcCFNHBrA3DSJnVDvXaz+u76Qix55ADLxiWktvJGFY7/wXTK/OCH6Gs1diVM6KNuh6rLP5cPWiaJdkx2zP+3An+1/ox+HqqKb6AKIO0EAKaH3seO1F4wqLrf1ymLN7dobEwntuR3n4XI9eaXsrhNNlTuilYDG4+iA/xzBuCB9QBEhb6hBvBGPsG2BpQiHVveh4t0+6MxdpgkzQuNyzMLqvrj7e71YQjY2cMBC0zGbzcwsyI4rM6NEptsVsf7IJKXW5YNBygp8dxuLCXm5dcksN2MouYp+VU36mTYiAr74sn8isXOsWeVwgbvEOh93uB7ZjQomcU0L1UXDQ==',
          idp_id: 'idp1',
          valid_ial: true,
          valid_signature: true,
        },
      ],
      closed: true,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 488,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('completed');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        'b9804ac0308d22b4203dfc12a930394efa081f30a734c748d2f1966b8c62bb326',
      min_idp: 1,
      min_aal: 3,
      min_ial: 2.3,
      request_timeout: 86400,
      idp_id_list: ['idp1'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1', 'as2'],
          min_as: 1,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
          ],
        },
        {
          service_id: 'bank_statement_2',
          as_id_list: ['as1', 'as2'],
          min_as: 1,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
          ],
        },
      ],
      request_message_hash: '/+m2u2JBZ3zADwVdtLiMkvMjONWL8ZsDTqduLp3csGU=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'NHzTRPXXCcCFNHBrA3DSJnVDvXaz+u76Qix55ADLxiWktvJGFY7/wXTK/OCH6Gs1diVM6KNuh6rLP5cPWiaJdkx2zP+3An+1/ox+HqqKb6AKIO0EAKaH3seO1F4wqLrf1ymLN7dobEwntuR3n4XI9eaXsrhNNlTuilYDG4+iA/xzBuCB9QBEhb6hBvBGPsG2BpQiHVveh4t0+6MxdpgkzQuNyzMLqvrj7e71YQjY2cMBC0zGbzcwsyI4rM6NEptsVsf7IJKXW5YNBygp8dxuLCXm5dcksN2MouYp+VU36mTYiAr74sn8isXOsWeVwgbvEOh93uB7ZjQomcU0L1UXDQ==',
          idp_id: 'idp1',
          valid_ial: true,
          valid_signature: true,
        },
      ],
      closed: true,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 488,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('confirmed');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        '1804ac0308d22b4203dfc12a930394efa081f30a734c748d2f1966b8c62bb326',
      min_idp: 1,
      min_aal: 3,
      min_ial: 2.3,
      request_timeout: 86400,
      idp_id_list: ['idp1'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1', 'as2'],
          min_as: 0,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
          ],
        },
        {
          service_id: 'bank_statement_2',
          as_id_list: ['as1', 'as2'],
          min_as: 1,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              signed: true,
              received_data: true,
            },
          ],
        },
      ],
      request_message_hash: '/+m2u2JBZ3zADwVdtLiMkvMjONWL8ZsDTqduLp3csGU=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'NHzTRPXXCcCFNHBrA3DSJnVDvXaz+u76Qix55ADLxiWktvJGFY7/wXTK/OCH6Gs1diVM6KNuh6rLP5cPWiaJdkx2zP+3An+1/ox+HqqKb6AKIO0EAKaH3seO1F4wqLrf1ymLN7dobEwntuR3n4XI9eaXsrhNNlTuilYDG4+iA/xzBuCB9QBEhb6hBvBGPsG2BpQiHVveh4t0+6MxdpgkzQuNyzMLqvrj7e71YQjY2cMBC0zGbzcwsyI4rM6NEptsVsf7IJKXW5YNBygp8dxuLCXm5dcksN2MouYp+VU36mTYiAr74sn8isXOsWeVwgbvEOh93uB7ZjQomcU0L1UXDQ==',
          idp_id: 'idp1',
          valid_ial: true,
          valid_signature: true,
        },
      ],
      closed: true,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 488,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('partial_completed');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        '1804ac0308d22b4203dfc12a930394efa081f30a734c748d2f1966b8c62bb326',
      min_idp: 1,
      min_aal: 3,
      min_ial: 2.3,
      request_timeout: 86400,
      idp_id_list: ['idp1'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1', 'as2'],
          min_as: 0,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
            {
              as_id: 'as2',
              signed: true,
              received_data: false,
            },
          ],
        },
        {
          service_id: 'bank_statement_2',
          as_id_list: ['as1', 'as2'],
          min_as: 1,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              signed: true,
              received_data: true,
            },
          ],
        },
      ],
      request_message_hash: '/+m2u2JBZ3zADwVdtLiMkvMjONWL8ZsDTqduLp3csGU=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'NHzTRPXXCcCFNHBrA3DSJnVDvXaz+u76Qix55ADLxiWktvJGFY7/wXTK/OCH6Gs1diVM6KNuh6rLP5cPWiaJdkx2zP+3An+1/ox+HqqKb6AKIO0EAKaH3seO1F4wqLrf1ymLN7dobEwntuR3n4XI9eaXsrhNNlTuilYDG4+iA/xzBuCB9QBEhb6hBvBGPsG2BpQiHVveh4t0+6MxdpgkzQuNyzMLqvrj7e71YQjY2cMBC0zGbzcwsyI4rM6NEptsVsf7IJKXW5YNBygp8dxuLCXm5dcksN2MouYp+VU36mTYiAr74sn8isXOsWeVwgbvEOh93uB7ZjQomcU0L1UXDQ==',
          idp_id: 'idp1',
          valid_ial: true,
          valid_signature: true,
        },
      ],
      closed: true,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 488,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('partial_completed');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        '1804ac0308d22b4203dfc12a930394efa081f30a734c748d2f1966b8c62bb326',
      min_idp: 1,
      min_aal: 3,
      min_ial: 2.3,
      request_timeout: 86400,
      idp_id_list: ['idp1'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1', 'as2'],
          min_as: 0,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
            {
              as_id: 'as2',
              signed: true,
              received_data: true,
            },
          ],
        },
        {
          service_id: 'bank_statement_2',
          as_id_list: ['as1', 'as2'],
          min_as: 1,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              signed: true,
              received_data: true,
            },
          ],
        },
      ],
      request_message_hash: '/+m2u2JBZ3zADwVdtLiMkvMjONWL8ZsDTqduLp3csGU=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'NHzTRPXXCcCFNHBrA3DSJnVDvXaz+u76Qix55ADLxiWktvJGFY7/wXTK/OCH6Gs1diVM6KNuh6rLP5cPWiaJdkx2zP+3An+1/ox+HqqKb6AKIO0EAKaH3seO1F4wqLrf1ymLN7dobEwntuR3n4XI9eaXsrhNNlTuilYDG4+iA/xzBuCB9QBEhb6hBvBGPsG2BpQiHVveh4t0+6MxdpgkzQuNyzMLqvrj7e71YQjY2cMBC0zGbzcwsyI4rM6NEptsVsf7IJKXW5YNBygp8dxuLCXm5dcksN2MouYp+VU36mTYiAr74sn8isXOsWeVwgbvEOh93uB7ZjQomcU0L1UXDQ==',
          idp_id: 'idp1',
          valid_ial: true,
          valid_signature: true,
        },
      ],
      closed: true,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 488,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('partial_completed');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        '1804ac0308d22b4203dfc12a930394efa081f30a734c748d2f1966b8c62bb326',
      min_idp: 1,
      min_aal: 3,
      min_ial: 2.3,
      request_timeout: 86400,
      idp_id_list: ['idp1'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1', 'as2'],
          min_as: 0,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
            {
              as_id: 'as2',
              error_code: 10101,
            },
          ],
        },
        {
          service_id: 'bank_statement_2',
          as_id_list: ['as1', 'as2'],
          min_as: 1,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              signed: true,
              received_data: true,
            },
          ],
        },
      ],
      request_message_hash: '/+m2u2JBZ3zADwVdtLiMkvMjONWL8ZsDTqduLp3csGU=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'NHzTRPXXCcCFNHBrA3DSJnVDvXaz+u76Qix55ADLxiWktvJGFY7/wXTK/OCH6Gs1diVM6KNuh6rLP5cPWiaJdkx2zP+3An+1/ox+HqqKb6AKIO0EAKaH3seO1F4wqLrf1ymLN7dobEwntuR3n4XI9eaXsrhNNlTuilYDG4+iA/xzBuCB9QBEhb6hBvBGPsG2BpQiHVveh4t0+6MxdpgkzQuNyzMLqvrj7e71YQjY2cMBC0zGbzcwsyI4rM6NEptsVsf7IJKXW5YNBygp8dxuLCXm5dcksN2MouYp+VU36mTYiAr74sn8isXOsWeVwgbvEOh93uB7ZjQomcU0L1UXDQ==',
          idp_id: 'idp1',
          valid_ial: true,
          valid_signature: true,
        },
      ],
      closed: true,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 488,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('partial_completed');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        '1804ac0308d22b4203dfc12a930394efa081f30a734c748d2f1966b8c62bb326',
      min_idp: 1,
      min_aal: 3,
      min_ial: 2.3,
      request_timeout: 86400,
      idp_id_list: ['idp1'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1', 'as2'],
          min_as: 0,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
            {
              as_id: 'as2',
              signed: true,
              received_data: true,
            },
          ],
        },
        {
          service_id: 'bank_statement_2',
          as_id_list: ['as1'],
          min_as: 1,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
          ],
        },
      ],
      request_message_hash: '/+m2u2JBZ3zADwVdtLiMkvMjONWL8ZsDTqduLp3csGU=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'NHzTRPXXCcCFNHBrA3DSJnVDvXaz+u76Qix55ADLxiWktvJGFY7/wXTK/OCH6Gs1diVM6KNuh6rLP5cPWiaJdkx2zP+3An+1/ox+HqqKb6AKIO0EAKaH3seO1F4wqLrf1ymLN7dobEwntuR3n4XI9eaXsrhNNlTuilYDG4+iA/xzBuCB9QBEhb6hBvBGPsG2BpQiHVveh4t0+6MxdpgkzQuNyzMLqvrj7e71YQjY2cMBC0zGbzcwsyI4rM6NEptsVsf7IJKXW5YNBygp8dxuLCXm5dcksN2MouYp+VU36mTYiAr74sn8isXOsWeVwgbvEOh93uB7ZjQomcU0L1UXDQ==',
          idp_id: 'idp1',
          valid_ial: true,
          valid_signature: true,
        },
      ],
      closed: true,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 488,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('partial_completed');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        '1804ac0308d22b4203dfc12a930394efa081f30a734c748d2f1966b8c62bb326',
      min_idp: 1,
      min_aal: 3,
      min_ial: 2.3,
      request_timeout: 86400,
      idp_id_list: ['idp1'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1', 'as2'],
          min_as: 0,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
            {
              as_id: 'as2',
              error_code: 10101,
            },
          ],
        },
        {
          service_id: 'bank_statement_2',
          as_id_list: ['as1', 'as2'],
          min_as: 1,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
          ],
        },
      ],
      request_message_hash: '/+m2u2JBZ3zADwVdtLiMkvMjONWL8ZsDTqduLp3csGU=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'NHzTRPXXCcCFNHBrA3DSJnVDvXaz+u76Qix55ADLxiWktvJGFY7/wXTK/OCH6Gs1diVM6KNuh6rLP5cPWiaJdkx2zP+3An+1/ox+HqqKb6AKIO0EAKaH3seO1F4wqLrf1ymLN7dobEwntuR3n4XI9eaXsrhNNlTuilYDG4+iA/xzBuCB9QBEhb6hBvBGPsG2BpQiHVveh4t0+6MxdpgkzQuNyzMLqvrj7e71YQjY2cMBC0zGbzcwsyI4rM6NEptsVsf7IJKXW5YNBygp8dxuLCXm5dcksN2MouYp+VU36mTYiAr74sn8isXOsWeVwgbvEOh93uB7ZjQomcU0L1UXDQ==',
          idp_id: 'idp1',
          valid_ial: true,
          valid_signature: true,
        },
      ],
      closed: true,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 488,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('confirmed');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        '2904ac0308d22b4203dfc12a930394efa081f30a734c748d2f1966b8c62bb326',
      min_idp: 1,
      min_aal: 3,
      min_ial: 2.3,
      request_timeout: 86400,
      idp_id_list: ['idp1'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1', 'as2'],
          min_as: 0,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
          ],
        },
        {
          service_id: 'bank_statement_2',
          as_id_list: ['as1', 'as2'],
          min_as: 0,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
            {
              as_id: 'as2',
              signed: true,
              received_data: true,
            },
          ],
        },
      ],
      request_message_hash: '/+m2u2JBZ3zADwVdtLiMkvMjONWL8ZsDTqduLp3csGU=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'NHzTRPXXCcCFNHBrA3DSJnVDvXaz+u76Qix55ADLxiWktvJGFY7/wXTK/OCH6Gs1diVM6KNuh6rLP5cPWiaJdkx2zP+3An+1/ox+HqqKb6AKIO0EAKaH3seO1F4wqLrf1ymLN7dobEwntuR3n4XI9eaXsrhNNlTuilYDG4+iA/xzBuCB9QBEhb6hBvBGPsG2BpQiHVveh4t0+6MxdpgkzQuNyzMLqvrj7e71YQjY2cMBC0zGbzcwsyI4rM6NEptsVsf7IJKXW5YNBygp8dxuLCXm5dcksN2MouYp+VU36mTYiAr74sn8isXOsWeVwgbvEOh93uB7ZjQomcU0L1UXDQ==',
          idp_id: 'idp1',
          valid_ial: true,
          valid_signature: true,
        },
      ],
      closed: true,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 488,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('partial_completed');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        '2904ac0308d22b4203dfc12a930394efa081f30a734c748d2f1966b8c62bb326',
      min_idp: 1,
      min_aal: 3,
      min_ial: 2.3,
      request_timeout: 86400,
      idp_id_list: ['idp1'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1', 'as2'],
          min_as: 0,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
          ],
        },
        {
          service_id: 'bank_statement_2',
          as_id_list: ['as1', 'as2'],
          min_as: 0,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
            {
              as_id: 'as2',
              error_code: 10101,
            },
          ],
        },
      ],
      request_message_hash: '/+m2u2JBZ3zADwVdtLiMkvMjONWL8ZsDTqduLp3csGU=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'NHzTRPXXCcCFNHBrA3DSJnVDvXaz+u76Qix55ADLxiWktvJGFY7/wXTK/OCH6Gs1diVM6KNuh6rLP5cPWiaJdkx2zP+3An+1/ox+HqqKb6AKIO0EAKaH3seO1F4wqLrf1ymLN7dobEwntuR3n4XI9eaXsrhNNlTuilYDG4+iA/xzBuCB9QBEhb6hBvBGPsG2BpQiHVveh4t0+6MxdpgkzQuNyzMLqvrj7e71YQjY2cMBC0zGbzcwsyI4rM6NEptsVsf7IJKXW5YNBygp8dxuLCXm5dcksN2MouYp+VU36mTYiAr74sn8isXOsWeVwgbvEOh93uB7ZjQomcU0L1UXDQ==',
          idp_id: 'idp1',
          valid_ial: true,
          valid_signature: true,
        },
      ],
      closed: true,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 488,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('confirmed');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        '2904ac0308d22b4203dfc12a930394efa081f30a734c748d2f1966b8c62bb326',
      min_idp: 1,
      min_aal: 3,
      min_ial: 2.3,
      request_timeout: 86400,
      idp_id_list: ['idp1'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1', 'as2'],
          min_as: 0,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
            {
              as_id: 'as2',
              error_code: 10101,
            },
          ],
        },
        {
          service_id: 'bank_statement_2',
          as_id_list: ['as1', 'as2'],
          min_as: 0,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
            {
              as_id: 'as2',
              error_code: 10101,
            },
          ],
        },
      ],
      request_message_hash: '/+m2u2JBZ3zADwVdtLiMkvMjONWL8ZsDTqduLp3csGU=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'NHzTRPXXCcCFNHBrA3DSJnVDvXaz+u76Qix55ADLxiWktvJGFY7/wXTK/OCH6Gs1diVM6KNuh6rLP5cPWiaJdkx2zP+3An+1/ox+HqqKb6AKIO0EAKaH3seO1F4wqLrf1ymLN7dobEwntuR3n4XI9eaXsrhNNlTuilYDG4+iA/xzBuCB9QBEhb6hBvBGPsG2BpQiHVveh4t0+6MxdpgkzQuNyzMLqvrj7e71YQjY2cMBC0zGbzcwsyI4rM6NEptsVsf7IJKXW5YNBygp8dxuLCXm5dcksN2MouYp+VU36mTYiAr74sn8isXOsWeVwgbvEOh93uB7ZjQomcU0L1UXDQ==',
          idp_id: 'idp1',
          valid_ial: true,
          valid_signature: true,
        },
      ],
      closed: true,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 488,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('errored');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        '2904ac0308d22b4203dfc12a930394efa081f30a734c748d2f1966b8c62bb326',
      min_idp: 1,
      min_aal: 3,
      min_ial: 2.3,
      request_timeout: 86400,
      idp_id_list: ['idp1'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1', 'as2'],
          min_as: 0,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
          ],
        },
        {
          service_id: 'bank_statement_2',
          as_id_list: ['as1', 'as2'],
          min_as: 0,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
          ],
        },
        {
          service_id: 'bank_statement_3',
          as_id_list: ['as1', 'as2'],
          min_as: 1,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
          ],
        },
      ],
      request_message_hash: '/+m2u2JBZ3zADwVdtLiMkvMjONWL8ZsDTqduLp3csGU=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'NHzTRPXXCcCFNHBrA3DSJnVDvXaz+u76Qix55ADLxiWktvJGFY7/wXTK/OCH6Gs1diVM6KNuh6rLP5cPWiaJdkx2zP+3An+1/ox+HqqKb6AKIO0EAKaH3seO1F4wqLrf1ymLN7dobEwntuR3n4XI9eaXsrhNNlTuilYDG4+iA/xzBuCB9QBEhb6hBvBGPsG2BpQiHVveh4t0+6MxdpgkzQuNyzMLqvrj7e71YQjY2cMBC0zGbzcwsyI4rM6NEptsVsf7IJKXW5YNBygp8dxuLCXm5dcksN2MouYp+VU36mTYiAr74sn8isXOsWeVwgbvEOh93uB7ZjQomcU0L1UXDQ==',
          idp_id: 'idp1',
          valid_ial: true,
          valid_signature: true,
        },
      ],
      closed: true,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 488,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('confirmed');
  });

  it('should derive request status correctly', () => {
    const requestStatus = utils.getRequestStatus({
      request_id:
        '2904ac0308d22b4203dfc12a930394efa081f30a734c748d2f1966b8c62bb326',
      min_idp: 1,
      min_aal: 3,
      min_ial: 2.3,
      request_timeout: 86400,
      idp_id_list: ['idp1'],
      data_request_list: [
        {
          service_id: 'bank_statement',
          as_id_list: ['as1', 'as2'],
          min_as: 0,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
          ],
        },
        {
          service_id: 'bank_statement_2',
          as_id_list: ['as1', 'as2'],
          min_as: 0,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
            {
              as_id: 'as2',
              error_code: 10101,
            },
          ],
        },
        {
          service_id: 'bank_statement_3',
          as_id_list: ['as1', 'as2'],
          min_as: 1,
          request_params_hash: 'MyUwI7quJS54s6Xh/m4r6WEEa9mL9gKGqPlBrRSoD0A=',
          response_list: [
            {
              as_id: 'as1',
              error_code: 10101,
            },
          ],
        },
      ],
      request_message_hash: '/+m2u2JBZ3zADwVdtLiMkvMjONWL8ZsDTqduLp3csGU=',
      response_list: [
        {
          ial: 2.3,
          aal: 3,
          status: 'accept',
          signature:
            'NHzTRPXXCcCFNHBrA3DSJnVDvXaz+u76Qix55ADLxiWktvJGFY7/wXTK/OCH6Gs1diVM6KNuh6rLP5cPWiaJdkx2zP+3An+1/ox+HqqKb6AKIO0EAKaH3seO1F4wqLrf1ymLN7dobEwntuR3n4XI9eaXsrhNNlTuilYDG4+iA/xzBuCB9QBEhb6hBvBGPsG2BpQiHVveh4t0+6MxdpgkzQuNyzMLqvrj7e71YQjY2cMBC0zGbzcwsyI4rM6NEptsVsf7IJKXW5YNBygp8dxuLCXm5dcksN2MouYp+VU36mTYiAr74sn8isXOsWeVwgbvEOh93uB7ZjQomcU0L1UXDQ==',
          idp_id: 'idp1',
          valid_ial: true,
          valid_signature: true,
        },
      ],
      closed: true,
      timed_out: false,
      purpose: '',
      mode: 2,
      request_type: null,
      requester_node_id: 'rp1',
      creation_block_height: 488,
      creation_chain_id: 'test-chain-NDID',
    });

    expect(requestStatus).to.equal('confirmed');
  });
});
