import { role } from '../../../node';

export function rpOnlyHandler(req, res, next) {
  if (role !== 'rp' && role !== 'proxy') {
    res.status(404).end();
    return;
  }
  next();
}

export function idpOnlyHandler(req, res, next) {
  if (role !== 'idp' && role !== 'proxy') {
    res.status(404).end();
    return;
  }
  next();
}

export function asOnlyHandler(req, res, next) {
  if (role !== 'as' && role !== 'proxy') {
    res.status(404).end();
    return;
  }
  next();
}

export function ndidOnlyHandler(req, res, next) {
  if (role !== 'ndid') {
    res.status(404).end();
    return;
  }
  next();
}
