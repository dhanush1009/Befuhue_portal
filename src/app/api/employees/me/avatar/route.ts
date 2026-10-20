import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { uploadToS3, deleteFromS3, extractS3Key, isS3Configured } from '@/lib/s3';

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
    let avatarUrl: string;
    let avatarData: string | null = null;

    if (isS3Configured()) {
      try {
        const key = `avatars/${user.id}/avatar-${Date.now()}.jpg`;
        avatarUrl = await uploadToS3(key, buffer, 'image/jpeg');

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
      } catch (s3Err) {
        console.warn('[avatar POST] S3 upload failed, storing image in database:', s3Err);
        const mimeType = file.type || 'image/jpeg';
        avatarData = `data:${mimeType};base64,${buffer.toString('base64')}`;
        avatarUrl = `/api/avatar/${user.id}?t=${Date.now()}`;
      }
    } else {
      // S3 is optional: store binary in avatarData and use the lightweight /api/avatar endpoint
      const mimeType = file.type || 'image/jpeg';
      avatarData = `data:${mimeType};base64,${buffer.toString('base64')}`;
      avatarUrl = `/api/avatar/${user.id}?t=${Date.now()}`;
    }

    // Persist new URL and data to DB
    await prisma.user.update({
      where: { id: user.id },
      data:  { avatarUrl, avatarData },
    });

    return NextResponse.json({ avatarUrl }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed.';
    console.error('[avatar POST]', err);
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

    // Clear avatarUrl and avatarData in DB
    await prisma.user.update({
      where: { id: user.id },
      data:  { avatarUrl: null, avatarData: null },
    });

    return NextResponse.json({ success: true, avatarUrl: null });
  } catch (err) {
    console.error('[avatar DELETE]', err);
    return NextResponse.json({ error: 'Failed to remove profile photo.' }, { status: 500 });
  }
}
