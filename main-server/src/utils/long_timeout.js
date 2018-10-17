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

// Adapted from https://github.com/tellnes/long-timeout

const TIMEOUT_MAX = 2147483647; // 2^31-1 (32-bit integer)

export function setTimeout(listener, after) {
  return new Timeout(listener, after);
}

export function setInterval(listener, after) {
  return new Interval(listener, after);
}

export function clearTimeout(timer) {
  if (timer) timer.close();
}

export function clearInterval(timer) {
  if (timer) timer.close();
}

export class Timeout {
  constructor(listener, after) {
    this.listener = listener;
    this.after = after;
    this.unreffed = false;
    this.start();
  }

  unref() {
    if (!this.unreffed) {
      this.unreffed = true;
      this.timeout.unref();
    }
  }

  ref() {
    if (this.unreffed) {
      this.unreffed = false;
      this.timeout.ref();
    }
  }

  start() {
    if (this.after <= TIMEOUT_MAX) {
      this.timeout = global.setTimeout(this.listener, this.after);
    } else {
      this.timeout = global.setTimeout(() => {
        this.after -= TIMEOUT_MAX;
        this.start();
      }, TIMEOUT_MAX);
    }
    if (this.unreffed) {
      this.timeout.unref();
    }
  }

  close() {
    global.clearTimeout(this.timeout);
  }
}

export class Interval {
  constructor(listener, after) {
    this.listener = listener;
    this.after = this.timeLeft = after;
    this.unreffed = false;
    this.start();
  }
  unref() {
    if (!this.unreffed) {
      this.unreffed = true;
      this.timeout.unref();
    }
  }

  ref() {
    if (this.unreffed) {
      this.unreffed = false;
      this.timeout.ref();
    }
  }

  start() {
    if (this.timeLeft <= TIMEOUT_MAX) {
      this.timeout = global.setTimeout(() => {
        this.listener();
        this.timeLeft = this.after;
        this.start();
      }, this.timeLeft);
    } else {
      this.timeout = global.setTimeout(() => {
        this.timeLeft -= TIMEOUT_MAX;
        this.start();
      }, TIMEOUT_MAX);
    }
    if (this.unreffed) {
      this.timeout.unref();
    }
  }

  close() {
    global.clearTimeout(this.timeout);
  }
}
