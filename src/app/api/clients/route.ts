import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { z } from 'zod';

const createClientSchema = z.object({
  name:          z.string().min(1).max(150),
  industry:      z.string().max(100).optional(),
  website:       z.string().max(300).optional(),
  contactName:   z.string().max(150).optional(),
  contactEmail:  z.string().email().max(200).optional().or(z.literal('')),
  contactPhone:  z.string().max(30).optional(),
  notes:         z.string().max(2000).optional(),
  accountLeadId: z.string().optional(),
  status:        z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  billingType:     z.string().optional(),
  billingCurrency: z.string().optional(),
  billingAmount:   z.number().optional(),
  billingCycle:    z.string().optional(),
  paymentTerms:    z.string().optional(),
  taxId:           z.string().optional(),
  billingEmail:    z.string().email().optional().or(z.literal('')),
  billingAddress:  z.string().optional(),
});

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const data = await prisma.client.findMany({
      orderBy: { name: 'asc' },
      include: {
        accountLead: { select: { id: true, name: true, avatarUrl: true } },
        _count:      { select: { projects: true, tasks: true } },
      },
    });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — ADMIN only' }, { status: 403 });
  }

  const body   = await req.json() as unknown;
  const parsed = createClientSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const data = await prisma.client.create({
      data:    parsed.data,
      include: { accountLead: { select: { id: true, name: true, avatarUrl: true } } },
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
