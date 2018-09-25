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

import chai from 'chai';
import MQLogic from './mq_logic';
const expect = chai.expect;

describe('MQ Retry Logic Unit Test', function() {
  it('should perform send properly', function(done) {
    let logic = new MQLogic({
      id: 'logic1',
      timeout: 1000,
      totalTimeout: 3000,
    });
    let doneNow = false;
    logic.on('PerformSend', function(params) {
      expect(params.payload).to.be.instanceof(Buffer);
      expect(params.payload.toString()).to.equal('testPayload-1');
      expect(params.dest).to.equal('testDest-1');
      //expect(params.msgId).to.equal(1,' msg 1');

      if (doneNow == false) {
        doneNow = true;
        expect(params.seqId).to.equal(1, 'seq 1');
        logic._cleanUp(params.msgId);
        done();
      }
    });
    logic.send('testDest-1', Buffer.from('testPayload-1'));
  });

  it('should do clean up properly', function(done) {
    let logic = new MQLogic({ timeout: 1000, totalTimeout: 3000 });
    let msgId;
    logic.on('PerformSend', function(params) {
      expect(params.payload).to.be.instanceof(Buffer);
      expect(params.payload.toString()).to.equal('testPayload-2');
      expect(params.dest).to.equal('testDest-2');
      //expect(params.msgId).to.equal(1, 'first msg')
      //expect(params.seqId).to.equal(1, 'first sequence');
      msgId = params.msgId;
    });
    logic.on('PerformCleanUp', function(seqId) {
      //expect(seqId).to.equal(1, 'check cleanup');
      done();
    });
    logic.send('testDest-2', Buffer.from('testPayload-2'));
    logic.ackReceived(msgId);
  });

  it('should handle retry command properly', function(done) {
    let count = 0;
    let logic2 = new MQLogic({ timeout: 200, totalTimeout: 500 });
    logic2.on('PerformSend', function(params) {
      count++;
      //expect(params.msgId).to.equal(1, 'msg id 1');
      expect(params.seqId).to.equal(count, 'seq id should increase');
    });

    logic2.on('PerformTotalTimeout', function(params) {
      //expect(params.msgId).to.equal(1, 'timeout for id 1');
      done();
    });
    logic2.send('testDest-3', Buffer.from('testPayload-3'));
  });
});
