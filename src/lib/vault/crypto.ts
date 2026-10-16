import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// Encrypts the password vault (AES-256-GCM). The key comes from VAULT_KEY when it is set, which is the
// recommended setup because it keeps vault passwords safe even if the app's login secret ever leaks.
// Without it the key is derived from AUTH_SECRET so the vault still works out of the box. Either way,
// changing the secret later makes stored entries unreadable and they would have to be saved again.

const secret = () => process.env.VAULT_KEY?.trim() || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

export const vaultKeyIsDedicated = () => !!process.env.VAULT_KEY?.trim();

function keyFrom(appSecret: string | undefined): Buffer {
  if (!appSecret) throw new Error('No VAULT_KEY or AUTH_SECRET is set, so the vault cannot store passwords securely.');
  return createHash('sha256').update(`password-vault:${appSecret}`).digest();
}

/** "v1.<iv>.<tag>.<ciphertext>" (all base64url). A fresh random IV every time, so equal passwords look different. */
export function encryptSecret(plain: string, appSecret: string | undefined = secret()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(appSecret), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), enc.toString('base64url')].join('.');
}

export function decryptSecret(stored: string, appSecret: string | undefined = secret()): string {
  const [version, iv, tag, data] = stored.split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unreadable stored value.');
  const decipher = createDecipheriv('aes-256-gcm', keyFrom(appSecret), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
