import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { z } from 'zod';

const updateInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1).max(50).optional(),
  title:         z.string().min(1).max(200).optional(),
  amount:        z.number().min(0).optional(),
  currency:      z.string().optional(),
  status:        z.enum(['DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  issueDate:     z.string().optional(),
  dueDate:       z.string().nullable().optional(),
  paidDate:      z.string().nullable().optional(),
  paymentMethod: z.string().nullable().optional(),
  notes:         z.string().max(1000).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; invoiceId: string } },
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — ADMIN only' }, { status: 403 });
  }

  const body   = await req.json() as unknown;
  const parsed = updateInvoiceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const updateData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.issueDate) updateData.issueDate = new Date(parsed.data.issueDate);
    if (parsed.data.dueDate !== undefined) updateData.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
    if (parsed.data.paidDate !== undefined) updateData.paidDate = parsed.data.paidDate ? new Date(parsed.data.paidDate) : null;

    // Automatically set paidDate to now if marking as PAID without explicit date
    if (parsed.data.status === 'PAID' && !parsed.data.paidDate) {
      updateData.paidDate = new Date();
    }

    const updated = await prisma.clientInvoice.update({
      where: { id: params.invoiceId, clientId: params.id },
      data:  updateData,
    });
    return NextResponse.json({ data: updated });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; invoiceId: string } },
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await prisma.clientInvoice.delete({
      where: { id: params.invoiceId, clientId: params.id },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
