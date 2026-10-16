import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { uploadToS3, deleteFromS3, extractS3Key } from '@/lib/s3';

const ALLOWED   = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB (already cropped + compressed)

// ── POST — upload new avatar ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;

  if (!file)                        return NextResponse.json({ error: 'No file provided.' },                    { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Only JPG, PNG, or WebP allowed.' },     { status: 400 });
  if (file.size > MAX_BYTES)        return NextResponse.json({ error: 'Image must be under 2 MB.' },            { status: 400 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const key    = `avatars/${user.id}/avatar-${Date.now()}.jpg`;

    // Upload new avatar to S3
    const avatarUrl = await uploadToS3(key, buffer, 'image/jpeg');

    // Delete old avatar from S3 (non-fatal)
    const current = await prisma.user.findUnique({
      where:  { id: user.id },
      select: { avatarUrl: true },
    });
    if (current?.avatarUrl) {
      const oldKey = extractS3Key(current.avatarUrl);
      if (oldKey) {
        await deleteFromS3(oldKey).catch((e: unknown) => {
          console.warn('[avatar] Failed to delete old avatar from S3:', e);
        });
      }
    }

    // Persist new URL to DB
    await prisma.user.update({
      where: { id: user.id },
      data:  { avatarUrl },
    });

    return NextResponse.json({ avatarUrl }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed.';
    console.error('[avatar POST]', err);
    if (msg.includes('not configured') || msg.includes('not set')) {
      return NextResponse.json(
        { error: 'File storage is not configured. Contact your administrator.' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── DELETE — remove avatar ────────────────────────────────────────────────────
export async function DELETE(_req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const current = await prisma.user.findUnique({
      where:  { id: user.id },
      select: { avatarUrl: true },
    });

    // Delete from S3 (non-fatal — DB update is more important)
    if (current?.avatarUrl) {
      const key = extractS3Key(current.avatarUrl);
      if (key) {
        await deleteFromS3(key).catch((e: unknown) => {
          console.warn('[avatar] Failed to delete avatar from S3:', e);
        });
      }
    }

    // Clear avatarUrl in DB
    await prisma.user.update({
      where: { id: user.id },
      data:  { avatarUrl: null },
    });

    return NextResponse.json({ success: true, avatarUrl: null });
  } catch (err) {
    console.error('[avatar DELETE]', err);
    return NextResponse.json({ error: 'Failed to remove profile photo.' }, { status: 500 });
  }
}
