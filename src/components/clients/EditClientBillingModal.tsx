'use client';

import { useState } from 'react';
import { X, Loader2, DollarSign, Receipt, CreditCard } from 'lucide-react';
import { useUpdateClient } from '@/hooks/useClients';
import type { Client } from '@/types';

interface EditClientBillingModalProps {
  client: Client;
  onClose: () => void;
}

export function EditClientBillingModal({ client, onClose }: EditClientBillingModalProps) {
  const updateClient = useUpdateClient();

  const [billingType, setBillingType]         = useState(client.billingType ?? 'RETAINER');
  const [billingCurrency, setBillingCurrency] = useState(client.billingCurrency ?? 'INR');
  const [billingAmount, setBillingAmount]     = useState(client.billingAmount ? String(client.billingAmount) : '');
  const [billingCycle, setBillingCycle]       = useState(client.billingCycle ?? 'MONTHLY');
  const [paymentTerms, setPaymentTerms]       = useState(client.paymentTerms ?? 'NET_30');
  const [taxId, setTaxId]                     = useState(client.taxId ?? '');
  const [billingEmail, setBillingEmail]       = useState(client.billingEmail ?? '');
  const [billingAddress, setBillingAddress]   = useState(client.billingAddress ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateClient.mutate(
      {
        id:              client.id,
        billingType,
        billingCurrency,
        billingAmount:   billingAmount ? parseFloat(billingAmount) : null,
        billingCycle,
        paymentTerms,
        taxId:           taxId.trim() || null,
        billingEmail:    billingEmail.trim() || null,
        billingAddress:  billingAddress.trim() || null,
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
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-950 dark:text-white">Billing Terms & Details</h2>
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Configure billing structure for {client.name}</p>
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
          {/* Billing Type & Cycle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">Billing Model</label>
              <select
                value={billingType}
                onChange={(e) => setBillingType(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none"
              >
                <option value="RETAINER">Recurring Retainer</option>
                <option value="HOURLY">Hourly Rate</option>
                <option value="FIXED">Fixed Price Project</option>
                <option value="MILESTONE">Milestone Based</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">Billing Cycle</label>
              <select
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none"
              >
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="ANNUAL">Annual</option>
                <option value="ONE_OFF">One-off / Project</option>
              </select>
            </div>
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">Currency</label>
              <select
                value={billingCurrency}
                onChange={(e) => setBillingCurrency(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="AED">AED (د.إ)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">
                {billingType === 'HOURLY' ? 'Hourly Rate' : 'Retainer / Fee Amount'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 50000"
                  value={billingAmount}
                  onChange={(e) => setBillingAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Payment Terms & Tax ID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">Payment Terms</label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none"
              >
                <option value="DUE_ON_RECEIPT">Due on Receipt</option>
                <option value="NET_15">Net 15 Days</option>
                <option value="NET_30">Net 30 Days</option>
                <option value="NET_45">Net 45 Days</option>
                <option value="NET_60">Net 60 Days</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">GSTIN / Tax ID</label>
              <input
                type="text"
                placeholder="e.g. 33AAAAA0000A1Z5"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none uppercase"
              />
            </div>
          </div>

          {/* Billing Email */}
          <div>
            <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">Billing / Accounts Email</label>
            <input
              type="email"
              placeholder="accounts@client.com"
              value={billingEmail}
              onChange={(e) => setBillingEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none"
            />
          </div>

          {/* Billing Address */}
          <div>
            <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">Billing Address</label>
            <textarea
              rows={2}
              placeholder="Official registered billing address..."
              value={billingAddress}
              onChange={(e) => setBillingAddress(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-300 dark:border-white/10 rounded-lg text-zinc-950 dark:text-white focus:ring-2 focus:ring-brand focus:outline-none resize-none"
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
              disabled={updateClient.isPending}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors shadow-sm disabled:opacity-50"
            >
              {updateClient.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Terms
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
