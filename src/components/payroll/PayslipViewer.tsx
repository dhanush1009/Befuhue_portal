'use client';

import { X, Printer, Loader2 } from 'lucide-react';
import type { Payslip } from '@/types';
import { PayslipTemplate } from './PayslipTemplate';
import { usePayslip } from '@/hooks/usePayroll';

interface Props {
  payslip: Pick<Payslip, 'id'> | Payslip;
  onClose: () => void;
}

export function PayslipViewer({ payslip, onClose }: Props) {
  const needsFetch = !('employeeName' in payslip);
  const { data: fetched, isLoading } = usePayslip(needsFetch ? payslip.id : null);
  const full = needsFetch ? fetched : (payslip as Payslip);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8 px-4">
      <div className="w-full max-w-3xl">

        {/* Toolbar — hidden on print */}
        <div className="flex items-center justify-between mb-4 print:hidden">
          <p className="text-sm font-medium text-white">
            Payslip{full ? ` — ${full.payPeriod}` : ''}
          </p>
          <div className="flex items-center gap-2">
            {full && (
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white text-gray-700 hover:bg-gray-100 transition-colors duration-150 active:scale-[0.98]"
              >
                <Printer className="w-4 h-4" /> Print
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors duration-150"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isLoading || !full ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-white" />
          </div>
        ) : (
          <PayslipTemplate payslip={full} />
        )}
      </div>
    </div>
  );
}
