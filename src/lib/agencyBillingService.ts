import { prisma } from '@/lib/prisma';
import type {
  AgencyBillingSummary,
  AgencyProjectSummary,
  ProjectBillingDetail,
  ProjectBillingTask,
} from '@/types';

const COMPLETED_STATUSES = ['DONE', 'CLOSED', 'VERIFIED'];
const IN_PROGRESS_STATUSES = [
  'IN_PROGRESS',
  'IN_TESTING',
  'READY_FOR_QA',
  'INTERNAL_REVIEW',
  'CLIENT_REVIEW',
];

export function decodeAgencyId(id: string): { isPrefix: boolean; rawName: string | null } {
  let cleanId = id;
  try {
    cleanId = decodeURIComponent(id);
    while (cleanId.includes('%')) {
      const next = decodeURIComponent(cleanId);
      if (next === cleanId) break;
      cleanId = next;
    }
  } catch {}

  if (cleanId.startsWith('agency_')) {
    let rawName = cleanId.replace('agency_', '').trim();
    try {
      while (rawName.includes('%')) {
        const next = decodeURIComponent(rawName);
        if (next === rawName) break;
        rawName = next;
      }
    } catch {}
    return {
      isPrefix: true,
      rawName: rawName.trim(),
    };
  }
  return { isPrefix: false, rawName: null };
}

/**
 * Fetch all agencies with aggregate project counts, task counts, and billing totals.
 */
export async function getAllAgencies(): Promise<AgencyBillingSummary[]> {
  const [clients, allTasks, allProjects] = await Promise.all([
    prisma.client.findMany({
      select: {
        id: true,
        name: true,
        clientType: true,
        billingReference: true,
        billingCurrency: true,
        logoUrl: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.task.findMany({
      where: { deletedAt: { isSet: false } },
      select: {
        id: true,
        humanId: true,
        title: true,
        status: true,
        amount: true,
        currency: true,
        agencyName: true,
        projectId: true,
        clientId: true,
        project: { select: { id: true, name: true, prefix: true, clientId: true, status: true } },
        client: { select: { id: true, name: true, clientType: true } },
      },
    }),
    prisma.project.findMany({
      select: {
        id: true,
        name: true,
        prefix: true,
        status: true,
        clientId: true,
        client: { select: { id: true, name: true, clientType: true } },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  const entityMap = new Map<
    string,
    {
      id: string;
      name: string;
      clientType: 'AGENCY' | 'CLIENT';
      clientId: string | null;
      logoUrl: string | null;
      billingReference: string | null;
      projectsMap: Map<string, { id: string; tasks: typeof allTasks }>;
    }
  >();

  function getOrCreateEntity(
    key: string,
    name: string,
    clientType: 'AGENCY' | 'CLIENT',
    clientId: string | null = null,
    logoUrl: string | null = null,
    billingReference: string | null = null,
  ) {
    const k = `${clientType.toLowerCase()}_${key.trim().toLowerCase()}`;
    if (!entityMap.has(k)) {
      entityMap.set(k, {
        id: clientId ? clientId : `agency_${encodeURIComponent(name.trim())}`,
        name: name.trim(),
        clientType,
        clientId,
        logoUrl,
        billingReference:
          billingReference ||
          (clientType === 'AGENCY'
            ? `AGY-${name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase()}-REF`
            : `CLI-${name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase()}-REF`),
        projectsMap: new Map(),
      });
    }
    return entityMap.get(k)!;
  }

  // 1. Identify which clients are associated with an agency (agency-managed clients)
  const agencyClientIds = new Set<string>();
  const agencyClientNames = new Set<string>();
  const clientToAgencyMap = new Map<string, string>();

  for (const t of allTasks) {
    if (t.agencyName && t.agencyName.trim()) {
      const agName = t.agencyName.trim();
      if (t.clientId) {
        agencyClientIds.add(t.clientId);
        clientToAgencyMap.set(t.clientId, agName);
      }
      if (t.client?.name) {
        const cLower = t.client.name.trim().toLowerCase();
        agencyClientNames.add(cLower);
        clientToAgencyMap.set(cLower, agName);
      }
    }
  }

  // 2. Register distinct agencyName from tasks as AGENCY entities
  for (const t of allTasks) {
    if (t.agencyName && t.agencyName.trim()) {
      getOrCreateEntity(t.agencyName, t.agencyName, 'AGENCY');
    }
  }

  // 3. Register clients configured in prisma.client:
  // - Clients configured as AGENCY are registered as top-level Agencies
  // - Clients that come under an agency are excluded from top-level display (they only show after clicking the agency card)
  // - Standalone / separate clients (not under any agency) are registered individually as top-level Clients
  for (const c of clients) {
    if (c.clientType === 'AGENCY') {
      getOrCreateEntity(c.name, c.name, 'AGENCY', c.id, c.logoUrl, c.billingReference);
    } else {
      const isUnderAgency =
        agencyClientIds.has(c.id) || agencyClientNames.has(c.name.trim().toLowerCase());
      if (!isUnderAgency) {
        getOrCreateEntity(c.name, c.name, 'CLIENT', c.id, c.logoUrl, c.billingReference);
      }
    }
  }

  // 4. Map tasks into entity projects
  for (const t of allTasks) {
    // Agency mapping
    let agency = null;
    if (t.agencyName && t.agencyName.trim()) {
      agency = entityMap.get(`agency_${t.agencyName.trim().toLowerCase()}`);
    } else if (t.client?.clientType === 'AGENCY') {
      agency = entityMap.get(`agency_${t.client.name.trim().toLowerCase()}`);
    }

    if (agency) {
      const pId =
        t.projectId ||
        (t.project
          ? t.project.id
          : t.clientId
            ? `client_tasks_${t.clientId}`
            : `general_tasks_${agency.id}`);
      if (!agency.projectsMap.has(pId)) {
        agency.projectsMap.set(pId, { id: pId, tasks: [] });
      }
      agency.projectsMap.get(pId)!.tasks.push(t);
    }

    // Separate Client mapping: only applies if this client is registered as a standalone client entity
    if (t.clientId || t.client) {
      const cName = t.client?.name;
      if (cName) {
        const client = entityMap.get(`client_${cName.trim().toLowerCase()}`);
        if (client) {
          const pId = t.projectId || (t.project ? t.project.id : `general_tasks_${client.id}`);
          if (!client.projectsMap.has(pId)) {
            client.projectsMap.set(pId, { id: pId, tasks: [] });
          }
          client.projectsMap.get(pId)!.tasks.push(t);
        }
      }
    }
  }

  // 5. Attach any empty projects directly owned by a client or agency
  for (const p of allProjects) {
    if (p.client) {
      if (p.client.clientType === 'AGENCY') {
        const agEntity = entityMap.get(`agency_${p.client.name.trim().toLowerCase()}`);
        if (agEntity && !agEntity.projectsMap.has(p.id)) {
          agEntity.projectsMap.set(p.id, { id: p.id, tasks: [] });
        }
      } else {
        const clientEntity = entityMap.get(`client_${p.client.name.trim().toLowerCase()}`);
        if (clientEntity) {
          if (!clientEntity.projectsMap.has(p.id)) {
            clientEntity.projectsMap.set(p.id, { id: p.id, tasks: [] });
          }
        } else {
          // If this client is under an agency, attach their project to that agency
          const agName =
            clientToAgencyMap.get(p.clientId) ||
            clientToAgencyMap.get(p.client.name.trim().toLowerCase());
          if (agName) {
            const agEntity = entityMap.get(`agency_${agName.toLowerCase()}`);
            if (agEntity && !agEntity.projectsMap.has(p.id)) {
              agEntity.projectsMap.set(p.id, { id: p.id, tasks: [] });
            }
          }
        }
      }
    }
  }

  const result: AgencyBillingSummary[] = [];

  entityMap.forEach((ag) => {
    let totalTasks = 0;
    let completedTasks = 0;
    let totalBilling = 0;

    ag.projectsMap.forEach((p) => {
      totalTasks += p.tasks.length;
      for (const t of p.tasks) {
        if (COMPLETED_STATUSES.includes(t.status)) completedTasks++;
        if (t.amount != null) totalBilling += Number(t.amount);
      }
    });

    result.push({
      id: ag.id,
      name: ag.name,
      clientType: ag.clientType,
      totalProjects: ag.projectsMap.size,
      totalTasks,
      completedTasks,
      totalBilling,
      currency: 'INR',
      logoUrl: ag.logoUrl,
      billingReference: ag.billingReference,
    });
  });

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Fetch an agency by ID along with all projects and task metrics under that agency.
 */
export async function getAgencyProjects(agencyId: string): Promise<{
  agency: AgencyBillingSummary;
  projects: AgencyProjectSummary[];
} | null> {
  const { isPrefix, rawName } = decodeAgencyId(agencyId);

  let agencyName: string;
  let clientRecord: { id: string; name: string; logoUrl: string | null; billingReference: string | null } | null = null;

  if (isPrefix && rawName) {
    agencyName = rawName;
    clientRecord = await prisma.client.findFirst({
      where: { name: { equals: agencyName, mode: 'insensitive' } },
      select: { id: true, name: true, logoUrl: true, billingReference: true },
    });
  } else {
    clientRecord = await prisma.client.findUnique({
      where: { id: agencyId },
      select: { id: true, name: true, logoUrl: true, billingReference: true },
    });
    if (!clientRecord) {
      return null;
    }
    agencyName = clientRecord.name;
  }

  // Fetch tasks belonging to this agency
  const agencyTaskFilter = clientRecord
    ? {
        deletedAt: { isSet: false },
        OR: [
          { agencyName: { equals: agencyName, mode: 'insensitive' as const } },
          { clientId: clientRecord.id },
        ],
      }
    : {
        deletedAt: { isSet: false },
        agencyName: { equals: agencyName, mode: 'insensitive' as const },
      };

  const [agencyTasks, directProjects] = await Promise.all([
    prisma.task.findMany({
      where: agencyTaskFilter,
      select: {
        id: true,
        humanId: true,
        title: true,
        status: true,
        amount: true,
        currency: true,
        projectId: true,
        clientId: true,
        project: {
          select: { id: true, name: true, prefix: true, status: true, clientId: true },
        },
        client: {
          select: { id: true, name: true, clientType: true },
        },
      },
    }),
    clientRecord
      ? prisma.project.findMany({
          where: { clientId: clientRecord.id },
          select: {
            id: true,
            name: true,
            prefix: true,
            status: true,
            clientId: true,
            client: { select: { id: true, name: true, clientType: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  // Group tasks by project
  const projectMap = new Map<
    string,
    {
      id: string;
      name: string;
      prefix: string;
      clientName: string | null;
      clientId: string | null;
      clientType: string | null;
      status: string;
      tasks: typeof agencyTasks;
    }
  >();

  // Direct projects owned by the agency
  for (const dp of directProjects) {
    projectMap.set(dp.id, {
      id: dp.id,
      name: dp.name,
      prefix: dp.prefix,
      clientName: dp.client?.name ?? null,
      clientId: dp.clientId,
      clientType: dp.client?.clientType ?? null,
      status: dp.status,
      tasks: [],
    });
  }

  // Projects derived from tasks
  for (const t of agencyTasks) {
    const pId =
      t.projectId ||
      (t.project
        ? t.project.id
        : t.clientId
          ? `client_tasks_${t.clientId}`
          : `general_tasks_${agencyId}`);
    const pName =
      t.project?.name || (t.client ? `${t.client.name} Tasks` : 'General Tasks');
    const pPrefix =
      t.project?.prefix ||
      (t.client ? t.client.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() : 'GEN');
    const pStatus = t.project?.status || 'ACTIVE';
    const cName = t.client?.name ?? null;
    const cType = t.client?.clientType ?? (t.client ? 'CLIENT' : 'AGENCY');

    if (!projectMap.has(pId)) {
      projectMap.set(pId, {
        id: pId,
        name: pName,
        prefix: pPrefix,
        clientName: cName,
        clientId: t.clientId || null,
        clientType: cType,
        status: pStatus,
        tasks: [],
      });
    }

    projectMap.get(pId)!.tasks.push(t);
  }

  const projects: AgencyProjectSummary[] = [];
  let agencyTotalTasks = 0;
  let agencyCompletedTasks = 0;
  let agencyTotalBilling = 0;

  projectMap.forEach((p) => {
    const totalTasks = p.tasks.length;
    let completedTasks = 0;
    let inProgressTasks = 0;
    let totalBilling = 0;

    for (const t of p.tasks) {
      if (COMPLETED_STATUSES.includes(t.status)) completedTasks++;
      else if (IN_PROGRESS_STATUSES.includes(t.status)) inProgressTasks++;
      if (t.amount != null) totalBilling += Number(t.amount);
    }

    const pendingTasks = totalTasks - completedTasks - inProgressTasks;

    agencyTotalTasks += totalTasks;
    agencyCompletedTasks += completedTasks;
    agencyTotalBilling += totalBilling;

    projects.push({
      id: p.id,
      name: p.name,
      prefix: p.prefix,
      clientName: p.clientName,
      clientId: p.clientId,
      clientType: p.clientType || (p.clientName ? 'CLIENT' : 'AGENCY'),
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      totalBilling,
      currency: 'INR',
      status: p.status,
    });
  });

  projects.sort((a, b) => a.name.localeCompare(b.name));

  const agency: AgencyBillingSummary = {
    id: agencyId,
    name: agencyName,
    clientType: (clientRecord as { clientType?: string } | null)?.clientType === 'AGENCY' ? 'AGENCY' : isPrefix ? 'AGENCY' : 'CLIENT',
    totalProjects: projects.length,
    totalTasks: agencyTotalTasks,
    completedTasks: agencyCompletedTasks,
    totalBilling: agencyTotalBilling,
    currency: 'INR',
    logoUrl: clientRecord?.logoUrl ?? null,
    billingReference:
      clientRecord?.billingReference ??
      `AGY-${agencyName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase()}-REF`,
  };

  return { agency, projects };
}

/**
 * Fetch dedicated billing details for a specific project under an agency.
 */
export async function getProjectBillingDetail(
  agencyId: string,
  projectId: string,
): Promise<ProjectBillingDetail | null> {
  let agencyData = await getAgencyProjects(agencyId);
  let projectSummary = agencyData?.projects.find((p) => p.id === projectId) ?? null;

  let agencyName = agencyData?.agency.name ?? '';
  let resolvedAgencyId = agencyData?.agency.id ?? agencyId;

  if (!projectSummary) {
    const proj = await prisma.project.findUnique({
      where: { id: projectId },
      include: { client: true },
    });
    if (!proj) return null;

    const sampleTask = await prisma.task.findFirst({
      where: { projectId: proj.id, agencyName: { not: null } },
      select: { agencyName: true },
    });

    agencyName = sampleTask?.agencyName || agencyName || 'Agency';
    projectSummary = {
      id: proj.id,
      name: proj.name,
      prefix: proj.prefix,
      clientName: proj.client?.name ?? null,
      clientId: proj.clientId,
      totalTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      pendingTasks: 0,
      totalBilling: 0,
      currency: 'INR',
      status: proj.status,
    };
  }

  const isGeneralTasks = projectId.startsWith('general_tasks_');

  // Query tasks belonging specifically to this project & agency
  let whereClause: Record<string, unknown>;

  if (isGeneralTasks) {
    whereClause = {
      deletedAt: { isSet: false },
      projectId: null,
      OR: [
        { agencyName: { equals: agencyName, mode: 'insensitive' } },
        ...(resolvedAgencyId && !resolvedAgencyId.startsWith('agency_')
          ? [{ clientId: resolvedAgencyId }]
          : []),
      ],
    };
  } else {
    whereClause = {
      deletedAt: { isSet: false },
      projectId: projectId,
    };
  }

  const tasks = await prisma.task.findMany({
    where: whereClause,
    select: {
      id: true,
      humanId: true,
      title: true,
      status: true,
      amount: true,
      currency: true,
      createdAt: true,
      dueDate: true,
      assignee: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          designation: true,
        },
      },
      client: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  let totalBilling = 0;
  let completedTasks = 0;

  const formattedTasks: ProjectBillingTask[] = tasks.map((t) => {
    const amt = t.amount != null ? Number(t.amount) : 0;
    totalBilling += amt;
    if (COMPLETED_STATUSES.includes(t.status)) completedTasks++;

    return {
      id: t.id,
      humanId: t.humanId,
      title: t.title,
      assignee: t.assignee
        ? {
            id: t.assignee.id,
            name: t.assignee.name,
            avatarUrl: t.assignee.avatarUrl,
            designation: t.assignee.designation,
          }
        : null,
      assignedDate: t.createdAt.toISOString(),
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      status: t.status,
      amount: amt,
      currency: t.currency ?? 'INR',
    };
  });

  return {
    agency: {
      id: agencyId,
      name: agencyName,
    },
    project: {
      id: projectSummary.id,
      name: projectSummary.name,
      prefix: projectSummary.prefix,
      clientName: projectSummary.clientName,
      status: projectSummary.status,
    },
    summary: {
      totalTasks: formattedTasks.length,
      completedTasks,
      totalBilling,
      currency: 'INR',
    },
    tasks: formattedTasks,
  };
}

/**
 * Fetch consolidated data for all projects under an agency for Excel export.
 */
export async function getAgencyAllProjectsData(agencyId: string) {
  const agencyData = await getAgencyProjects(agencyId);
  if (!agencyData) return null;

  const projectsWithTasks = await Promise.all(
    agencyData.projects.map(async (p) => {
      const detail = await getProjectBillingDetail(agencyId, p.id);
      return {
        project: p,
        tasks: detail?.tasks ?? [],
        totalBilling: detail?.summary.totalBilling ?? p.totalBilling,
      };
    }),
  );

  return {
    agency: agencyData.agency,
    projects: projectsWithTasks,
  };
}
