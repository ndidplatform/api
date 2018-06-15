// Adapt from https://github.com/crypto-browserify/parse-asn1

import * as structure from './structure';

const findProc = /Proc-Type: 4,ENCRYPTED[\n\r]+DEK-Info: AES-((?:128)|(?:192)|(?:256))-CBC,([0-9A-H]+)[\n\r]+([0-9A-z\n\r+/=]+)[\n\r]+/m;
const startRegex = /^-----BEGIN ((?:.* KEY)|CERTIFICATE)-----/m;
const fullRegex = /^-----BEGIN ((?:.* KEY)|CERTIFICATE)-----([0-9A-z\n\r+/=]+)-----END \1-----$/m;

function fixProc(okey, password) {
  const key = okey.toString();
  const match = key.match(findProc);
  let decrypted;
  if (!match) {
    const match2 = key.match(fullRegex);
    decrypted = new Buffer(match2[2].replace(/[\r\n]/g, ''), 'base64');
  } else {
    // Key with passphase
    // var suite = 'aes' + match[1]
    // var iv = new Buffer(match[2], 'hex')
    // var cipherText = new Buffer(match[3].replace(/[\r\n]/g, ''), 'base64')
    // var cipherKey = evp(password, iv.slice(0, 8), parseInt(match[1], 10)).key
    // var out = []
    // var cipher = ciphers.createDecipheriv(suite, cipherKey, iv)
    // out.push(cipher.update(cipherText))
    // out.push(cipher.final())
    // decrypted = Buffer.concat(out)
  }
  const tag = key.match(startRegex)[1];
  return {
    tag: tag,
    data: decrypted,
  };
}

export function parseKey(buffer) {
  var password;
  if (typeof buffer === 'object' && !Buffer.isBuffer(buffer)) {
    password = buffer.passphrase;
    buffer = buffer.key;
  }
  if (typeof buffer === 'string') {
    buffer = new Buffer(buffer);
  }

  var stripped = fixProc(buffer, password);

  var type = stripped.tag;
  var data = stripped.data;
  var subtype, ndata;
  switch (type) {
    case 'PUBLIC KEY':
      if (!ndata) {
        ndata = structure.PublicKey.decode(data, 'der');
      }
      subtype = ndata.algorithm.algorithm.join('.');
      switch (subtype) {
        case '1.2.840.113549.1.1.1':
          return structure.RSAPublicKey.decode(
            ndata.subjectPublicKey.data,
            'der'
          );
        case '1.2.840.10045.2.1':
          ndata.subjectPrivateKey = ndata.subjectPublicKey;
          return {
            type: 'ec',
            data: ndata,
          };
        case '1.2.840.10040.4.1':
          ndata.algorithm.params.pub_key = structure.DSAparam.decode(
            ndata.subjectPublicKey.data,
            'der'
          );
          return {
            type: 'dsa',
            data: ndata.algorithm.params,
          };
        default:
          throw new Error('unknown key id ' + subtype);
      }
    // case 'ENCRYPTED PRIVATE KEY':
    //   data = structure.EncryptedPrivateKey.decode(data, 'der');
    //   data = decrypt(data, password);
    case 'PRIVATE KEY':
      ndata = structure.PrivateKey.decode(data, 'der');
      subtype = ndata.algorithm.algorithm.join('.');
      switch (subtype) {
        case '1.2.840.113549.1.1.1':
          return structure.RSAPrivateKey.decode(ndata.subjectPrivateKey, 'der');
        case '1.2.840.10045.2.1':
          return {
            curve: ndata.algorithm.curve,
            privateKey: structure.ECPrivateKey.decode(
              ndata.subjectPrivateKey,
              'der'
            ).privateKey,
          };
        case '1.2.840.10040.4.1':
          ndata.algorithm.params.priv_key = structure.DSAparam.decode(
            ndata.subjectPrivateKey,
            'der'
          );
          return {
            type: 'dsa',
            params: ndata.algorithm.params,
          };
        default:
          throw new Error('unknown key id ' + subtype);
      }
    case 'RSA PUBLIC KEY':
      return structure.RSAPublicKey.decode(data, 'der');
    case 'RSA PRIVATE KEY':
      return structure.RSAPrivateKey.decode(data, 'der');
    case 'DSA PRIVATE KEY':
      return {
        type: 'dsa',
        params: structure.DSAPrivateKey.decode(data, 'der'),
      };
    case 'EC PRIVATE KEY':
      data = structure.ECPrivateKey.decode(data, 'der');
      return {
        curve: data.parameters.value,
        privateKey: data.privateKey,
      };
    default:
      throw new Error('unknown key type ' + type);
  }
}
