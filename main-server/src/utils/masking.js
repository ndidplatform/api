const X_CACHE = 'x'.repeat(100);

export function maskIdentifier(identifier) {
  if (typeof identifier !== 'string') {
    return identifier;
  }

  const len = identifier.length;

  if (len <= 6) {
    return X_CACHE.slice(0, len);
  }

  const maskLen = len - 4;

  const mask = maskLen <= 100 ? X_CACHE.slice(0, maskLen) : 'x'.repeat(maskLen);

  return mask + identifier.slice(-4);
}

export function maskUrl(urlStr) {
  if (typeof urlStr !== 'string' || !urlStr) return urlStr;

  const queryIndex = urlStr.indexOf('?');
  const hasQuery = queryIndex !== -1;
  const pathname = hasQuery ? urlStr.slice(0, queryIndex) : urlStr;
  const queryString = hasQuery ? urlStr.slice(queryIndex) : '';

  const segments = pathname.split('/');

  // Standard routes usually start at index 1, but versioned paths like /v6/ identity start at index 2
  let rootIndex = -1;

  if (
    segments[1] === 'identity' ||
    segments[1] === 'rp' ||
    segments[1] === 'utility'
  ) {
    rootIndex = 1;
  } else if (
    segments[2] === 'identity' ||
    segments[2] === 'rp' ||
    segments[2] === 'utility'
  ) {
    rootIndex = 2;
  }

  if (rootIndex === -1) return urlStr;

  // Calculate the identifier's location relative to dynamic rootIndex
  const rootSegment = segments[rootIndex];
  const nextSegment = segments[rootIndex + 1];
  let idIndex = -1;

  if (rootSegment === 'identity') {
    idIndex = rootIndex + 2;
  } else if (rootSegment === 'rp' && nextSegment === 'requests') {
    // Pattern: /rp/requests/{namespace}/{id})
    idIndex = rootIndex + 3;
  } else if (rootSegment === 'utility' && nextSegment === 'idp') {
    // Pattern: /utility/idp/{namespace}/{id}
    idIndex = rootIndex + 3;
  }

  if (idIndex !== -1 && segments[idIndex]) {
    const identifier = segments[idIndex];
    segments[idIndex] = maskIdentifier(identifier);
  }

  return segments.join('/') + queryString;
}
