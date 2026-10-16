import { describe, it, expect } from 'vitest';
import {
  buildBillingExcelWorkbook,
  generateBillingExcelBuffer,
  getBillingExportFilename,
  getProjectBillingExportFilename,
  generateProjectBillingExcelBuffer,
  type BillingExportSummary,
  type BillingExportTask,
} from './billingExcel';

describe('Billing Excel Export (.xlsx)', () => {
  it('generates meaningful filenames matching user requirements', () => {
    expect(getBillingExportFilename('Rohan')).toBe('Rohan_Billing_Report.xlsx');
    expect(getBillingExportFilename('Yucel hub')).toBe('Yucel_Hub_Billing_Report.xlsx');
    expect(getProjectBillingExportFilename('Yucel hub', 'Simco')).toBe('Yucel_Hub_Simco_Billing_Report.xlsx');
  });

  it('generates a valid ExcelJS workbook with all 10 required columns and totals', async () => {
    const summary: BillingExportSummary = {
      entityName: 'Rohan',
      clientType: 'CLIENT',
      billingReference: 'BILL-ROHA-4263',
      totalTasks: 2,
      completedTasks: 1,
      inProgressTasks: 1,
      pendingTasks: 0,
      totalBilling: 1500,
      currency: 'INR',
    };

    const tasks: BillingExportTask[] = [
      {
        id: 't-1',
        humanId: 'SIMCO-001',
        title: 'Karunyan Task',
        projectName: 'Simco',
        clientName: 'Rohan',
        agencyName: 'Yucel hub',
        assignedEmployee: 'Gokul Prasath',
        dueDate: '2026-10-15',
        createdAt: '2026-10-01',
        status: 'DONE',
        amount: 500,
        currency: 'INR',
      },
      {
        id: 't-2',
        humanId: 'SIMCO-002',
        title: 'Website Optimization',
        projectName: 'Simco',
        clientName: 'Rohan',
        agencyName: 'Yucel hub',
        assignedEmployee: 'Gokul Prasath',
        dueDate: null,
        createdAt: '2026-10-05',
        status: 'IN_PROGRESS',
        amount: 1000,
        currency: 'INR',
      },
    ];

    const workbook = buildBillingExcelWorkbook(summary, tasks);
    const sheet = workbook.getWorksheet('Billing Statement');

    expect(sheet).toBeDefined();

    // Check header row (row 8)
    const headerRow = sheet!.getRow(8);
    const headerValues = (headerRow.values as string[]).slice(1);
    expect(headerValues).toEqual([
      'Task ID',
      'Task Name',
      'Client Name',
      'Agency Name',
      'Project Name',
      'Assigned Employee',
      'Assigned Date',
      'Deadline',
      'Task Status',
      'Individual Task Amount',
    ]);

    // Check Row 9 (First task)
    const row9 = sheet!.getRow(9);
    expect(row9.getCell(1).value).toBe('SIMCO-001');
    expect(row9.getCell(2).value).toBe('Karunyan Task');
    expect(row9.getCell(3).value).toBe('Rohan');
    expect(row9.getCell(4).value).toBe('Yucel hub');
    expect(row9.getCell(5).value).toBe('Simco');
    expect(row9.getCell(6).value).toBe('Gokul Prasath');
    expect(row9.getCell(7).value).toBe('01/10/2026');
    expect(row9.getCell(8).value).toBe('15/10/2026');
    expect(row9.getCell(9).value).toBe('Completed');
    expect(row9.getCell(10).value).toBe(500);

    // Check Summary Row (Row 11)
    const summaryRow = sheet!.getRow(11);
    expect(summaryRow.getCell(1).value).toBe('TOTAL SUMMARY');
    expect(summaryRow.getCell(9).value).toBe('Grand Total:');
    expect(summaryRow.getCell(10).value).toBe(1500);

    // Check Buffer generation and PK magic bytes
    const buffer = await generateBillingExcelBuffer(summary, tasks);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.slice(0, 2).toString()).toBe('PK'); // Valid ZIP/XLSX
  });

  it('generates a valid single project billing workbook with 10 columns', async () => {
    const buffer = await generateProjectBillingExcelBuffer({
      agencyName: 'Yucel hub',
      projectName: 'Simco',
      clientName: 'Rohan',
      totalTasks: 1,
      completedTasks: 1,
      totalBilling: 500,
      tasks: [
        {
          humanId: 'SIMCO-001',
          title: 'Karunyan',
          clientName: 'Rohan',
          agencyName: 'Yucel hub',
          projectName: 'Simco',
          assigneeName: 'Gokul Prasath',
          assignedDate: '2026-10-15T00:00:00.000Z',
          dueDate: '2026-10-15T00:00:00.000Z',
          status: 'DONE',
          amount: 500,
        },
      ],
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.slice(0, 2).toString()).toBe('PK');
  });
});
