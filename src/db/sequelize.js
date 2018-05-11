import path from 'path';

import * as config from '../config';

const dbPath = path.join(__dirname, `../../db-api-${config.nodeId}`);

export function getList(dataName, key) {

}

export function getListRange(dataName, keyRange) {

}

export function pushToList(dataName, key, value) {

}

export function removeFromList(dataName, key, valuesToRemove) {

}

export function removeList(dataName, key) {

}

export function get(dataName, key) {

}

export function set(dataName, key, value) {

}

export function remove(dataName, key) {

}