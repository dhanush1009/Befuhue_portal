'use client';

import { useState, useMemo } from 'react';
import {
  CreditCard, DollarSign, Receipt, Plus, CheckCircle2, Clock,
  AlertCircle, Pencil, Trash2, Calendar, Mail, MapPin, Building
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useUpdateInvoice, useDeleteInvoice } from '@/hooks/useClients';
import { EditClientBillingModal } from './EditClientBillingModal';
import { AddClientInvoiceModal } from './AddClientInvoiceModal';
import type { Client, ClientInvoice } from '@/types';

interface ClientBillingSectionProps {
  client: Client;
  isAdmin: boolean;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'AED ',
};

export function ClientBillingSection({ client, isAdmin }: ClientBillingSectionProps) {
  const [showEditTerms, setShowEditTerms]   = useState(false);
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [statusFilter, setStatusFilter]     = useState<string>('ALL');

  const updateInvoice = useUpdateInvoice(client.id);
  const deleteInvoice = useDeleteInvoice(client.id);

  const invoices = client.invoices ?? [];
  const currencySymbol = CURRENCY_SYMBOLS[client.billingCurrency ?? 'INR'] ?? '₹';

  // Metrics
  const metrics = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid     = 0;
    let pendingDue    = 0;

    for (const inv of invoices) {
      if (inv.status === 'CANCELLED') continue;
      totalInvoiced += inv.amount;
      if (inv.status === 'PAID') {
        totalPaid += inv.amount;
      } else {
        pendingDue += inv.amount;
      }
    }

    return { totalInvoiced, totalPaid, pendingDue };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    if (statusFilter === 'ALL') return invoices;
    return invoices.filter((inv) => inv.status === statusFilter);
  }, [invoices, statusFilter]);

  const handleMarkAsPaid = (inv: ClientInvoice) => {
    updateInvoice.mutate({
      invoiceId: inv.id,
      status: 'PAID',
      paidDate: new Date().toISOString(),
    });
  };

  const handleDeleteInvoice = (invId: string) => {
    if (confirm('Delete this invoice? This action cannot be undone.')) {
      deleteInvoice.mutate(invId);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Summary KPI Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invoiced */}
        <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-white/10 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Total Billed</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-zinc-950 dark:text-white">
            {currencySymbol}{metrics.totalInvoiced.toLocaleString('en-IN')}
          </p>
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mt-1">{invoices.length} total invoice{invoices.length === 1 ? '' : 's'}</p>
        </div>

        {/* Collected */}
        <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-white/10 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Collected</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {currencySymbol}{metrics.totalPaid.toLocaleString('en-IN')}
          </p>
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mt-1">Paid in full</p>
        </div>

        {/* Pending Due */}
        <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-white/10 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Outstanding</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {currencySymbol}{metrics.pendingDue.toLocaleString('en-IN')}
          </p>
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mt-1">Awaiting payment</p>
        </div>

        {/* Retainer / Plan */}
        <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-white/10 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Active Agreement</span>
            <div className="w-8 h-8 rounded-lg bg-brand-light dark:bg-brand/10 text-brand flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-zinc-950 dark:text-white truncate">
            {client.billingAmount ? `${currencySymbol}${client.billingAmount.toLocaleString('en-IN')}` : 'Not set'}
          </p>
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mt-1">
            {client.billingType ?? 'RETAINER'} · {client.billingCycle ?? 'MONTHLY'}
          </p>
        </div>
      </div>

      {/* ── Billing Profile & Terms ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-white/10 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-gray-100 dark:border-white/10">
          <div>
            <h3 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-brand" /> Billing Profile & Terms
            </h3>
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mt-0.5">Payment arrangements and tax info for this account</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowEditTerms(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-gray-300 dark:border-white/10 rounded-lg text-zinc-800 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors self-start sm:self-auto"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit Terms
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-zinc-700 dark:text-zinc-300 font-semibold mb-1">Billing Model</p>
            <p className="font-bold text-zinc-950 dark:text-white">
              {client.billingType ? client.billingType.replace('_', ' ') : 'Retainer'} ({client.billingCycle ?? 'Monthly'})
            </p>
          </div>
          <div>
            <p className="text-zinc-700 dark:text-zinc-300 font-semibold mb-1">Payment Terms</p>
            <p className="font-bold text-zinc-950 dark:text-white">
              {client.paymentTerms ? client.paymentTerms.replace('_', ' ') : 'Net 30 Days'}
            </p>
          </div>
          <div>
            <p className="text-zinc-700 dark:text-zinc-300 font-semibold mb-1">Tax ID / GSTIN</p>
            <p className="font-bold text-zinc-950 dark:text-white uppercase font-mono">
              {client.taxId || '—'}
            </p>
          </div>
          <div>
            <p className="text-zinc-700 dark:text-zinc-300 font-semibold mb-1">Billing Email</p>
            <p className="font-bold text-zinc-950 dark:text-white truncate">
              {client.billingEmail || client.contactEmail || '—'}
            </p>
          </div>
        </div>

        {client.billingAddress && (
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5 text-xs">
            <p className="text-zinc-700 dark:text-zinc-300 font-semibold mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> Billing Address
            </p>
            <p className="text-zinc-950 dark:text-zinc-100 font-medium whitespace-pre-line">{client.billingAddress}</p>
          </div>
        )}
      </div>

      {/* ── Invoices List ───────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-gray-100 dark:border-white/10">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-brand" /> Invoices & Billing Records
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-white/10 text-zinc-800 dark:text-zinc-200 border border-gray-200 dark:border-white/10">
              {invoices.length}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter pills */}
            <div className="flex items-center p-0.5 rounded-lg bg-gray-100 dark:bg-surface-dark-2 text-xs border border-gray-200 dark:border-white/5">
              {['ALL', 'PENDING', 'PAID', 'OVERDUE'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                    statusFilter === status
                      ? 'bg-white dark:bg-white/10 text-zinc-950 dark:text-white shadow-xs font-bold'
                      : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white font-semibold'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {isAdmin && (
              <button
                onClick={() => setShowAddInvoice(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> New Invoice
              </button>
            )}
          </div>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 flex items-center justify-center mx-auto mb-3">
              <Receipt className="w-6 h-6" />
            </div>
            <p className="text-base font-bold text-zinc-950 dark:text-white">No invoices found</p>
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
              {statusFilter === 'ALL'
                ? 'Create the first invoice or fee record for this client to begin tracking payments.'
                : `No invoices matching status "${statusFilter}".`}
            </p>
            {isAdmin && statusFilter === 'ALL' && (
              <button
                onClick={() => setShowAddInvoice(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Create Invoice
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.04] text-zinc-700 dark:text-zinc-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Issue Date</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  {isAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {filteredInvoices.map((inv) => {
                  const sym = CURRENCY_SYMBOLS[inv.currency] ?? currencySymbol;
                  const isPaid = inv.status === 'PAID';
                  const isOverdue = inv.status === 'OVERDUE';
                  const isPending = inv.status === 'PENDING';

                  return (
                    <tr key={inv.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-zinc-950 dark:text-white">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-zinc-950 dark:text-white truncate max-w-xs">{inv.title}</p>
                        {inv.notes && <p className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 truncate">{inv.notes}</p>}
                      </td>
                      <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300 font-medium whitespace-nowrap">
                        {formatDate(inv.issueDate)}
                      </td>
                      <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300 font-medium whitespace-nowrap">
                        {inv.dueDate ? formatDate(inv.dueDate) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">
                        {sym}{inv.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40'
                              : isOverdue
                              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/40'
                              : isPending
                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40'
                              : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-white/5 dark:text-zinc-300 dark:border-white/10'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isPaid && (
                              <button
                                onClick={() => handleMarkAsPaid(inv)}
                                className="px-2 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 dark:text-emerald-400 rounded transition-colors"
                                title="Mark as Paid"
                              >
                                Mark Paid
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteInvoice(inv.id)}
                              className="p-1 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                              title="Delete invoice"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showEditTerms && (
        <EditClientBillingModal client={client} onClose={() => setShowEditTerms(false)} />
      )}
      {showAddInvoice && (
        <AddClientInvoiceModal
          clientId={client.id}
          defaultCurrency={client.billingCurrency ?? 'INR'}
          onClose={() => setShowAddInvoice(false)}
        />
      )}
    </div>
  );
}
