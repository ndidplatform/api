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

export function validateThaiIdNumber(thaiId) {
  // if (typeof thaiId !== 'string') {
  //   thaiId = thaiId.toString();
  // }

  if (thaiId.length != 13) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const n = parseInt(thaiId[i]);
    sum = sum + (14 - (i + 1)) * n;
  }
  const x = sum % 11;

  let checksum;
  if (x <= 1) {
    checksum = 1 - x;
  } else {
    checksum = 11 - x;
  }

  const lastNumber = parseInt(thaiId[12]);

  return checksum == lastNumber;
}
