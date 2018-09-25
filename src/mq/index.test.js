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

/*const chai = require('chai');
const expect = chai.expect;
const chaiHttp = require('chai-http');
chai.use(chaiHttp);

var mq = require('./index.js');

//TODO: get the test done here
describe.skip('Test mq usage', function () {

  before(function() {


  });

  it('should send data via message queue successfully', function(done) {


    mq.eventEmitter.on("message", function(msg){
      expect(msg).to.be.a('String').and.equal('"test message 1"');
      done();
    });

    mq.send([{ip:"127.0.0.1",
              port:5555,
              public_key:""}], 'test message 1');


  });


});

*/