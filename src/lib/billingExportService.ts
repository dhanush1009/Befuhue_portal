import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  generateBillingExcelBuffer,
  generateProjectBillingExcelBuffer,
  getBillingExportFilename,
  getProjectBillingExportFilename,
} from '@/lib/billingExcel';
import { getProjectBillingDetail } from '@/lib/agencyBillingService';

export interface BillingExportOptions {
  requestedFilename?: string;
  status?: string;
  search?: string;
}

export async function handleBillingExport(id: string, options?: BillingExportOptions) {
  const isAgencyPrefix = id.startsWith('agency_');
  const agencyNameDecoded = isAgencyPrefix ? decodeURIComponent(id.replace('agency_', '')) : null;

  try {
    let entityName = '';
    let clientType = 'CLIENT';
    let billingReference = '';
    let whereClause: Record<string, unknown>;
    let isSingleProject = false;
    let singleProjectMeta: {
      agencyName: string;
      projectName: string;
      clientName: string | null;
    } | null = null;

    if (isAgencyPrefix && agencyNameDecoded) {
      entityName = agencyNameDecoded;
      clientType = 'AGENCY';
      billingReference = `AGY-${agencyNameDecoded.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase()}-REF`;
      whereClause = {
        deletedAt: { isSet: false },
        agencyName: agencyNameDecoded,
      };
    } else {
      // 1. First check if id is a Client
      const client = await prisma.client.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          clientType: true,
          billingReference: true,
          billingAmount: true,
        },
      });

      if (client) {
        entityName = client.name;
        clientType = client.clientType === 'AGENCY' ? 'AGENCY' : 'CLIENT';
        billingReference =
          client.billingReference ||
          `BILL-${client.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase()}-${client.id.slice(-4).toUpperCase()}`;

        if (client.clientType === 'AGENCY') {
          whereClause = {
            deletedAt: { isSet: false },
            OR: [
              { clientId: client.id },
              { agencyName: client.name },
            ],
          };
        } else {
          whereClause = {
            deletedAt: { isSet: false },
            clientId: client.id,
          };
        }
      } else {
        // 2. Check if id is a Project
        const project = await prisma.project.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            prefix: true,
            clientId: true,
            client: { select: { id: true, name: true, clientType: true } },
          },
        });

        if (project) {
          isSingleProject = true;
          entityName = project.name;
          clientType = 'PROJECT';
          billingReference = `PRJ-${project.prefix || project.name.slice(0, 4).toUpperCase()}`;

          const sampleTask = await prisma.task.findFirst({
            where: { projectId: project.id, agencyName: { not: null } },
            select: { agencyName: true },
          });

          const agencyName = sampleTask?.agencyName || 'Independent Agency';
          singleProjectMeta = {
            agencyName,
            projectName: project.name,
            clientName: project.client?.name ?? null,
          };

          whereClause = {
            deletedAt: { isSet: false },
            projectId: project.id,
          };
        } else {
          // 3. Check if id matches an agency name directly
          const taskByAgency = await prisma.task.findFirst({
            where: { agencyName: id },
            select: { agencyName: true },
          });

          if (taskByAgency && taskByAgency.agencyName) {
            entityName = taskByAgency.agencyName;
            clientType = 'AGENCY';
            billingReference = `AGY-${taskByAgency.agencyName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase()}-REF`;
            whereClause = {
              deletedAt: { isSet: false },
              agencyName: taskByAgency.agencyName,
            };
          } else {
            return NextResponse.json({ error: 'Billing entity or project not found' }, { status: 404 });
          }
        }
      }
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      select: {
        id: true,
        humanId: true,
        title: true,
        status: true,
        dueDate: true,
        createdAt: true,
        amount: true,
        currency: true,
        agencyName: true,
        project: { select: { name: true } },
        client: { select: { name: true } },
        assignee: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Apply active status filter
    let filteredTasks = tasks;
    if (options?.status && options.status !== 'ALL') {
      const s = options.status.toUpperCase();
      if (s === 'COMPLETED') {
        filteredTasks = filteredTasks.filter((t) => ['DONE', 'CLOSED', 'VERIFIED'].includes(t.status));
      } else if (s === 'IN_PROGRESS') {
        filteredTasks = filteredTasks.filter((t) =>
          ['IN_PROGRESS', 'IN_TESTING', 'READY_FOR_QA', 'INTERNAL_REVIEW', 'CLIENT_REVIEW'].includes(t.status),
        );
      } else if (s === 'PENDING') {
        filteredTasks = filteredTasks.filter(
          (t) =>
            !['DONE', 'CLOSED', 'VERIFIED', 'IN_PROGRESS', 'IN_TESTING', 'READY_FOR_QA', 'INTERNAL_REVIEW', 'CLIENT_REVIEW'].includes(
              t.status,
            ),
        );
      }
    }

    // Apply active search filter
    if (options?.search && options.search.trim()) {
      const q = options.search.trim().toLowerCase();
      filteredTasks = filteredTasks.filter((t) => {
        const matchTitle = t.title?.toLowerCase().includes(q);
        const matchHumanId = t.humanId?.toLowerCase().includes(q);
        const matchProject = t.project?.name?.toLowerCase().includes(q);
        const matchEmp = t.assignee?.name?.toLowerCase().includes(q);
        const matchClient = t.client?.name?.toLowerCase().includes(q);
        return matchTitle || matchHumanId || matchProject || matchEmp || matchClient;
      });
    }

    const totalTasks = filteredTasks.length;
    const completedTasks = filteredTasks.filter((t) => ['DONE', 'CLOSED', 'VERIFIED'].includes(t.status)).length;
    const inProgressTasks = filteredTasks.filter((t) =>
      ['IN_PROGRESS', 'IN_TESTING', 'READY_FOR_QA', 'INTERNAL_REVIEW', 'CLIENT_REVIEW'].includes(t.status),
    ).length;
    const pendingTasks = totalTasks - completedTasks - inProgressTasks;
    const totalBilling = filteredTasks.reduce((acc, t) => acc + (t.amount != null ? Number(t.amount) : 0), 0);

    let buffer: Buffer;

    if (isSingleProject && singleProjectMeta) {
      buffer = await generateProjectBillingExcelBuffer({
        agencyName: singleProjectMeta.agencyName,
        projectName: singleProjectMeta.projectName,
        clientName: singleProjectMeta.clientName,
        totalTasks,
        completedTasks,
        totalBilling,
        tasks: filteredTasks.map((t) => ({
          humanId: t.humanId,
          title: t.title,
          clientName: t.client?.name ?? singleProjectMeta?.clientName ?? null,
          agencyName: t.agencyName ?? singleProjectMeta?.agencyName ?? null,
          projectName: singleProjectMeta?.projectName ?? null,
          assigneeName: t.assignee?.name ?? null,
          assignedDate: t.createdAt.toISOString(),
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          status: t.status,
          amount: t.amount != null ? Number(t.amount) : 0,
        })),
      });
    } else {
      const summary = {
        entityName,
        clientType,
        billingReference,
        totalTasks,
        completedTasks,
        inProgressTasks,
        pendingTasks,
        totalBilling,
        currency: 'INR',
      };

      const exportTasks = filteredTasks.map((t) => ({
        id: t.id,
        humanId: t.humanId,
        title: t.title,
        projectName: t.project?.name ?? null,
        clientName: t.client?.name ?? entityName,
        agencyName: t.agencyName ?? entityName,
        assignedEmployee: t.assignee?.name ?? null,
        dueDate: t.dueDate,
        createdAt: t.createdAt,
        status: t.status,
        amount: t.amount,
        currency: t.currency ?? 'INR',
      }));

      buffer = await generateBillingExcelBuffer(summary, exportTasks);
    }

    const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fallbackFilename = `Billing_Report_${sanitize(entityName)}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const filename = options?.requestedFilename?.endsWith('.xlsx')
      ? options.requestedFilename
      : fallbackFilename;

    try {
      const exportDir = path.join(process.cwd(), 'public', 'exports', 'billing');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }
      fs.writeFileSync(path.join(exportDir, filename), buffer);
    } catch (e) {
      console.error('Failed to sync billing export to disk:', e);
    }

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Access-Control-Expose-Headers': 'Content-Disposition',
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err) {
    console.error('Failed to export billing statement to Excel:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function handleProjectBillingExport(
  agencyId: string,
  projectId: string,
  options?: BillingExportOptions,
): Promise<Response> {
  try {
    const detail = await getProjectBillingDetail(agencyId, projectId);
    if (!detail) {
      return NextResponse.json({ error: 'Project billing details not found' }, { status: 404 });
    }

    let filteredTasks = detail.tasks;
    if (options?.status && options.status !== 'ALL') {
      const s = options.status.toUpperCase();
      if (s === 'COMPLETED') {
        filteredTasks = filteredTasks.filter((t) => ['DONE', 'CLOSED', 'VERIFIED'].includes(t.status));
      } else if (s === 'IN_PROGRESS') {
        filteredTasks = filteredTasks.filter((t) =>
          ['IN_PROGRESS', 'IN_TESTING', 'READY_FOR_QA', 'INTERNAL_REVIEW', 'CLIENT_REVIEW'].includes(t.status),
        );
      } else if (s === 'PENDING') {
        filteredTasks = filteredTasks.filter(
          (t) =>
            !['DONE', 'CLOSED', 'VERIFIED', 'IN_PROGRESS', 'IN_TESTING', 'READY_FOR_QA', 'INTERNAL_REVIEW', 'CLIENT_REVIEW'].includes(
              t.status,
            ),
        );
      }
    }

    if (options?.search && options.search.trim()) {
      const q = options.search.trim().toLowerCase();
      filteredTasks = filteredTasks.filter((t) => {
        const matchTitle = t.title?.toLowerCase().includes(q);
        const matchHumanId = t.humanId?.toLowerCase().includes(q);
        const matchEmp = t.assignee?.name?.toLowerCase().includes(q);
        return matchTitle || matchHumanId || matchEmp;
      });
    }

    const totalTasks = filteredTasks.length;
    const completedTasks = filteredTasks.filter((t) => ['DONE', 'CLOSED', 'VERIFIED'].includes(t.status)).length;
    const totalBilling = filteredTasks.reduce((acc, t) => acc + (t.amount != null ? Number(t.amount) : 0), 0);

    const buffer = await generateProjectBillingExcelBuffer({
      agencyName: detail.agency.name,
      projectName: detail.project.name,
      clientName: detail.project.clientName,
      totalTasks,
      completedTasks,
      totalBilling,
      tasks: filteredTasks.map((t) => ({
        humanId: t.humanId,
        title: t.title,
        clientName: detail.project.clientName,
        agencyName: detail.agency.name,
        projectName: detail.project.name,
        assigneeName: t.assignee?.name ?? null,
        assignedDate: t.assignedDate,
        dueDate: t.dueDate,
        status: t.status,
        amount: t.amount,
      })),
    });

    const filename = options?.requestedFilename?.endsWith('.xlsx')
      ? options.requestedFilename
      : getProjectBillingExportFilename(detail.agency.name, detail.project.name);

    try {
      const exportDir = path.join(process.cwd(), 'public', 'exports');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }
      fs.writeFileSync(path.join(exportDir, filename), buffer);
    } catch (e) {
      console.error('Failed to sync project billing export to disk:', e);
    }

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Access-Control-Expose-Headers': 'Content-Disposition',
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err) {
    console.error('Failed to export project billing to Excel:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

