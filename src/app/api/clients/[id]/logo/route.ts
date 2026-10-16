import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { uploadToS3, deleteFromS3, extractS3Key } from '@/lib/s3';

const ALLOWED   = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB (already cropped + compressed client-side)

// ── POST — upload a new client logo ───────────────────────────────────────────
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — ADMIN only' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;

  if (!file)                        return NextResponse.json({ error: 'No file provided.' },                { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Only JPG, PNG, or WebP allowed.' }, { status: 400 });
  if (file.size > MAX_BYTES)        return NextResponse.json({ error: 'Image must be under 2 MB.' },        { status: 400 });

  try {
    const client = await prisma.client.findUnique({ where: { id: params.id }, select: { logoUrl: true } });
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const key    = `clients/${params.id}/logo-${Date.now()}.jpg`;

    const logoUrl = await uploadToS3(key, buffer, 'image/jpeg');

    if (client.logoUrl) {
      const oldKey = extractS3Key(client.logoUrl);
      if (oldKey) {
        await deleteFromS3(oldKey).catch((e: unknown) => {
          console.warn('[client logo] Failed to delete old logo from S3:', e);
        });
      }
    }

    await prisma.client.update({ where: { id: params.id }, data: { logoUrl } });

    return NextResponse.json({ logoUrl }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed.';
    console.error('[client logo POST]', err);
    if (msg.includes('not configured') || msg.includes('not set')) {
      return NextResponse.json(
        { error: 'File storage is not configured. Contact your administrator.' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── DELETE — remove the client logo ───────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — ADMIN only' }, { status: 403 });
  }

  try {
    const client = await prisma.client.findUnique({ where: { id: params.id }, select: { logoUrl: true } });
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    if (client.logoUrl) {
      const key = extractS3Key(client.logoUrl);
      if (key) {
        await deleteFromS3(key).catch((e: unknown) => {
          console.warn('[client logo] Failed to delete logo from S3:', e);
        });
      }
    }

    await prisma.client.update({ where: { id: params.id }, data: { logoUrl: null } });

    return NextResponse.json({ success: true, logoUrl: null });
  } catch (err) {
    console.error('[client logo DELETE]', err);
    return NextResponse.json({ error: 'Failed to remove logo.' }, { status: 500 });
  }
}
