import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { z } from 'zod';

const createInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1).max(50),
  title:         z.string().min(1).max(200),
  amount:        z.number().min(0),
  currency:      z.string().default('INR'),
  status:        z.enum(['DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED']).default('PENDING'),
  issueDate:     z.string().optional(),
  dueDate:       z.string().nullable().optional(),
  paidDate:      z.string().nullable().optional(),
  paymentMethod: z.string().nullable().optional(),
  notes:         z.string().max(1000).nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const invoices = await prisma.clientInvoice.findMany({
      where:   { clientId: params.id },
      orderBy: { issueDate: 'desc' },
    });
    return NextResponse.json({ data: invoices });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — ADMIN only' }, { status: 403 });
  }

  const body   = await req.json() as unknown;
  const parsed = createInvoiceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const invoice = await prisma.clientInvoice.create({
      data: {
        clientId:      params.id,
        invoiceNumber: parsed.data.invoiceNumber,
        title:         parsed.data.title,
        amount:        parsed.data.amount,
        currency:      parsed.data.currency,
        status:        parsed.data.status,
        issueDate:     parsed.data.issueDate ? new Date(parsed.data.issueDate) : new Date(),
        dueDate:       parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        paidDate:      parsed.data.paidDate ? new Date(parsed.data.paidDate) : null,
        paymentMethod: parsed.data.paymentMethod,
        notes:         parsed.data.notes,
      },
    });
    return NextResponse.json({ data: invoice }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
