import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import { uploadToS3, validateImageUpload, validateDocUpload } from '@/lib/s3';

const ALLOWED_PURPOSES = ['avatar', 'company-logo', 'document'] as const;
type UploadPurpose = typeof ALLOWED_PURPOSES[number];

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const formData = await req.formData();
    const file     = formData.get('file') as File | null;
    const purpose  = (formData.get('purpose') as string | null) ?? 'document';

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!ALLOWED_PURPOSES.includes(purpose as UploadPurpose)) {
      return NextResponse.json({ error: 'Invalid upload purpose' }, { status: 400 });
    }

    // Validate based on purpose
    const isImage = purpose === 'avatar' || purpose === 'company-logo';
    const validationError = isImage ? validateImageUpload(file) : validateDocUpload(file);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    // RBAC: only ADMIN can upload company logo
    if (purpose === 'company-logo' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build a unique, organised S3 key
    const ext       = file.name.split('.').pop() ?? 'bin';
    const timestamp = Date.now();
    const key       = purpose === 'company-logo'
      ? `company/logo-${timestamp}.${ext}`
      : purpose === 'avatar'
      ? `avatars/${user.id}-${timestamp}.${ext}`
      : `documents/${user.id}/${timestamp}-${file.name}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const url    = await uploadToS3(key, buffer, file.type);

    return NextResponse.json({ data: { url, key } }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed';
    // If S3 is not configured, return a clear error
    if (msg.includes('not configured') || msg.includes('not set')) {
      return NextResponse.json(
        { error: 'File storage is not configured. Please set AWS S3 credentials in your environment.' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
