import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { deleteFromS3, extractS3Key } from '@/lib/s3';
import { z } from 'zod';

const updateClientSchema = z.object({
  name:          z.string().min(1).max(150).optional(),
  industry:      z.string().max(100).nullable().optional(),
  website:       z.string().max(300).nullable().optional(),
  contactName:   z.string().max(150).nullable().optional(),
  contactEmail:  z.string().email().max(200).nullable().optional().or(z.literal('')),
  contactPhone:  z.string().max(30).nullable().optional(),
  notes:         z.string().max(2000).nullable().optional(),
  accountLeadId: z.string().nullable().optional(),
  status:        z.enum(['ACTIVE', 'INACTIVE']).optional(),
  billingType:     z.string().nullable().optional(),
  billingCurrency: z.string().nullable().optional(),
  billingAmount:   z.number().nullable().optional(),
  billingCycle:    z.string().nullable().optional(),
  paymentTerms:    z.string().nullable().optional(),
  taxId:           z.string().nullable().optional(),
  billingEmail:    z.string().email().max(200).nullable().optional().or(z.literal('')),
  billingAddress:  z.string().nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const data = await prisma.client.findUnique({
      where:   { id: params.id },
      include: {
        accountLead: { select: { id: true, name: true, avatarUrl: true } },
        projects:    { orderBy: { createdAt: 'desc' }, include: { _count: { select: { tasks: true } } } },
        invoices:    { orderBy: { issueDate: 'desc' } },
        _count:      { select: { projects: true, tasks: true, invoices: true } },
      },
    });
    if (!data) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — ADMIN only' }, { status: 403 });
  }

  const body   = await req.json() as unknown;
  const parsed = updateClientSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const data = await prisma.client.update({
      where:   { id: params.id },
      data:    parsed.data,
      include: { accountLead: { select: { id: true, name: true, avatarUrl: true } } },
    });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const client = await prisma.client.findUnique({
      where:   { id: params.id },
      include: { _count: { select: { projects: true, tasks: true } } },
    });
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    if (client._count.projects > 0 || client._count.tasks > 0) {
      return NextResponse.json(
        { error: `Cannot delete — this client has ${client._count.projects} project(s) and ${client._count.tasks} task(s). Reassign or remove them first.` },
        { status: 409 },
      );
    }

    if (client.logoUrl) {
      const key = extractS3Key(client.logoUrl);
      if (key) {
        await deleteFromS3(key).catch((e: unknown) => {
          console.warn('[client delete] Failed to delete logo from S3:', e);
        });
      }
    }

    await prisma.client.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
