import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// Encrypts the sensitive HR fields (bank account, PAN, Aadhaar, UAN) before they are stored
// (AES-256-GCM). The key is derived from the app's AUTH_SECRET, so there is nothing extra to
// configure and a database leak alone is useless. If AUTH_SECRET is ever rotated these values can
// no longer be read and the employees would have to enter them again.

const secret = () => process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

function keyFrom(appSecret: string | undefined): Buffer {
  if (!appSecret) throw new Error('AUTH_SECRET is not set, so employee details cannot be stored securely.');
  return createHash('sha256').update(`employee-details:${appSecret}`).digest();
}

/** "v1.<iv>.<tag>.<ciphertext>" (all base64url). */
export function encryptField(plain: string, appSecret: string | undefined = secret()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(appSecret), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), enc.toString('base64url')].join('.');
}

export function decryptField(stored: string, appSecret: string | undefined = secret()): string {
  const [version, iv, tag, data] = stored.split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unreadable stored value.');
  const decipher = createDecipheriv('aes-256-gcm', keyFrom(appSecret), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

export const last4 = (value: string): string => value.slice(-4);

/** What the screens show instead of the real number: "XXXXXX1234". */
export function maskedFrom(last: string | null | undefined, length: number): string | null {
  if (!last) return null;
  return 'X'.repeat(Math.max(length - last.length, 0)) + last;
}
