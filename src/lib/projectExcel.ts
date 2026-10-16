import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { prisma } from '@/lib/prisma';
import { computeEngagementHealth } from '@/lib/engagementHealth';

export interface ProjectExcelRow {
  'Project ID': string;
  'Code / Prefix': string;
  'Client Name': string;
  'Project Name': string;
  'Description': string;
  'Assigned Employee': string;
  'Employee Email': string;
  'Status': string;
  'Deadline': string;
  'Total Tasks': number;
  'Progress': string;
  'Health': string;
  'Amount': number;
  'Currency': string;
  'Created Date': string;
  'Updated Date': string;
}

/**
 * Builds array of rows formatted for Excel export.
 */
export async function buildProjectExcelData(): Promise<ProjectExcelRow[]> {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      client: { select: { name: true } },
      assignedEmployee: { select: { name: true, email: true } },
      _count: { select: { tasks: true } },
    },
  });

  const rows: ProjectExcelRow[] = await Promise.all(
    projects.map(async (p) => {
      const tasks = await prisma.task.findMany({
        where: { projectId: p.id, deletedAt: { isSet: false } },
        select: { id: true, status: true, dueDate: true, isGate: true, dependsOn: true },
      });
      const health = computeEngagementHealth(tasks);

      return {
        'Project ID': p.id,
        'Code / Prefix': p.prefix,
        'Client Name': p.client?.name ?? '—',
        'Project Name': p.name,
        'Description': p.description ?? '—',
        'Assigned Employee': p.assignedEmployee?.name ?? 'Unassigned',
        'Employee Email': p.assignedEmployee?.email ?? '—',
        'Status': p.status,
        'Deadline': p.deadline ? new Date(p.deadline).toISOString().slice(0, 10) : (p.targetDate ? new Date(p.targetDate).toISOString().slice(0, 10) : '—'),
        'Total Tasks': p._count.tasks,
        'Progress': `${health.percentDone ?? 0}%`,
        'Health': (health.health ?? 'on_track').replace('_', ' ').toUpperCase(),
        'Amount': p.amount != null ? Number(p.amount) : 0,
        'Currency': p.currency ?? 'INR',
        'Created Date': new Date(p.createdAt).toISOString().slice(0, 10),
        'Updated Date': new Date(p.updatedAt).toISOString().slice(0, 10),
      };
    }),
  );

  return rows;
}

/**
 * Generates an Excel buffer with styled column widths and summary metadata using ExcelJS.
 */
export async function generateProjectExcelBuffer(): Promise<Buffer> {
  const data = await buildProjectExcelData();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Befhue Workspace';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Projects Master', {
    views: [{ showGridLines: true }],
  });

  worksheet.columns = [
    { header: 'Project ID', key: 'id', width: 28 },
    { header: 'Code / Prefix', key: 'prefix', width: 16 },
    { header: 'Client Name', key: 'client', width: 24 },
    { header: 'Project Name', key: 'name', width: 30 },
    { header: 'Description', key: 'description', width: 36 },
    { header: 'Assigned Employee', key: 'employee', width: 24 },
    { header: 'Employee Email', key: 'email', width: 26 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Deadline', key: 'deadline', width: 16 },
    { header: 'Total Tasks', key: 'tasks', width: 14 },
    { header: 'Progress', key: 'progress', width: 14 },
    { header: 'Health', key: 'health', width: 16 },
    { header: 'Amount (INR)', key: 'amount', width: 18 },
    { header: 'Currency', key: 'currency', width: 12 },
    { header: 'Created Date', key: 'created', width: 16 },
    { header: 'Updated Date', key: 'updated', width: 16 },
  ];

  // Style Header Row
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Populate data
  let rowIdx = 2;
  for (const item of data) {
    const row = worksheet.addRow([
      item['Project ID'],
      item['Code / Prefix'],
      item['Client Name'],
      item['Project Name'],
      item['Description'],
      item['Assigned Employee'],
      item['Employee Email'],
      item['Status'],
      item['Deadline'],
      item['Total Tasks'],
      item['Progress'],
      item['Health'],
      item['Amount'],
      item['Currency'],
      item['Created Date'],
      item['Updated Date'],
    ]);
    row.height = 22;

    const isEven = rowIdx % 2 === 0;
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
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      if (colNumber === 13) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '₹#,##0.00';
      } else if ([1, 2, 8, 9, 10, 11, 12, 14, 15, 16].includes(colNumber)) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });

    rowIdx++;
  }

  const rawBuffer = await workbook.xlsx.writeBuffer();
  const buf = Buffer.from(rawBuffer);

  // Sync to disk in public/exports/projects_master.xlsx
  try {
    const exportDir = path.join(process.cwd(), 'public', 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    const filePath = path.join(exportDir, 'projects_master.xlsx');
    fs.writeFileSync(filePath, buf);
  } catch (err) {
    console.error('Failed to sync projects excel file to disk:', err);
  }

  return buf;
}

export async function handleProjectsExport(): Promise<Response> {
  try {
    const buffer = await generateProjectExcelBuffer();
    const filename = `Befhue_Projects_Master_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err) {
    console.error('Failed to export projects to Excel:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
