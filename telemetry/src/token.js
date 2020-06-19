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

export default class TokenManager {
  constructor(getToken) {
    this.getToken = async (nodeId) => getToken(nodeId);
    this.tokens = new Object();
  }

  setGetToken(getTokenFn) {
    this.getToken = getTokenFn;
  }

  async getTokenFromNodeId(nodeId) {
    if (this.tokens[nodeId] == undefined && this.getToken != undefined) {
      this.tokens[nodeId] = await this.getToken(nodeId);
      console.log('token', nodeId, this.tokens[nodeId]);
    }
    return this.tokens[nodeId];
  }

  removeTokenFromNodeId(nodeId) {
    delete this.tokens[nodeId];
  }

  invalidateToken(nodeId, token) {
    if (this.getTokenFromNodeId(nodeId) === token) {
      this.removeToken(nodeId);
    }
  }
};
