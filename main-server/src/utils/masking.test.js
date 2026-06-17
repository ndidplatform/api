import { maskIdentifier, maskUrl } from './masking';

const { expect } = require('chai');

describe('maskIdentifier()', () => {
  describe('when identifier length is 6 or less', () => {
    it('should mask the entire string with "x" if length is less than 6', () => {
      expect(maskIdentifier('abc')).to.equal('xxx');
      expect(maskIdentifier('12345')).to.equal('xxxxx');
    });

    it('should mask the entire string with "x" if length is exactly 6', () => {
      expect(maskIdentifier('abcdef')).to.equal('xxxxxx');
    });

    it('should return an empty string if given an empty string', () => {
      expect(maskIdentifier('')).to.equal('');
    });
  });

  describe('when identifier length is greater than 6', () => {
    it('should mask all but the last 4 characters if length is exactly 7', () => {
      // 7 characters -> 3 'x's + last 4 characters
      expect(maskIdentifier('abcdefg')).to.equal('xxxdefg');
    });

    it('should mask all but the last 4 characters for long strings', () => {
      expect(maskIdentifier('1309913659936')).to.equal('xxxxxxxxx9936');
      expect(maskIdentifier('A12345678')).to.equal('xxxxx5678');
    });
  });

  describe('Edge Cases & Types', () => {
    it('should handle strings made entirely of spaces', () => {
      expect(maskIdentifier('   ')).to.equal('xxx');
      expect(maskIdentifier('        ')).to.equal('xxxx    ');
    });
  });
});

describe('maskUrl()', () => {
  describe('Standard URL paths (No Version Prefix)', () => {
    it('should mask paths matching /rp/requests/{namespace}/{identifier} (with citizen_id as namespace)', () => {
      const input = '/rp/requests/citizen_id/1309913659936';
      const expected = '/rp/requests/citizen_id/xxxxxxxxx9936';
      expect(maskUrl(input)).to.equal(expected);
    });

    it('should mask paths matching /rp/requests/{namespace}/{identifier} (with passport as namespace)', () => {
      const input = '/rp/requests/passport/A12345678';
      const expected = '/rp/requests/passport/xxxxx5678';
      expect(maskUrl(input)).to.equal(expected);
    });

    it('should mask paths matching /identity/{namespace}/{identifier}', () => {
      const input = '/identity/citizen_id/1309913659936';
      const expected = '/identity/citizen_id/xxxxxxxxx9936';
      expect(maskUrl(input)).to.equal(expected);
    });

    it('should mask paths matching /identity/{namespace}/{identifier}/subpath (with citizen_id as namespace)', () => {
      const input = '/identity/citizen_id/1309913659936/ial';
      const expected = '/identity/citizen_id/xxxxxxxxx9936/ial';
      expect(maskUrl(input)).to.equal(expected);
    });

    it('should mask paths matching /identity/{namespace}/{identifier}/subpath (with passport as namespace)', () => {
      const input = '/identity/passport/A12345678/ial';
      const expected = '/identity/passport/xxxxx5678/ial';
      expect(maskUrl(input)).to.equal(expected);
    });
  });

  describe('Versioned URL paths (/v6, /v7, etc.)', () => {
    it('should dynamically identify and mask /v6/identity paths', () => {
      const input = '/v6/identity/citizen_id/1309913659936';
      const expected = '/v6/identity/citizen_id/xxxxxxxxx9936';
      expect(maskUrl(input)).to.equal(expected);
    });

    it('should dynamically identify and mask /v7/rp/requests deep subpaths', () => {
      const input = '/v7/rp/requests/citizen_id/1309913659936/accessors';
      const expected = '/v7/rp/requests/citizen_id/xxxxxxxxx9936/accessors';
      expect(maskUrl(input)).to.equal(expected);
    });

    it('should dynamically identify and mask double-digit versions like /v12/utility/idp paths', () => {
      const input = '/v12/utility/idp/tax_id/1309913659936';
      const expected = '/v12/utility/idp/tax_id/xxxxxxxxx9936';
      expect(maskUrl(input)).to.equal(expected);
    });
  });

  describe('Query String Retention', () => {
    it('should mask the target path segment while preserving complex query parameters intact', () => {
      const input =
        '/v12/utility/idp/tax_id/1309913659936?node_id=ABC-123&status=active';
      const expected =
        '/v12/utility/idp/tax_id/xxxxxxxxx9936?node_id=ABC-123&status=active';
      expect(maskUrl(input)).to.equal(expected);
    });
  });

  describe('Edge Cases and Guardrails', () => {
    it('should masked all the identifier if its character length is 6 or less', () => {
      const input = '/v6/utility/idp/tax_id/1234';
      const expected = '/v6/utility/idp/tax_id/xxxx';
      expect(maskUrl(input)).to.equal(expected);
    });

    it('should return the original string completely untouched if no matching framework keyword is found', () => {
      const input = '/unrelated/path/v6/profile/1234567890';
      expect(maskUrl(input)).to.equal(input);
    });

    it('should handle non-string or empty entry types safely without crashing', () => {
      expect(maskUrl(null)).to.be.null;
      expect(maskUrl(undefined)).to.be.undefined;
      expect(maskUrl('')).to.equal('');
    });
  });
});
