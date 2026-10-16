import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'crypto';

// Encrypts the Meta access token before it is stored (AES-256-GCM). The key is derived from the
// app's own AUTH_SECRET, so there is nothing extra to configure and a database leak alone is useless.

function keyFrom(secret: string | undefined): Buffer {
  if (!secret) throw new Error('AUTH_SECRET is not set, so the Meta token cannot be stored securely.');
  return createHash('sha256').update(`meta-token:${secret}`).digest();
}

const secret = () => process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

/** "v1.<iv>.<tag>.<ciphertext>" (all base64url). */
export function encryptToken(plain: string, appSecret: string | undefined = secret()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(appSecret), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), enc.toString('base64url')].join('.');
}

export function decryptToken(stored: string, appSecret: string | undefined = secret()): string {
  const [version, iv, tag, data] = stored.split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unreadable stored Meta token.');
  const decipher = createDecipheriv('aes-256-gcm', keyFrom(appSecret), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

/** Constant-time string comparison (for OAuth state values). */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function randomState(): string {
  return randomBytes(24).toString('hex');
}
