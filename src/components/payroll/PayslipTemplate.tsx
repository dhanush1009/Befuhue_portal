'use client';

import { format } from 'date-fns';
import type { Payslip } from '@/types';
import { useCompanySettings } from '@/hooks/useCompanySettings';

interface Props { payslip: Payslip; }

function Rs({ amount }: { amount: number }) {
  return <span>Rs.{amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <tr className="border-b border-gray-100">
      <td className="py-2 pr-4 text-sm text-gray-700">{label}</td>
      <td className="py-2 text-sm text-gray-900 text-right"><Rs amount={value} /></td>
    </tr>
  );
}

export function PayslipTemplate({ payslip }: Props) {
  const { data: settings } = useCompanySettings();
  const companyName    = settings?.name          ?? 'Deep Impression';
  const companyAddress = settings?.address       ?? '';
  const footerText     = settings?.payslipFooter ?? `Powered by ${companyName} Payroll`;

  return (
    <div
      id="payslip-print"
      className="bg-white rounded-xl border border-gray-200 p-8 max-w-3xl mx-auto text-sm font-sans"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6 border-b border-gray-200 pb-6">
        <div>
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt={companyName} className="h-10 object-contain mb-1" />
          ) : (
            <p className="text-2xl font-semibold text-gray-900 mb-1">{companyName}</p>
          )}
          {companyAddress && (
            <p className="text-xs text-gray-500 max-w-xs leading-relaxed">{companyAddress}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Payslip For the Month</p>
          <p className="text-2xl font-semibold text-gray-900 mt-0.5">{payslip.payPeriod}</p>
        </div>
      </div>

      {/* ── Employee Summary ── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Employee Summary</p>
          <table className="text-sm">
            <tbody>
              {[
                ['Employee Name', payslip.employeeName],
                ['Employee ID',   payslip.employeeId],
                ['Pay Period',    payslip.payPeriod],
                ['Pay Date',      format(new Date(payslip.payDate), 'dd/MM/yyyy')],
              ].map(([label, value]) => (
                <tr key={label} className="mb-1">
                  <td className="text-gray-500 pr-3 py-0.5 align-top">{label}</td>
                  <td className="text-gray-400 pr-2 py-0.5">:</td>
                  <td className="text-gray-900 font-medium py-0.5">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Net Pay Box */}
        <div className="border border-green-200 rounded-xl p-5 min-w-[180px] text-right bg-green-50">
          <p className="text-xl font-semibold text-green-700 mb-3">
            <Rs amount={payslip.totalNetPay} />
          </p>
          <p className="text-xs text-gray-500 mb-3">Total Net Pay</p>
          <div className="border-t border-green-200 pt-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Paid Days</span>
              <span className="font-medium text-gray-900">{payslip.paidDays}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">LOP Days</span>
              <span className="font-medium text-gray-900">{payslip.lopDays}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Earnings + Deductions ── */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Earnings */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex justify-between bg-gray-50 px-4 py-2 border-b border-gray-200">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Earnings</span>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</span>
          </div>
          <div className="px-4">
            <table className="w-full">
              <tbody>
                <Row label="Basic"               value={payslip.basic} />
                <Row label="House Rent Allowance" value={payslip.hra} />
                <Row label="Conveyance"          value={payslip.conveyance} />
                <Row label="Medical Allowance"   value={payslip.medicalAllowance} />
                <Row label="Special Allowance"   value={payslip.specialAllowance} />
                <Row label="Bonus"               value={payslip.bonus} />
                <Row label="Incentive"           value={payslip.incentive} />
              </tbody>
            </table>
          </div>
          <div className="flex justify-between px-4 py-2 bg-gray-50 border-t border-gray-200 font-medium">
            <span className="text-sm text-gray-900">Gross Earnings</span>
            <span className="text-sm text-gray-900"><Rs amount={payslip.grossEarnings} /></span>
          </div>
        </div>

        {/* Deductions */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex justify-between bg-gray-50 px-4 py-2 border-b border-gray-200">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Deductions</span>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</span>
          </div>
          <div className="px-4">
            <table className="w-full">
              <tbody>
                <Row label="Income Tax"       value={payslip.incomeTax} />
                <Row label="Provident Fund"   value={payslip.providentFund} />
                <Row label="ESI"              value={payslip.esi} />
                <Row label="Professional Tax" value={payslip.professionalTax} />
                <Row label="Other Deductions" value={payslip.otherDeductions} />
                <Row label="LOP Deduction"    value={payslip.lopDeduction} />
              </tbody>
            </table>
          </div>
          <div className="flex justify-between px-4 py-2 bg-gray-50 border-t border-gray-200 font-medium">
            <span className="text-sm text-gray-900">Total Deductions</span>
            <span className="text-sm text-gray-900"><Rs amount={payslip.totalDeductions} /></span>
          </div>
        </div>
      </div>

      {/* ── Total Net Payable ── */}
      <div className="flex items-center justify-between border border-green-200 rounded-lg px-5 py-4 bg-green-50 mb-6">
        <div>
          <p className="text-sm font-medium text-gray-900 uppercase tracking-wide">Total Net Payable</p>
          <p className="text-xs text-gray-500 mt-0.5">Gross Earnings - Total Deductions</p>
        </div>
        <p className="text-xl font-semibold text-green-700"><Rs amount={payslip.totalNetPay} /></p>
      </div>

      {/* ── Amount in Words ── */}
      <p className="text-xs text-gray-600 mb-8">
        Amount In Words : <span className="font-medium text-gray-900">{payslip.amountInWords}</span>
      </p>

      {/* ── Footer ── */}
      <div className="border-t border-gray-100 pt-4 text-center text-xs text-gray-400 space-y-1">
        <p>— This is a system-generated document. —</p>
        <p>{footerText}</p>
      </div>
    </div>
  );
}
