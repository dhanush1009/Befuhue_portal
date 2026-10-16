'use client';

import { useState } from 'react';
import { X, Loader2, Plus, Calendar, FileText } from 'lucide-react';
import { useCreateInvoice } from '@/hooks/useClients';

interface AddClientInvoiceModalProps {
  clientId: string;
  defaultCurrency?: string;
  onClose: () => void;
}

export function AddClientInvoiceModal({ clientId, defaultCurrency = 'INR', onClose }: AddClientInvoiceModalProps) {
  const createInvoice = useCreateInvoice(clientId);

  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`);
  const [title, setTitle]                 = useState('');
  const [amount, setAmount]               = useState('');
  const [currency, setCurrency]           = useState(defaultCurrency);
  const [status, setStatus]               = useState<'DRAFT' | 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'>('PENDING');
  const [issueDate, setIssueDate]         = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate]             = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [notes, setNotes]                 = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount) return;

    createInvoice.mutate(
      {
        invoiceNumber: invoiceNumber.trim(),
        title:         title.trim(),
        amount:        parseFloat(amount),
        currency,
        status,
        issueDate,
        dueDate:       dueDate || null,
        paidDate:      status === 'PAID' ? new Date().toISOString() : null,
        paymentMethod: status === 'PAID' ? paymentMethod : null,
        notes:         notes.trim() || null,
      },
      {
        onSuccess: () => onClose(),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-light dark:bg-brand/10 text-brand flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-950 dark:text-white">Create New Invoice</h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Record a bill or retainer invoice for this client</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Invoice Number & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">Invoice #</label>
              <input
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">Initial Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none"
              >
                <option value="PENDING">Pending (Unpaid)</option>
                <option value="PAID">Paid</option>
                <option value="DRAFT">Draft</option>
                <option value="OVERDUE">Overdue</option>
              </select>
            </div>
          </div>

          {/* Title / Description */}
          <div>
            <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">Description / Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Monthly Retainer - October 2026 or Website Milestone 1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none placeholder:text-zinc-400"
            />
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">Amount</label>
              <input
                type="number"
                required
                min="0"
                step="any"
                placeholder="50000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none placeholder:text-zinc-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="AED">AED (د.إ)</option>
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">Issue Date</label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none"
              />
            </div>
          </div>

          {status === 'PAID' && (
            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none"
              >
                <option value="BANK_TRANSFER">Bank Transfer / NEFT / IMPS</option>
                <option value="UPI">UPI</option>
                <option value="CARD">Credit / Debit Card</option>
                <option value="STRIPE">Stripe / Online</option>
                <option value="CASH">Cash / Cheque</option>
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">Notes / Payment Ref</label>
            <textarea
              rows={2}
              placeholder="e.g. PO #8921 or bank transaction UTR..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none resize-none placeholder:text-zinc-400"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold border border-gray-300 dark:border-white/10 rounded-lg text-zinc-800 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createInvoice.isPending}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors shadow-sm disabled:opacity-50"
            >
              {createInvoice.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Invoice
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
