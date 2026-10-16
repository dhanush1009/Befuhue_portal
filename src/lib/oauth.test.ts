import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { verifyPkce } from './oauth';

describe('verifyPkce', () => {
  it('accepts a correct S256 challenge', () => {
    const verifier = 'a-random-high-entropy-verifier-string-1234567890';
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    expect(verifyPkce(verifier, challenge, 'S256')).toBe(true);
  });

  it('rejects an incorrect S256 verifier', () => {
    const verifier = 'the-real-verifier';
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    expect(verifyPkce('a-different-verifier', challenge, 'S256')).toBe(false);
  });

  it('accepts a correct plain challenge', () => {
    expect(verifyPkce('same-value', 'same-value', 'plain')).toBe(true);
  });

  it('rejects a mismatched plain challenge', () => {
    expect(verifyPkce('one-value', 'another-value', 'plain')).toBe(false);
  });

  it('rejects an unsupported challenge method', () => {
    expect(verifyPkce('verifier', 'challenge', 'md5')).toBe(false);
  });

  it('does not accept a plain-style match when the method is S256', () => {
    // Guards against a downgrade where the verifier is passed through unhashed.
    const verifier = 'not-actually-hashed';
    expect(verifyPkce(verifier, verifier, 'S256')).toBe(false);
  });
});
