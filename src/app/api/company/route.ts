import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';

const updateSchema = z.object({
  name:          z.string().min(1).max(100).optional(),
  logoUrl:       z.string().url().optional().nullable(),
  address:       z.string().max(300).optional().nullable(),
  payslipFooter: z.string().max(200).optional().nullable(),
});

/** GET /api/company — any authenticated user */
export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const settings = await prisma.companySettings.upsert({
      where:  { id: 'singleton' },
      update: {},
      create: { id: 'singleton', name: 'Befhue', logoUrl: '/branding/befhue-logo.png' },
    });
    return NextResponse.json({ data: settings });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** PATCH /api/company — ADMIN only */
export async function PATCH(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body   = await req.json() as unknown;
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const settings = await prisma.companySettings.upsert({
      where:  { id: 'singleton' },
      update: parsed.data,
      create: {
        id:            'singleton',
        name:          parsed.data.name          ?? 'Befhue',
        logoUrl:       parsed.data.logoUrl       ?? '/branding/befhue-logo.png',
        address:       parsed.data.address       ?? null,
        payslipFooter: parsed.data.payslipFooter ?? null,
      },
    });
    return NextResponse.json({ data: settings });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
