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

export default class RequestQueue {
  constructor() {
    // Stores the pending tasks for each ID
    this.subQueues = new Map();
    // Tracks if an ID is currently executing a task
    this.processingIds = new Set();

    this.totalTasks = 0;
    this.pendingTasksCount = 0;
    this.processingTasksCount = 0;

    this._idleResolver = null;
  }

  /**
   * @param {string} requestId - Tasks with the same ID run serially.
   * @param {Function} task - The async function to run
   * @param {...any} args - Any number of arguments to pass to the task
   */
  async enqueue(requestId, task, ...args) {
    this.totalTasks++;

    return new Promise((resolve, reject) => {
      // Wrap the task to capture its result/error
      const taskWrapper = async () => {
        try {
          this.processingTasksCount++;
          const result = await task(...args);
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.processingTasksCount--;
          this.totalTasks--;
          this._next(requestId);
          this._checkIdle();
        }
      };

      this.pendingTasksCount++;

      // Add to sub-queue
      if (!this.subQueues.has(requestId)) {
        this.subQueues.set(requestId, []);
      }
      this.subQueues.get(requestId).push(taskWrapper);

      // Start execution if not already running for this ID
      if (!this.processingIds.has(requestId)) {
        this._next(requestId);
      }
    });
  }

  /**
   * Returns a promise that resolves when all queues are empty
   * and no tasks are currently running.
   */
  async onIdle() {
    if (this.totalTasks === 0) return Promise.resolve();

    // If already waiting, return the existing promise
    if (this._idlePromise) return this._idlePromise;

    this._idlePromise = new Promise((resolve) => {
      this._idleResolver = resolve;
    });

    return this._idlePromise;
  }

  _checkIdle() {
    if (this.totalTasks === 0 && this._idleResolver) {
      const resolve = this._idleResolver;
      this._idleResolver = null;
      this._idlePromise = null;
      resolve();
    }
  }

  _next(requestId) {
    const queue = this.subQueues.get(requestId);

    if (queue && queue.length > 0) {
      this.processingIds.add(requestId);
      const nextTask = queue.shift();
      this.pendingTasksCount--;
      nextTask();
    } else {
      // Empty queue, cleanup
      this.processingIds.delete(requestId);
      this.subQueues.delete(requestId);
    }
  }

  getTotalTasks() {
    return this.totalTasks;
  }

  getProcessingTasksCount() {
    return this.processingTasksCount;
  }

  getRequestsInQueueCount() {
    return this.subQueues.size;
  }

  getPendingTasksInQueueCount() {
    return this.pendingTasksCount;
  }
}
