import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import { getAgencyAllProjectsData } from '@/lib/agencyBillingService';
import { generateAgencyAllProjectsExcelBuffer } from '@/lib/billingExcel';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — Admin authorization required' }, { status: 403 });
  }

  const { id } = params;
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || undefined;
  const status = searchParams.get('status') || undefined;
  const requestedFilename = searchParams.get('filename') || undefined;

  try {
    const data = await getAgencyAllProjectsData(id);
    if (!data) {
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
    }

    // Filter projects and tasks if search is active
    let projectsData = data.projects;
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      projectsData = projectsData
        .map((p) => {
          const matchProj = p.project.name.toLowerCase().includes(q) ||
            p.project.clientName?.toLowerCase().includes(q);
          if (matchProj) return p;

          const filteredTasks = p.tasks.filter((t) =>
            t.title.toLowerCase().includes(q) ||
            t.humanId.toLowerCase().includes(q) ||
            t.assignee?.name.toLowerCase().includes(q)
          );
          if (filteredTasks.length > 0) {
            const totalBilling = filteredTasks.reduce((acc, t) => acc + (t.amount || 0), 0);
            return {
              ...p,
              tasks: filteredTasks,
              totalBilling,
            };
          }
          return null;
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);
    }

    // Filter tasks by status if status is provided
    if (status && status !== 'ALL') {
      const s = status.toUpperCase();
      projectsData = projectsData.map((p) => {
        let fTasks = p.tasks;
        if (s === 'COMPLETED') {
          fTasks = fTasks.filter((t) => ['DONE', 'CLOSED', 'VERIFIED'].includes(t.status));
        } else if (s === 'IN_PROGRESS') {
          fTasks = fTasks.filter((t) =>
            ['IN_PROGRESS', 'IN_TESTING', 'READY_FOR_QA', 'INTERNAL_REVIEW', 'CLIENT_REVIEW'].includes(t.status)
          );
        } else if (s === 'PENDING') {
          fTasks = fTasks.filter(
            (t) =>
              !['DONE', 'CLOSED', 'VERIFIED', 'IN_PROGRESS', 'IN_TESTING', 'READY_FOR_QA', 'INTERNAL_REVIEW', 'CLIENT_REVIEW'].includes(
                t.status
              )
          );
        }
        const totalBilling = fTasks.reduce((acc, t) => acc + (t.amount || 0), 0);
        return {
          ...p,
          tasks: fTasks,
          totalBilling,
        };
      });
    }

    const totalTasks = projectsData.reduce((acc, p) => acc + p.tasks.length, 0);
    const completedTasks = projectsData.reduce(
      (acc, p) => acc + p.tasks.filter((t) => ['DONE', 'CLOSED', 'VERIFIED'].includes(t.status)).length,
      0
    );
    const totalBilling = projectsData.reduce((acc, p) => acc + p.totalBilling, 0);

    const buffer = await generateAgencyAllProjectsExcelBuffer({
      agency: {
        id: data.agency.id,
        name: data.agency.name,
        totalProjects: projectsData.length,
        totalTasks,
        completedTasks,
        totalBilling,
      },
      projects: projectsData.map((p) => ({
        project: {
          id: p.project.id,
          name: p.project.name,
          prefix: p.project.prefix,
          clientName: p.project.clientName,
          status: p.project.status,
        },
        tasks: p.tasks.map((t) => ({
          humanId: t.humanId,
          title: t.title,
          assigneeName: t.assignee?.name ?? null,
          assignedDate: t.assignedDate,
          dueDate: t.dueDate,
          status: t.status,
          amount: t.amount,
        })),
        totalBilling: p.totalBilling,
      })),
    });

    const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_');
    const defaultFilename = `Billing_Report_${sanitize(data.agency.name)}_All_Projects.xlsx`;
    const filename = requestedFilename?.endsWith('.xlsx') ? requestedFilename : defaultFilename;

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
    console.error('Failed to export consolidated agency billing to Excel:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
