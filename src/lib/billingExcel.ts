import ExcelJS from 'exceljs';

export interface BillingExportTask {
  id: string;
  humanId: string;
  title: string;
  projectName?: string | null;
  clientName?: string | null;
  agencyName?: string | null;
  assignedEmployee?: string | null;
  dueDate?: string | Date | null;
  createdAt: string | Date;
  status: string;
  amount: number | null;
  currency: string;
}

export interface BillingExportSummary {
  entityName: string;
  clientType: string;
  billingReference: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  totalBilling: number;
  currency: string;
}

/**
 * Returns a clean, meaningful filename as requested:
 * e.g. Rohan -> Rohan_Billing_Report.xlsx
 *      Yucel hub -> Yucel_Hub_Billing_Report.xlsx
 */
export function getBillingExportFilename(entityName: string): string {
  const sanitized = (entityName || 'Billing')
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('_')
    .replace(/[^a-zA-Z0-9_-]/g, '');

  return `${sanitized || 'Billing'}_Billing_Report.xlsx`;
}

export function buildBillingExcelWorkbook(
  summary: BillingExportSummary,
  tasks: BillingExportTask[],
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Befhue Workspace';
  workbook.lastModifiedBy = 'Befhue Workspace';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('Billing Statement', {
    views: [{ showGridLines: true }],
  });

  // 10 Columns defined in exact order requested
  worksheet.columns = [
    { key: 'taskId',           width: 16 }, // A: Task ID
    { key: 'taskName',         width: 38 }, // B: Task Name
    { key: 'clientName',       width: 24 }, // C: Client Name
    { key: 'agencyName',       width: 22 }, // D: Agency Name
    { key: 'projectName',      width: 24 }, // E: Project Name
    { key: 'assignedEmployee', width: 24 }, // F: Assigned Employee
    { key: 'assignedDate',     width: 16 }, // G: Assigned Date
    { key: 'deadline',         width: 16 }, // H: Deadline
    { key: 'taskStatus',       width: 16 }, // I: Task Status
    { key: 'taskAmount',       width: 24 }, // J: Individual Task Amount
  ];

  // Row 1: Title Banner (merged across all 10 columns A to J)
  worksheet.mergeCells('A1:J1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'BEFHUE DIGITAL — CLIENT & AGENCY BILLING STATEMENT';
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF7C3AED' }, // Befhue Brand Purple
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 36;

  // Row 2: Spacer
  worksheet.getRow(2).height = 10;

  // Rows 3-6: Metadata Block
  const metaLabels = [
    { cell: 'A3', label: 'Entity Name:', valCell: 'B3', val: summary.entityName, cell2: 'E3', label2: 'Client Type:', valCell2: 'F3', val2: summary.clientType },
    { cell: 'A4', label: 'Billing Ref:', valCell: 'B4', val: summary.billingReference, cell2: 'E4', label2: 'Export Date:', valCell2: 'F4', val2: new Date().toLocaleDateString('en-GB') },
    { cell: 'A5', label: 'Total Tasks:', valCell: 'B5', val: summary.totalTasks, cell2: 'E5', label2: 'Completed Tasks:', valCell2: 'F5', val2: summary.completedTasks },
    { cell: 'A6', label: 'Pending Tasks:', valCell: 'B6', val: summary.pendingTasks, cell2: 'E6', label2: 'Total Billing Amount:', valCell2: 'F6', val2: summary.totalBilling },
  ];

  for (const m of metaLabels) {
    const l1 = worksheet.getCell(m.cell);
    l1.value = m.label;
    l1.font = { bold: true, color: { argb: 'FF475569' } };

    const v1 = worksheet.getCell(m.valCell);
    v1.value = m.val;
    v1.font = { bold: m.cell === 'A6' };

    const l2 = worksheet.getCell(m.cell2);
    l2.value = m.label2;
    l2.font = { bold: true, color: { argb: 'FF475569' } };

    const v2 = worksheet.getCell(m.valCell2);
    v2.value = m.val2;
    if (m.label2.includes('Total Billing')) {
      v2.font = { bold: true, color: { argb: 'FF7C3AED' }, size: 11 };
      v2.numFmt = '₹#,##0.00';
    }
  }

  // Row 7: Spacer
  worksheet.getRow(7).height = 12;

  // Row 8: Table Header (10 Columns)
  const headers = [
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
  ];

  const headerRow = worksheet.getRow(8);
  headerRow.height = 28;
  headerRow.values = headers;

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }, // Dark slate
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top:    { style: 'thin', color: { argb: 'FF0F172A' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left:   { style: 'thin', color: { argb: 'FF334155' } },
      right:  { style: 'thin', color: { argb: 'FF334155' } },
    };
  });

  const formatStatus = (s: string) => {
    switch (s) {
      case 'DONE':
      case 'CLOSED':
      case 'VERIFIED':
        return 'Completed';
      case 'IN_PROGRESS':
      case 'IN_TESTING':
      case 'READY_FOR_QA':
      case 'INTERNAL_REVIEW':
      case 'CLIENT_REVIEW':
        return 'In Progress';
      default:
        return 'Pending';
    }
  };

  // Data Rows
  let currentRow = 9;

  if (tasks.length === 0) {
    const emptyRow = worksheet.getRow(currentRow);
    emptyRow.height = 24;
    worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
    const emptyCell = emptyRow.getCell(1);
    emptyCell.value = 'No billing tasks found for this selection.';
    emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
    emptyCell.font = { italic: true, color: { argb: 'FF94A3B8' } };
    currentRow++;
  } else {
    for (const t of tasks) {
      const row = worksheet.getRow(currentRow);
      row.height = 22;

      const assignedDateStr = t.createdAt
        ? new Date(t.createdAt).toLocaleDateString('en-GB')
        : '—';

      const deadlineStr = t.dueDate
        ? new Date(t.dueDate).toLocaleDateString('en-GB')
        : 'No deadline';

      const amt = t.amount != null ? Number(t.amount) : 0;

      row.values = [
        t.humanId || t.id,
        t.title,
        t.clientName ?? summary.entityName,
        t.agencyName ?? '—',
        t.projectName ?? '—',
        t.assignedEmployee ?? 'Unassigned',
        assignedDateStr,
        deadlineStr,
        formatStatus(t.status),
        amt,
      ];

      const isEven = currentRow % 2 === 0;
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 10 };
        if (isEven) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' }, // Subtle zebra
          };
        }
        cell.border = {
          top:    { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left:   { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right:  { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        if ([1, 7, 8, 9].includes(colNumber)) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colNumber === 10) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '₹#,##0.00';
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });

      currentRow++;
    }
  }

  // Summary Row at the Bottom (Calculating sum of exported tasks)
  const summaryRow = worksheet.getRow(currentRow);
  summaryRow.height = 26;
  summaryRow.getCell(1).value = 'TOTAL SUMMARY';
  summaryRow.getCell(1).font = { bold: true };
  summaryRow.getCell(2).value = `Total Tasks: ${summary.totalTasks}`;
  summaryRow.getCell(6).value = `Completed: ${summary.completedTasks}`;
  summaryRow.getCell(9).value = 'Grand Total:';
  summaryRow.getCell(9).font = { bold: true };
  summaryRow.getCell(9).alignment = { horizontal: 'right' };

  const totalCell = summaryRow.getCell(10);
  totalCell.value = summary.totalBilling;
  totalCell.numFmt = '₹#,##0.00';
  totalCell.font = { bold: true, size: 11, color: { argb: 'FF7C3AED' } };

  summaryRow.eachCell((cell) => {
    cell.border = {
      top:    { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'double', color: { argb: 'FF94A3B8' } },
    };
  });

  return workbook;
}

export async function generateBillingExcelBuffer(
  summary: BillingExportSummary,
  tasks: BillingExportTask[],
): Promise<Buffer> {
  const workbook = buildBillingExcelWorkbook(summary, tasks);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Returns a clean, meaningful filename for project billing reports:
 * e.g. Yucel Hub, Simco -> Yucel_Hub_Simco_Billing_Report.xlsx
 */
export function getProjectBillingExportFilename(agencyName: string, projectName: string): string {
  const sanitize = (name: string) =>
    (name || '')
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('_')
      .replace(/[^a-zA-Z0-9_-]/g, '');

  const safeAgency = sanitize(agencyName) || 'Agency';
  const safeProject = sanitize(projectName) || 'Project';

  return `${safeAgency}_${safeProject}_Billing_Report.xlsx`;
}

/**
 * Generate genuine Excel workbook for a single project's billing details.
 */
export async function generateProjectBillingExcelBuffer(data: {
  agencyName: string;
  projectName: string;
  clientName?: string | null;
  totalTasks: number;
  completedTasks: number;
  totalBilling: number;
  tasks: Array<{
    humanId: string;
    title: string;
    clientName?: string | null;
    agencyName?: string | null;
    projectName?: string | null;
    assigneeName?: string | null;
    assignedDate?: string | null;
    dueDate?: string | null;
    status: string;
    amount: number;
  }>;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Befhue Workspace';
  workbook.lastModifiedBy = 'Befhue Workspace';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('Project Billing Statement', {
    views: [{ showGridLines: true }],
  });

  // 10 Columns defined in exact order requested
  worksheet.columns = [
    { key: 'taskId',           width: 16 }, // A: Task ID
    { key: 'taskName',         width: 38 }, // B: Task Name
    { key: 'clientName',       width: 24 }, // C: Client Name
    { key: 'agencyName',       width: 22 }, // D: Agency Name
    { key: 'projectName',      width: 24 }, // E: Project Name
    { key: 'assignedEmployee', width: 24 }, // F: Assigned Employee
    { key: 'assignedDate',     width: 16 }, // G: Assigned Date
    { key: 'deadline',         width: 16 }, // H: Deadline
    { key: 'taskStatus',       width: 16 }, // I: Task Status
    { key: 'taskAmount',       width: 24 }, // J: Individual Task Amount
  ];

  // Row 1: Title Banner (merged across all 10 columns A to J)
  worksheet.mergeCells('A1:J1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'BEFHUE DIGITAL — PROJECT BILLING STATEMENT';
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF7C3AED' }, // Befhue Brand Purple
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 36;

  // Row 2: Spacer
  worksheet.getRow(2).height = 10;

  // Metadata block (Rows 3-6)
  const meta = [
    { c1: 'A3', l1: 'Agency Name:', c2: 'B3', v1: data.agencyName, c3: 'E3', l2: 'Project Name:', c4: 'F3', v2: data.projectName },
    { c1: 'A4', l1: 'Client Name:', c2: 'B4', v1: data.clientName || 'N/A', c3: 'E4', l2: 'Statement Date:', c4: 'F4', v2: new Date().toLocaleDateString('en-GB') },
    { c1: 'A5', l1: 'Total Tasks:', c2: 'B5', v1: data.totalTasks, c3: 'E5', l2: 'Completed Tasks:', c4: 'F5', v2: data.completedTasks },
    { c1: 'A6', l1: 'Currency:', c2: 'B6', v1: 'INR (₹)', c3: 'E6', l2: 'Total Project Amount:', c4: 'F6', v2: data.totalBilling },
  ];

  for (const m of meta) {
    const l1 = worksheet.getCell(m.c1);
    l1.value = m.l1;
    l1.font = { bold: true, color: { argb: 'FF475569' } };

    const v1 = worksheet.getCell(m.c2);
    v1.value = m.v1;

    const l2 = worksheet.getCell(m.c3);
    l2.value = m.l2;
    l2.font = { bold: true, color: { argb: 'FF475569' } };

    const v2 = worksheet.getCell(m.c4);
    v2.value = m.v2;
    if (m.l2.includes('Total Project Amount')) {
      v2.font = { bold: true, color: { argb: 'FF7C3AED' }, size: 11 };
      v2.numFmt = '₹#,##0.00';
    }
  }

  // Row 7: Spacer
  worksheet.getRow(7).height = 12;

  // Row 8: Table Header (10 Columns)
  const headers = [
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
  ];

  const headerRow = worksheet.getRow(8);
  headerRow.height = 28;
  headerRow.values = headers;

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }, // Dark slate
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top:    { style: 'thin', color: { argb: 'FF0F172A' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left:   { style: 'thin', color: { argb: 'FF334155' } },
      right:  { style: 'thin', color: { argb: 'FF334155' } },
    };
  });

  const formatStatus = (s: string) => {
    switch (s) {
      case 'DONE':
      case 'CLOSED':
      case 'VERIFIED':
        return 'Completed';
      case 'IN_PROGRESS':
      case 'IN_TESTING':
      case 'READY_FOR_QA':
      case 'INTERNAL_REVIEW':
      case 'CLIENT_REVIEW':
        return 'In Progress';
      default:
        return 'Pending';
    }
  };

  let currentRow = 9;
  if (data.tasks.length === 0) {
    const emptyRow = worksheet.getRow(currentRow);
    emptyRow.height = 24;
    worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
    const emptyCell = worksheet.getCell(`A${currentRow}`);
    emptyCell.value = 'No billing tasks found for this project.';
    emptyCell.font = { italic: true, color: { argb: 'FF64748B' } };
    emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
    currentRow++;
  } else {
    for (const t of data.tasks) {
      const row = worksheet.getRow(currentRow);
      row.height = 22;

      const assignedDateStr = t.assignedDate
        ? new Date(t.assignedDate).toLocaleDateString('en-GB')
        : '—';

      const deadlineStr = t.dueDate
        ? new Date(t.dueDate).toLocaleDateString('en-GB')
        : 'No deadline';

      row.values = [
        t.humanId,
        t.title,
        t.clientName || data.clientName || '—',
        t.agencyName || data.agencyName || '—',
        t.projectName || data.projectName || '—',
        t.assigneeName || 'Unassigned',
        assignedDateStr,
        deadlineStr,
        formatStatus(t.status),
        Number(t.amount || 0),
      ];

      const isEven = currentRow % 2 === 0;
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 10 };
        if (isEven) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          };
        }
        cell.border = {
          top:    { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left:   { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right:  { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        if ([1, 7, 8, 9].includes(colNumber)) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colNumber === 10) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '₹#,##0.00';
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });

      currentRow++;
    }
  }

  // Summary Row at bottom (Calculating sum of exported tasks)
  const summaryRow = worksheet.getRow(currentRow);
  summaryRow.height = 26;
  summaryRow.getCell(1).value = 'TOTAL SUMMARY';
  summaryRow.getCell(1).font = { bold: true };
  summaryRow.getCell(2).value = `Total Tasks: ${data.totalTasks}`;
  summaryRow.getCell(6).value = `Completed: ${data.completedTasks}`;
  summaryRow.getCell(9).value = 'Grand Total:';
  summaryRow.getCell(9).font = { bold: true };
  summaryRow.getCell(9).alignment = { horizontal: 'right' };

  const totalCell = summaryRow.getCell(10);
  totalCell.value = data.totalBilling;
  totalCell.numFmt = '₹#,##0.00';
  totalCell.font = { bold: true, size: 11, color: { argb: 'FF7C3AED' } };

  summaryRow.eachCell((cell) => {
    cell.border = {
      top:    { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'double', color: { argb: 'FF94A3B8' } },
    };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generate consolidated Excel workbook for all projects under an agency with project-wise subtotals and grand total.
 */
export async function generateAgencyAllProjectsExcelBuffer(data: {
  agency: {
    id: string;
    name: string;
    totalProjects: number;
    totalTasks: number;
    completedTasks: number;
    totalBilling: number;
  };
  projects: Array<{
    project: {
      id: string;
      name: string;
      prefix: string;
      clientName?: string | null;
      status: string;
    };
    tasks: Array<{
      humanId: string;
      title: string;
      assigneeName?: string | null;
      assignedDate: string;
      dueDate?: string | null;
      status: string;
      amount: number;
    }>;
    totalBilling: number;
  }>;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Befhue Workspace';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Agency Consolidated Billing', {
    views: [{ showGridLines: true }],
  });

  worksheet.columns = [
    { key: 'humanId', width: 16 },
    { key: 'title', width: 36 },
    { key: 'client', width: 22 },
    { key: 'agency', width: 22 },
    { key: 'project', width: 22 },
    { key: 'assignee', width: 24 },
    { key: 'deadline', width: 16 },
    { key: 'status', width: 16 },
    { key: 'amount', width: 22 },
  ];

  // Title Banner
  worksheet.mergeCells('A1:I1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `BEFHUE DIGITAL — CONSOLIDATED AGENCY BILLING REPORT (${data.agency.name.toUpperCase()})`;
  titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFF002B' }, // Befhue Brand Red
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 36;

  worksheet.getRow(2).height = 10;

  // Metadata block
  const meta = [
    { c1: 'A3', l1: 'Agency Name:', c2: 'B3', v1: data.agency.name, c3: 'D3', l2: 'Export Date:', c4: 'E3', v2: new Date().toISOString().slice(0, 10) },
    { c1: 'A4', l1: 'Total Projects:', c2: 'B4', v1: data.agency.totalProjects, c3: 'D4', l2: 'Total Tasks:', c4: 'E4', v2: data.agency.totalTasks },
    { c1: 'A5', l1: 'Completed Tasks:', c2: 'B5', v1: data.agency.completedTasks, c3: 'D5', l2: 'Grand Total Billing:', c4: 'E5', v2: data.agency.totalBilling },
  ];

  for (const m of meta) {
    const l1 = worksheet.getCell(m.c1);
    l1.value = m.l1;
    l1.font = { bold: true, color: { argb: 'FF475569' } };

    const v1 = worksheet.getCell(m.c2);
    v1.value = m.v1;

    const l2 = worksheet.getCell(m.c3);
    l2.value = m.l2;
    l2.font = { bold: true, color: { argb: 'FF475569' } };

    const v2 = worksheet.getCell(m.c4);
    v2.value = m.v2;
    if (m.l2.includes('Grand Total Billing')) {
      v2.font = { bold: true, color: { argb: 'FFFF002B' }, size: 11 };
      v2.numFmt = '₹#,##0.00';
    }
  }

  let currentRow = 7;

  const formatStatus = (s: string) => {
    switch (s) {
      case 'DONE':
      case 'CLOSED':
      case 'VERIFIED':
        return 'Completed';
      case 'IN_PROGRESS':
      case 'IN_TESTING':
      case 'READY_FOR_QA':
      case 'INTERNAL_REVIEW':
      case 'CLIENT_REVIEW':
        return 'In Progress';
      default:
        return 'Pending';
    }
  };

  // Iterate each project
  for (const p of data.projects) {
    worksheet.getRow(currentRow).height = 8;
    currentRow++;

    // Project Section Header
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
    const projHeaderCell = worksheet.getCell(`A${currentRow}`);
    projHeaderCell.value = `PROJECT: ${p.project.name} ${p.project.clientName ? `(Client: ${p.project.clientName})` : ''} — [${p.tasks.length} Tasks]`;
    projHeaderCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    projHeaderCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF27272A' },
    };
    projHeaderCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(currentRow).height = 24;
    currentRow++;

    // Columns Header
    const colHeaders = [
      'Task ID',
      'Task Name',
      'Client',
      'Agency',
      'Project',
      'Assigned Employee',
      'Deadline',
      'Status',
      'Individual Amount (₹)',
    ];
    const headerRow = worksheet.getRow(currentRow);
    headerRow.height = 22;
    headerRow.values = colHeaders;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, size: 10, color: { argb: 'FF18181B' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE4E4E7' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD4D4D8' } },
        bottom: { style: 'thin', color: { argb: 'FFD4D4D8' } },
      };
    });
    currentRow++;

    if (p.tasks.length === 0) {
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
      const emptyCell = worksheet.getCell(`A${currentRow}`);
      emptyCell.value = 'No tasks in this project';
      emptyCell.font = { italic: true, color: { argb: 'FF71717A' } };
      emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(currentRow).height = 20;
      currentRow++;
    } else {
      for (const t of p.tasks) {
        const row = worksheet.getRow(currentRow);
        row.height = 20;
        const deadlineStr = t.dueDate
          ? new Date(t.dueDate).toLocaleDateString('en-GB')
          : 'No deadline';

        row.values = [
          t.humanId,
          t.title,
          p.project.clientName || '—',
          data.agency.name,
          p.project.name,
          t.assigneeName || 'Unassigned',
          deadlineStr,
          formatStatus(t.status),
          Number(t.amount || 0),
        ];

        row.eachCell((cell, colNumber) => {
          cell.font = { name: 'Calibri', size: 10 };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFF4F4F5' } },
            bottom: { style: 'thin', color: { argb: 'FFF4F4F5' } },
          };
          if (colNumber === 1 || colNumber === 7 || colNumber === 8) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (colNumber === 9) {
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
            cell.numFmt = '₹#,##0.00';
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          }
        });
        currentRow++;
      }
    }

    // Subtotal Row for this project
    const subtotalRow = worksheet.getRow(currentRow);
    subtotalRow.height = 22;
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    subtotalRow.getCell(1).value = `Subtotal for ${p.project.name}:`;
    subtotalRow.getCell(1).font = { bold: true, size: 10 };
    subtotalRow.getCell(1).alignment = { horizontal: 'right' };

    const subtotalCell = subtotalRow.getCell(9);
    subtotalCell.value = p.totalBilling;
    subtotalCell.numFmt = '₹#,##0.00';
    subtotalCell.font = { bold: true, size: 10 };
    subtotalCell.alignment = { horizontal: 'right' };

    subtotalRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD4D4D8' } },
        bottom: { style: 'thin', color: { argb: 'FFD4D4D8' } },
      };
    });
    currentRow++;
  }

  // Grand Total Summary Row
  worksheet.getRow(currentRow).height = 10;
  currentRow++;

  const grandTotalRow = worksheet.getRow(currentRow);
  grandTotalRow.height = 28;
  worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
  grandTotalRow.getCell(1).value = `GRAND TOTAL (${data.agency.name.toUpperCase()}):`;
  grandTotalRow.getCell(1).font = { bold: true, size: 11 };
  grandTotalRow.getCell(1).alignment = { horizontal: 'right' };

  const grandTotalCell = grandTotalRow.getCell(9);
  grandTotalCell.value = data.agency.totalBilling;
  grandTotalCell.numFmt = '₹#,##0.00';
  grandTotalCell.font = { bold: true, size: 13, color: { argb: 'FFFF002B' } };
  grandTotalCell.alignment = { horizontal: 'right' };

  grandTotalRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF09090B' } },
      bottom: { style: 'double', color: { argb: 'FF09090B' } },
    };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function saveWorkbookAsExcel(
  workbook: ExcelJS.Workbook,
  filename: string,
) {
  if (typeof window === 'undefined') return;

  const safeFilename = filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  try {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeFilename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      window.URL.revokeObjectURL(url);
    }, 60000);
  } catch (err) {
    console.error('Failed to export Excel file:', err);
  }
}
