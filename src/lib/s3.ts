/**
 * AWS S3 upload utility — server-side only.
 * Never import this in client components.
 */
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function getS3Client(): S3Client {
  const region    = process.env.AWS_REGION;
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!region || !accessKey || !secretKey) {
    throw new Error('AWS S3 credentials are not configured. Set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY in .env');
  }

  return new S3Client({
    region,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });
}

function getBucket(): string {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) throw new Error('AWS_S3_BUCKET is not set in .env');
  return bucket;
}

/** Build the public URL for an S3 object. Uses CDN URL if configured. */
export function getS3PublicUrl(key: string): string {
  const cdn    = process.env.AWS_S3_PUBLIC_URL;
  const bucket = getBucket();
  const region = process.env.AWS_REGION ?? 'us-east-1';
  if (cdn) return `${cdn.replace(/\/$/, '')}/${key}`;
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * Upload a file buffer directly to S3.
 * Returns the public URL of the uploaded object.
 */
export async function uploadToS3(
  key:         string,
  body:        Buffer,
  contentType: string,
): Promise<string> {
  const client = getS3Client();
  const bucket = getBucket();

  await client.send(new PutObjectCommand({
    Bucket:      bucket,
    Key:         key,
    Body:        body,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000',
  }));

  return getS3PublicUrl(key);
}

/** Delete an object from S3 by key. */
export async function deleteFromS3(key: string): Promise<void> {
  const client = getS3Client();
  const bucket = getBucket();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** Extract the S3 key from a full S3/CDN URL. Returns null if not parseable. */
export function extractS3Key(url: string): string | null {
  try {
    const cdn    = process.env.AWS_S3_PUBLIC_URL;
    const bucket = process.env.AWS_S3_BUCKET;
    const region = process.env.AWS_REGION ?? 'us-east-1';

    if (cdn && url.startsWith(cdn)) {
      return url.slice(cdn.replace(/\/$/, '').length + 1);
    }
    const s3Base = `https://${bucket}.s3.${region}.amazonaws.com/`;
    if (url.startsWith(s3Base)) return url.slice(s3Base.length);
    return null;
  } catch {
    return null;
  }
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_DOC_TYPES   = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;  // 5 MB
const MAX_DOC_BYTES   = 10 * 1024 * 1024; // 10 MB

export function validateImageUpload(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return 'Only JPG, PNG, WebP, or GIF images are allowed.';
  if (file.size > MAX_IMAGE_BYTES) return 'Image must be under 5 MB.';
  return null;
}

export function validateDocUpload(file: File): string | null {
  if (!ALLOWED_DOC_TYPES.includes(file.type)) return 'Only PDF, JPG, PNG, or DOC files are allowed.';
  if (file.size > MAX_DOC_BYTES) return 'File must be under 10 MB.';
  return null;
}
