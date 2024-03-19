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

import * as thaiIdUtils from './thai_id';

const chai = require('chai');
const expect = chai.expect;

describe('Test Thai citizen ID functions', () => {
  it('should validate valid Thai citizen ID correctly (1)', () => {
    const thaiId = '1345951597671';

    const valid = thaiIdUtils.validateThaiIdNumber(thaiId);

    expect(valid).to.equal(true);
  });

  it('should validate valid Thai citizen ID correctly (2)', () => {
    const thaiId = '6000000000000';

    const valid = thaiIdUtils.validateThaiIdNumber(thaiId);

    expect(valid).to.equal(true);
  });

  it('should validate invalid Thai citizen ID correctly (1)', () => {
    const thaiId = '3712644096692';

    const valid = thaiIdUtils.validateThaiIdNumber(thaiId);

    expect(valid).to.equal(false);
  });

  it('should validate invalid Thai citizen ID correctly (2)', () => {
    const thaiId = 'ab1264v096692';

    const valid = thaiIdUtils.validateThaiIdNumber(thaiId);

    expect(valid).to.equal(false);
  });

  it('should validate invalid Thai citizen ID correctly (3)', () => {
    const thaiId = '331264009669z';

    const valid = thaiIdUtils.validateThaiIdNumber(thaiId);

    expect(valid).to.equal(false);
  });

  // it('should validate invalid Thai citizen ID correctly (4)', () => {
  //   const thaiId = 3312640096690;

  //   const valid = thaiIdUtils.validateThaiIdNumber(thaiId);

  //   expect(valid).to.equal(false);
  // });

  it('should validate invalid Thai citizen ID length correctly (1)', () => {
    const thaiId = '12345';

    const valid = thaiIdUtils.validateThaiIdNumber(thaiId);

    expect(valid).to.equal(false);
  });
});
