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

import fs from 'fs';
import mustache from 'mustache';

import logger from '../logger';

import * as config from '../config';

let createIdentityTemplate;
let addAccessorTemplate;
let revokeAccessorTemplate;

try {
  createIdentityTemplate = fs.readFileSync(
    config.createIdentityRequestMessageTemplateFilepath,
    'utf8'
  );
  addAccessorTemplate = fs.readFileSync(
    config.addAccessorRequestMessageTemplateFilepath,
    'utf8'
  );
  revokeAccessorTemplate = fs.readFileSync(
    config.revokeAccessorRequestMessageTemplateFilepath,
    'utf8'
  );
} catch (error) {
  logger.warn({
    message: 'Cannot read request message template files',
    err: error,
  });
}

export function getRequestMessageForCreatingIdentity({
  reference_id,
  namespace,
  identifier,
  node_id,
  node_name,
}) {
  return mustache.render(createIdentityTemplate, {
    reference_id,
    namespace,
    identifier,
    node_id,
    node_name,
  });
}

export function getRequestMessageForAddingAccessor({
  reference_id,
  namespace,
  identifier,
  node_id,
  node_name,
}) {
  return mustache.render(addAccessorTemplate, {
    reference_id,
    namespace,
    identifier,
    node_id,
    node_name,
  });
}

export function getRequestMessageForRevokingAccessor({
  reference_id,
  namespace,
  identifier,
  node_id,
  node_name,
  accessor_id,
}) {
  return mustache.render(revokeAccessorTemplate, {
    reference_id,
    namespace,
    identifier,
    node_id,
    node_name,
    accessor_id,
  });
}