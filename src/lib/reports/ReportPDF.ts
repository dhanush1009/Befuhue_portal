/**
 * ReportPDF.ts — High performance, pure pdf-lib generator for Monthly Project Reports.
 * Generates an executive-ready, multi-page A4 Landscape PDF with rich styling,
 * KPI metric cards, team contribution tables, paginated task timelines,
 * stage breakdown charts, bug metrics, and effort analysis.
 */

import {
  PDFDocument,
  StandardFonts,
  rgb,
  PageSizes,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import { format } from 'date-fns';
import type { ProjectReportData, ReportTask, ReportMember } from '@/types/report';

// ── Color Utilities ─────────────────────────────────────────────────────────

const hex = (h: string) => {
  const clean = h.replace('#', '');
  const n = parseInt(clean, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

const C = {
  primary: hex('#8E51FF'), // Violet 600
  primaryLight: hex('#EDE9FE'), // Violet 100
  primaryBorder: hex('#DDD6FF'), // Violet 200
  primaryDark: hex('#5D0EC0'), // Violet 800
  dark: hex('#111827'), // Gray 900
  body: hex('#374151'), // Gray 700
  muted: hex('#6B7280'), // Gray 500
  light: hex('#9CA3AF'), // Gray 400
  border: hex('#E5E7EB'), // Gray 200
  bg: hex('#F9FAFB'), // Gray 50
  altRow: hex('#F8FAFC'), // Slate 50
  white: rgb(1, 1, 1),
  green: hex('#16A34A'), // Green 600
  greenBg: hex('#DCFCE7'), // Green 100
  greenBorder: hex('#BBF7D0'),
  red: hex('#DC2626'), // Red 600
  redBg: hex('#FEE2E2'), // Red 100
  amber: hex('#D97706'), // Amber 600
  amberBg: hex('#FEF3C7'), // Amber 100
  blue: hex('#2563EB'), // Blue 600
  blueBg: hex('#DBEAFE'), // Blue 100
  yellow: hex('#EAB308'),
};

// ── Layout Constants ────────────────────────────────────────────────────────

const PW = PageSizes.A4[1]; // 841.89 (Landscape Width)
const PH = PageSizes.A4[0]; // 595.28 (Landscape Height)
const ML = 28; // Margin Left
const MR = 28; // Margin Right
const CW = PW - ML - MR; // Content Width = 785.89
const FOOTER_Y = 22;

// ── String & Format Helpers ─────────────────────────────────────────────────

function formatEffort(mins: number | null | undefined): string {
  if (mins === null || mins === undefined || mins === 0) return '0h 0m';
  const isNeg = mins < 0;
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = isNeg ? '-' : '';
  if (h === 0) return `${sign}${m}m`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${m}m`;
}

function sanitize(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/[\r\n\t]+/g, ' ').trim();
}

function truncateText(
  font: PDFFont,
  text: string,
  size: number,
  maxWidth: number
): string {
  if (!text) return '';
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let str = text;
  while (str.length > 1 && font.widthOfTextAtSize(str + '...', size) > maxWidth) {
    str = str.slice(0, -1);
  }
  return str + '...';
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'P0':
      return C.red;
    case 'P1':
      return C.amber;
    case 'P2':
      return C.blue;
    default:
      return C.muted;
  }
}

function getSeverityColor(sev?: string) {
  switch (sev) {
    case 'CRITICAL':
      return C.red;
    case 'HIGH':
      return C.amber;
    case 'MEDIUM':
      return C.yellow;
    case 'LOW':
      return C.blue;
    default:
      return C.muted;
  }
}

// ── Low-Level Drawing Primitives ────────────────────────────────────────────

function txt(
  page: PDFPage,
  str: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color = C.body,
  maxWidth?: number
) {
  const safeStr = maxWidth ? truncateText(font, sanitize(str), size, maxWidth) : sanitize(str);
  if (!safeStr) return;
  page.drawText(safeStr, { x, y, size, font, color });
}

function txtRight(
  page: PDFPage,
  str: string,
  rx: number,
  y: number,
  size: number,
  font: PDFFont,
  color = C.body
) {
  const safeStr = sanitize(str);
  if (!safeStr) return;
  const w = font.widthOfTextAtSize(safeStr, size);
  page.drawText(safeStr, { x: rx - w, y, size, font, color });
}

function txtCenter(
  page: PDFPage,
  str: string,
  cx: number,
  y: number,
  size: number,
  font: PDFFont,
  color = C.body
) {
  const safeStr = sanitize(str);
  if (!safeStr) return;
  const w = font.widthOfTextAtSize(safeStr, size);
  page.drawText(safeStr, { x: cx - w / 2, y, size, font, color });
}

function rect(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  fill?: ReturnType<typeof rgb>,
  stroke?: ReturnType<typeof rgb>,
  borderWidth = 0.5
) {
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    color: fill,
    borderColor: stroke,
    borderWidth: stroke ? borderWidth : 0,
  });
}

function line(
  page: PDFPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = C.border,
  thickness = 0.5
) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color, thickness });
}

// ── Header & Footer Decorators ──────────────────────────────────────────────

function drawTopHeader(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  data: ProjectReportData
) {
  const headerH = 46;
  const headerY = PH - headerH;

  // Blue / Indigo background band
  rect(page, 0, headerY, PW, headerH, C.primary);

  // Left: Company name
  txt(page, data.companyName || 'Deep Impression', ML, headerY + 16, 13, bold, C.white);

  // Center: "MONTHLY PROJECT REPORT"
  const title = 'MONTHLY PROJECT REPORT';
  txtCenter(page, title, PW / 2, headerY + 17, 10, bold, hex('#E0E7FF'));

  // Right: Month & Generated Date
  txtRight(page, data.monthLabel, PW - MR, headerY + 22, 12, bold, C.white);
  const genDateStr = `Generated: ${format(new Date(data.generatedAt || new Date()), 'dd MMM yyyy')}`;
  txtRight(page, genDateStr, PW - MR, headerY + 10, 7.5, regular, hex('#DDD6FF'));

  // Project Info Subheader Strip
  const subH = 26;
  const subY = headerY - subH;
  rect(page, 0, subY, PW, subH, C.bg, C.border);

  // Project title + description
  txt(page, data.projectName, ML, subY + 9, 10.5, bold, C.dark, 360);
  if (data.projectDescription) {
    txt(page, `—  ${data.projectDescription}`, ML + bold.widthOfTextAtSize(data.projectName, 10.5) + 8, subY + 9, 8, regular, C.muted, 300);
  }

  // Right: Generated by
  txtRight(page, `Generated by ${data.generatedBy || 'Admin'}`, PW - MR, subY + 9, 8, regular, C.muted);

  return subY - 14;
}

function drawSectionTitle(page: PDFPage, bold: PDFFont, title: string, y: number): number {
  // Left indigo accent bar
  rect(page, ML, y - 1, 3, 11, C.primary);
  txt(page, title.toUpperCase(), ML + 8, y, 9, bold, C.primary);
  return y - 12;
}

function drawFooter(
  page: PDFPage,
  regular: PDFFont,
  data: ProjectReportData,
  pageNum: number,
  totalPages: number
) {
  line(page, ML, FOOTER_Y + 12, PW - MR, FOOTER_Y + 12, C.border);
  txt(page, `${data.companyName || 'Deep Impression'}  ·  ${data.projectName}  ·  ${data.monthLabel} Report`, ML, FOOTER_Y + 2, 7.5, regular, C.muted);
  txtCenter(page, 'Confidential — For Internal Use Only', PW / 2, FOOTER_Y + 2, 7.5, regular, C.muted);
  txtRight(page, `Page ${pageNum} of ${totalPages}`, PW - MR, FOOTER_Y + 2, 7.5, regular, C.muted);
}

// ── Main PDF Generation Function ────────────────────────────────────────────

export async function generateReportPDFBlob(
  reportData: ProjectReportData
): Promise<Blob> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const oblique = await doc.embedFont(StandardFonts.HelveticaOblique);

  const pages: PDFPage[] = [];

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 1: EXECUTIVE KPI SUMMARY & TEAM CONTRIBUTION
  // ════════════════════════════════════════════════════════════════════════════
  const page1 = doc.addPage([PW, PH]);
  pages.push(page1);

  let y = drawTopHeader(page1, regular, bold, reportData);

  // ── 4 KPI Metric Summary Cards ──
  const cardW = (CW - 30) / 4;
  const cardH = 50;
  const cardY = y - cardH;

  const completionColor =
    reportData.completionRate >= 70
      ? C.green
      : reportData.completionRate >= 40
      ? C.amber
      : C.red;

  const kpis = [
    {
      num: String(reportData.totalItems ?? 0),
      label: 'TOTAL ITEMS',
      sub: `${reportData.totalTasks ?? 0} tasks · ${reportData.totalBugs ?? 0} bugs`,
      color: C.dark,
    },
    {
      num: `${reportData.completedItems ?? 0}`,
      label: 'COMPLETED ITEMS',
      sub: `${reportData.completionRate ?? 0}% completion rate`,
      color: completionColor,
    },
    {
      num: formatEffort(reportData.effortSummary?.totalActualMinutes),
      label: 'ACTUAL EFFORT',
      sub: `Est: ${formatEffort(reportData.effortSummary?.totalEstimatedMinutes)}`,
      color: C.dark,
    },
    {
      num: `${reportData.members?.length ?? 0}`,
      label: 'TEAM MEMBERS',
      sub: `${reportData.workingDaysInMonth ?? 22} working days`,
      color: C.dark,
    },
  ];

  kpis.forEach((kpi, i) => {
    const cx = ML + i * (cardW + 10);
    rect(page1, cx, cardY, cardW, cardH, C.white, C.border, 0.75);
    txt(page1, kpi.num, cx + 12, cardY + cardH - 20, 16, bold, kpi.color);
    txt(page1, kpi.label, cx + 12, cardY + cardH - 32, 7.5, bold, C.muted);
    txt(page1, kpi.sub, cx + 12, cardY + cardH - 43, 7.5, regular, C.body);
  });

  y = cardY - 18;

  // ── Section A: Team Contribution Table ──
  y = drawSectionTitle(page1, bold, 'Team Contribution', y);

  const tcColWidths = {
    emp: 180,
    dept: 100,
    assigned: 65,
    completed: 65,
    inProgress: 65,
    est: 85,
    act: 85,
    contrib: CW - (180 + 100 + 65 + 65 + 65 + 85 + 85), // ~140
  };

  const tcHeaderH = 18;
  const tcRowH = 20;

  // Header Row
  rect(page1, ML, y - tcHeaderH, CW, tcHeaderH, C.bg, C.border);
  txt(page1, 'EMPLOYEE', ML + 8, y - 12, 7.5, bold, C.muted);
  txt(page1, 'DEPARTMENT', ML + tcColWidths.emp + 8, y - 12, 7.5, bold, C.muted);
  txtCenter(page1, 'ASSIGNED', ML + tcColWidths.emp + tcColWidths.dept + tcColWidths.assigned / 2, y - 12, 7.5, bold, C.muted);
  txtCenter(page1, 'COMPLETED', ML + tcColWidths.emp + tcColWidths.dept + tcColWidths.assigned + tcColWidths.completed / 2, y - 12, 7.5, bold, C.muted);
  txtCenter(page1, 'IN PROGRESS', ML + tcColWidths.emp + tcColWidths.dept + tcColWidths.assigned + tcColWidths.completed + tcColWidths.inProgress / 2, y - 12, 7.5, bold, C.muted);
  txtRight(page1, 'EST. EFFORT', ML + tcColWidths.emp + tcColWidths.dept + tcColWidths.assigned + tcColWidths.completed + tcColWidths.inProgress + tcColWidths.est - 8, y - 12, 7.5, bold, C.muted);
  txtRight(page1, 'ACTUAL EFFORT', ML + tcColWidths.emp + tcColWidths.dept + tcColWidths.assigned + tcColWidths.completed + tcColWidths.inProgress + tcColWidths.est + tcColWidths.act - 8, y - 12, 7.5, bold, C.muted);
  txtRight(page1, 'CONTRIBUTION', ML + CW - 8, y - 12, 7.5, bold, C.muted);

  y -= tcHeaderH;

  const members = reportData.members || [];
  let totalAssigned = 0;
  let totalCompleted = 0;
  let totalInProgress = 0;

  members.forEach((m, idx) => {
    totalAssigned += m.tasksAssigned;
    totalCompleted += m.tasksCompleted;
    totalInProgress += m.tasksInProgress;

    const rowBg = idx % 2 === 1 ? C.altRow : C.white;
    rect(page1, ML, y - tcRowH, CW, tcRowH, rowBg, C.border, 0.5);

    // Employee name & designation
    txt(page1, m.name, ML + 8, y - 11, 8.5, bold, C.dark, tcColWidths.emp - 16);
    if (m.designation) {
      txt(page1, m.designation, ML + 8, y - 18, 6.5, regular, C.muted, tcColWidths.emp - 16);
    }

    // Department
    txt(page1, m.department || '—', ML + tcColWidths.emp + 8, y - 13, 7.5, regular, C.body, tcColWidths.dept - 16);

    // Assigned
    txtCenter(page1, String(m.tasksAssigned), ML + tcColWidths.emp + tcColWidths.dept + tcColWidths.assigned / 2, y - 13, 8, regular, C.body);

    // Completed
    txtCenter(
      page1,
      String(m.tasksCompleted),
      ML + tcColWidths.emp + tcColWidths.dept + tcColWidths.assigned + tcColWidths.completed / 2,
      y - 13,
      8,
      bold,
      m.tasksCompleted > 0 ? C.green : C.dark
    );

    // In Progress
    txtCenter(
      page1,
      String(m.tasksInProgress),
      ML + tcColWidths.emp + tcColWidths.dept + tcColWidths.assigned + tcColWidths.completed + tcColWidths.inProgress / 2,
      y - 13,
      8,
      regular,
      C.body
    );

    // Est Effort
    txtRight(
      page1,
      formatEffort(m.estimatedMinutes),
      ML + tcColWidths.emp + tcColWidths.dept + tcColWidths.assigned + tcColWidths.completed + tcColWidths.inProgress + tcColWidths.est - 8,
      y - 13,
      7.5,
      regular,
      C.muted
    );

    // Actual Effort
    txtRight(
      page1,
      formatEffort(m.actualMinutes),
      ML + tcColWidths.emp + tcColWidths.dept + tcColWidths.assigned + tcColWidths.completed + tcColWidths.inProgress + tcColWidths.est + tcColWidths.act - 8,
      y - 13,
      8,
      bold,
      C.dark
    );

    // Contribution % + Bar
    const pctStr = `${m.contributionPercent}%`;
    txtRight(page1, pctStr, ML + CW - 8, y - 13, 8, bold, C.primary);

    // Mini progress bar
    const barW = 45;
    const barX = ML + CW - 8 - bold.widthOfTextAtSize(pctStr, 8) - barW - 8;
    rect(page1, barX, y - 14, barW, 4, C.border);
    const fillW = Math.min(barW, Math.max(2, (m.contributionPercent / 100) * barW));
    rect(page1, barX, y - 14, fillW, 4, C.primary);

    y -= tcRowH;
  });

  // Table Footer / Summary Row
  rect(page1, ML, y - tcHeaderH, CW, tcHeaderH, C.primaryLight, C.primaryBorder);
  txt(page1, 'TOTAL', ML + 8, y - 12, 8, bold, C.primaryDark);
  txtCenter(page1, String(totalAssigned), ML + tcColWidths.emp + tcColWidths.dept + tcColWidths.assigned / 2, y - 12, 8, bold, C.primaryDark);
  txtCenter(page1, String(totalCompleted), ML + tcColWidths.emp + tcColWidths.dept + tcColWidths.assigned + tcColWidths.completed / 2, y - 12, 8, bold, C.green);
  txtCenter(page1, String(totalInProgress), ML + tcColWidths.emp + tcColWidths.dept + tcColWidths.assigned + tcColWidths.completed + tcColWidths.inProgress / 2, y - 12, 8, bold, C.primaryDark);
  txtRight(page1, formatEffort(reportData.effortSummary?.totalEstimatedMinutes), ML + tcColWidths.emp + tcColWidths.dept + tcColWidths.assigned + tcColWidths.completed + tcColWidths.inProgress + tcColWidths.est - 8, y - 12, 8, bold, C.primaryDark);
  txtRight(page1, formatEffort(reportData.effortSummary?.totalActualMinutes), ML + tcColWidths.emp + tcColWidths.dept + tcColWidths.assigned + tcColWidths.completed + tcColWidths.inProgress + tcColWidths.est + tcColWidths.act - 8, y - 12, 8, bold, C.primaryDark);
  txtRight(page1, '100%', ML + CW - 8, y - 12, 8, bold, C.primaryDark);

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 2+: TASK TIMELINE (Auto-Paginated)
  // ════════════════════════════════════════════════════════════════════════════
  const tasks = reportData.tasks || [];
  const taskRowH = 17;
  const taskHeaderH = 18;
  const maxTasksPerPage = 20;

  const taskChunks: ReportTask[][] = [];
  if (tasks.length === 0) {
    taskChunks.push([]);
  } else {
    for (let i = 0; i < tasks.length; i += maxTasksPerPage) {
      taskChunks.push(tasks.slice(i, i + maxTasksPerPage));
    }
  }

  const ttCols = {
    id: 60,
    title: 175,
    type: 48,
    prio: 45,
    assignee: 90,
    est: 55,
    act: 55,
    start: 75,
    end: 75,
    compDate: 60,
    moves: CW - (60 + 175 + 48 + 45 + 90 + 55 + 55 + 75 + 75 + 60), // ~47
  };

  taskChunks.forEach((chunk, pageIdx) => {
    const pageT = doc.addPage([PW, PH]);
    pages.push(pageT);

    let ty = drawTopHeader(pageT, regular, bold, reportData);
    const subTitle = taskChunks.length > 1 ? `Task Timeline (Part ${pageIdx + 1} of ${taskChunks.length})` : 'Task Timeline';
    ty = drawSectionTitle(pageT, bold, subTitle, ty);

    // Header Row
    rect(pageT, ML, ty - taskHeaderH, CW, taskHeaderH, C.bg, C.border);
    txt(pageT, 'TASK ID', ML + 6, ty - 12, 7, bold, C.muted);
    txt(pageT, 'TITLE', ML + ttCols.id + 6, ty - 12, 7, bold, C.muted);
    txt(pageT, 'TYPE', ML + ttCols.id + ttCols.title + 6, ty - 12, 7, bold, C.muted);
    txt(pageT, 'PRIORITY', ML + ttCols.id + ttCols.title + ttCols.type + 6, ty - 12, 7, bold, C.muted);
    txt(pageT, 'ASSIGNEE', ML + ttCols.id + ttCols.title + ttCols.type + ttCols.prio + 6, ty - 12, 7, bold, C.muted);
    txtRight(pageT, 'EST.', ML + ttCols.id + ttCols.title + ttCols.type + ttCols.prio + ttCols.assignee + ttCols.est - 6, ty - 12, 7, bold, C.muted);
    txtRight(pageT, 'ACTUAL', ML + ttCols.id + ttCols.title + ttCols.type + ttCols.prio + ttCols.assignee + ttCols.est + ttCols.act - 6, ty - 12, 7, bold, C.muted);
    txt(pageT, 'STAGE START', ML + ttCols.id + ttCols.title + ttCols.type + ttCols.prio + ttCols.assignee + ttCols.est + ttCols.act + 6, ty - 12, 7, bold, C.muted);
    txt(pageT, 'STAGE END', ML + ttCols.id + ttCols.title + ttCols.type + ttCols.prio + ttCols.assignee + ttCols.est + ttCols.act + ttCols.start + 6, ty - 12, 7, bold, C.muted);
    txt(pageT, 'COMPLETED', ML + ttCols.id + ttCols.title + ttCols.type + ttCols.prio + ttCols.assignee + ttCols.est + ttCols.act + ttCols.start + ttCols.end + 6, ty - 12, 7, bold, C.muted);
    txtRight(pageT, 'MOVES', ML + CW - 6, ty - 12, 7, bold, C.muted);

    ty -= taskHeaderH;

    if (chunk.length === 0) {
      rect(pageT, ML, ty - 30, CW, 30, C.white, C.border);
      txtCenter(pageT, 'No tasks were active in this month period.', PW / 2, ty - 18, 8.5, oblique, C.muted);
    } else {
      chunk.forEach((t, i) => {
        const rowBg = i % 2 === 1 ? C.altRow : C.white;
        rect(pageT, ML, ty - taskRowH, CW, taskRowH, rowBg, C.border, 0.5);

        // Left accent indicator for completion / creation
        if (t.wasCompletedThisMonth) {
          rect(pageT, ML, ty - taskRowH, 3, taskRowH, C.green);
        } else if (t.wasCreatedThisMonth) {
          rect(pageT, ML, ty - taskRowH, 3, taskRowH, C.blue);
        }

        // Task ID
        txt(pageT, t.taskId, ML + 6, ty - 11, 7, bold, C.dark);

        // Title
        txt(pageT, t.title, ML + ttCols.id + 6, ty - 11, 7.5, regular, C.body, ttCols.title - 12);

        // Type
        const isBug = t.itemType === 'BUG';
        txt(pageT, isBug ? 'Bug' : 'Task', ML + ttCols.id + ttCols.title + 6, ty - 11, 7, bold, isBug ? C.red : C.body);

        // Priority
        const prioColor = getPriorityColor(t.priority);
        txt(pageT, t.priority, ML + ttCols.id + ttCols.title + ttCols.type + 6, ty - 11, 7, bold, prioColor);

        // Assignee
        txt(pageT, t.assignee?.name || 'Unassigned', ML + ttCols.id + ttCols.title + ttCols.type + ttCols.prio + 6, ty - 11, 7, regular, C.body, ttCols.assignee - 10);

        // Est Effort
        txtRight(pageT, formatEffort(t.estimatedMinutes), ML + ttCols.id + ttCols.title + ttCols.type + ttCols.prio + ttCols.assignee + ttCols.est - 6, ty - 11, 7, regular, C.muted);

        // Actual Effort
        txtRight(pageT, t.actualMinutes ? formatEffort(t.actualMinutes) : '—', ML + ttCols.id + ttCols.title + ttCols.type + ttCols.prio + ttCols.assignee + ttCols.est + ttCols.act - 6, ty - 11, 7, bold, C.dark);

        // Stage Start
        txt(pageT, t.startStage || '—', ML + ttCols.id + ttCols.title + ttCols.type + ttCols.prio + ttCols.assignee + ttCols.est + ttCols.act + 6, ty - 11, 7, regular, C.muted, ttCols.start - 8);

        // Stage End
        txt(pageT, t.endStage || '—', ML + ttCols.id + ttCols.title + ttCols.type + ttCols.prio + ttCols.assignee + ttCols.est + ttCols.act + ttCols.start + 6, ty - 11, 7, bold, C.dark, ttCols.end - 8);

        // Completed Date
        const compDateStr = t.completedAt ? format(new Date(t.completedAt), 'dd MMM') : '—';
        txt(pageT, compDateStr, ML + ttCols.id + ttCols.title + ttCols.type + ttCols.prio + ttCols.assignee + ttCols.est + ttCols.act + ttCols.start + ttCols.end + 6, ty - 11, 7, regular, C.muted);

        // Moves
        const movesStr = t.stageTransitions?.length ? `${t.stageTransitions.length} moves` : '—';
        txtRight(pageT, movesStr, ML + CW - 6, ty - 11, 7, regular, C.muted);

        ty -= taskRowH;
      });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE: STAGE BREAKDOWN, BUG SUMMARY & EFFORT ANALYSIS
  // ════════════════════════════════════════════════════════════════════════════
  const pageAnalytics = doc.addPage([PW, PH]);
  pages.push(pageAnalytics);

  let ay = drawTopHeader(pageAnalytics, regular, bold, reportData);

  // ── Top Row: Stage Breakdown & Bug Summary (2 columns) ──
  const halfColW = (CW - 16) / 2;
  const topBlockH = 150;

  // Left Column: Stage Breakdown
  drawSectionTitle(pageAnalytics, bold, 'Stage Breakdown (End of Month)', ay);
  const stageBoxY = ay - topBlockH;
  rect(pageAnalytics, ML, stageBoxY, halfColW, topBlockH - 14, C.bg, C.border);

  const stages = reportData.stageBreakdown || [];
  const maxStageCount = Math.max(...stages.map((s) => s.totalItems), 1);
  let sy = ay - 24;

  stages.forEach((s) => {
    txt(pageAnalytics, s.stageName, ML + 10, sy - 8, 7.5, bold, C.body, 90);
    const barAreaW = halfColW - 160;
    const barX = ML + 105;
    rect(pageAnalytics, barX, sy - 9, barAreaW, 6, C.border);
    const barFillW = Math.max(4, Math.round((s.totalItems / maxStageCount) * barAreaW));
    const stageBarColor = s.stageColor ? hex(s.stageColor) : C.primary;
    rect(pageAnalytics, barX, sy - 9, barFillW, 6, stageBarColor);
    txtRight(pageAnalytics, `${s.totalItems} items`, ML + halfColW - 10, sy - 8, 7.5, bold, C.dark);
    sy -= 16;
  });

  // Right Column: Bug Summary
  const rightColX = ML + halfColW + 16;
  drawSectionTitle(pageAnalytics, bold, 'Bug Analytics', ay);
  const bugSummary = reportData.bugSummary;

  rect(pageAnalytics, rightColX, stageBoxY, halfColW, topBlockH - 14, C.bg, C.border);

  if (bugSummary) {
    const bugSubW = (halfColW - 20) / 2;
    let by = ay - 26;

    // Sub-col 1
    const bugMetrics = [
      { label: 'Reported this month', val: String(bugSummary.totalReported), color: C.dark },
      { label: 'Fixed this month', val: String(bugSummary.totalFixed), color: C.green },
      { label: 'Verified', val: String(bugSummary.totalVerified), color: C.dark },
      { label: 'Reopened', val: String(bugSummary.totalReopened), color: bugSummary.totalReopened > 0 ? C.red : C.dark },
    ];

    bugMetrics.forEach((bm) => {
      txt(pageAnalytics, bm.label, rightColX + 10, by - 8, 7.5, regular, C.body);
      txtRight(pageAnalytics, bm.val, rightColX + bugSubW, by - 8, 7.5, bold, bm.color);
      line(pageAnalytics, rightColX + 10, by - 12, rightColX + bugSubW, by - 12, C.border);
      by -= 22;
    });

    // Sub-col 2 (Severities)
    let by2 = ay - 26;
    const sevMetrics = [
      { label: 'Critical', val: String(bugSummary.criticalCount), color: C.red },
      { label: 'High', val: String(bugSummary.highCount), color: C.amber },
      { label: 'Medium', val: String(bugSummary.mediumCount), color: C.yellow },
      { label: 'Avg Time to Fix', val: bugSummary.avgTimeToFix ? formatEffort(bugSummary.avgTimeToFix) : 'N/A', color: C.dark },
    ];

    sevMetrics.forEach((sm) => {
      txt(pageAnalytics, sm.label, rightColX + bugSubW + 15, by2 - 8, 7.5, regular, C.body);
      txtRight(pageAnalytics, sm.val, rightColX + halfColW - 10, by2 - 8, 7.5, bold, sm.color);
      line(pageAnalytics, rightColX + bugSubW + 15, by2 - 12, rightColX + halfColW - 10, by2 - 12, C.border);
      by2 -= 22;
    });
  } else {
    txtCenter(pageAnalytics, 'No bug tracking data recorded for this month.', rightColX + halfColW / 2, stageBoxY + (topBlockH - 14) / 2, 8, oblique, C.muted);
  }

  // ── Bottom Row: Effort Analysis (3 blocks) ──
  const effortY = stageBoxY - 20;
  drawSectionTitle(pageAnalytics, bold, 'Effort & Variance Analysis', effortY);

  const effortBoxY = effortY - 140;
  const effortBoxH = 125;
  const effSummary = reportData.effortSummary;

  const effCol1W = 180;
  const effCol3W = 160;
  const effCol2W = CW - effCol1W - effCol3W - 24;

  // Block 1: Totals & Variance
  rect(pageAnalytics, ML, effortBoxY, effCol1W, effortBoxH, C.bg, C.border);
  txt(pageAnalytics, 'ESTIMATED TOTAL', ML + 12, effortBoxY + effortBoxH - 18, 7.5, bold, C.muted);
  txt(pageAnalytics, formatEffort(effSummary?.totalEstimatedMinutes), ML + 12, effortBoxY + effortBoxH - 32, 12, bold, C.muted);

  txt(pageAnalytics, 'ACTUAL TOTAL', ML + 12, effortBoxY + effortBoxH - 52, 7.5, bold, C.muted);
  txt(pageAnalytics, formatEffort(effSummary?.totalActualMinutes), ML + 12, effortBoxY + effortBoxH - 68, 14, bold, C.dark);

  txt(pageAnalytics, 'EFFORT VARIANCE', ML + 12, effortBoxY + effortBoxH - 88, 7.5, bold, C.muted);
  const varMins = effSummary?.varianceMinutes ?? 0;
  const varPct = effSummary?.variancePercent ?? 0;
  const varSign = varMins > 0 ? '+' : '';
  const varColor = varMins > 0 ? C.red : C.green;
  txt(pageAnalytics, `${varSign}${formatEffort(varMins)} (${varSign}${varPct}%)`, ML + 12, effortBoxY + effortBoxH - 104, 11, bold, varColor);

  // Block 2: Per-Member Effort Table
  const effCol2X = ML + effCol1W + 12;
  rect(pageAnalytics, effCol2X, effortBoxY, effCol2W, effortBoxH, C.bg, C.border);
  txt(pageAnalytics, 'TOP MEMBER EFFORTS', effCol2X + 10, effortBoxY + effortBoxH - 15, 7.5, bold, C.muted);

  let memEffY = effortBoxY + effortBoxH - 30;
  const topMemberEfforts = effSummary?.memberEffort?.slice(0, 5) || [];
  topMemberEfforts.forEach((me) => {
    txt(pageAnalytics, me.name, effCol2X + 10, memEffY, 7.5, bold, C.dark, 100);
    txt(pageAnalytics, `Est: ${formatEffort(me.estimatedMinutes)}`, effCol2X + 120, memEffY, 7.5, regular, C.muted);
    txt(pageAnalytics, `Act: ${formatEffort(me.actualMinutes)}`, effCol2X + 190, memEffY, 7.5, bold, C.dark);
    const diff = me.actualMinutes - me.estimatedMinutes;
    const diffSign = diff > 0 ? '+' : '';
    const diffColor = diff > 0 ? C.red : C.green;
    txtRight(pageAnalytics, `${diffSign}${formatEffort(diff)}`, effCol2X + effCol2W - 10, memEffY, 7.5, bold, diffColor);
    line(pageAnalytics, effCol2X + 10, memEffY - 4, effCol2X + effCol2W - 10, memEffY - 4, C.border);
    memEffY - 18;
    memEffY -= 18;
  });

  // Block 3: Completion Gauge Box
  const effCol3X = effCol2X + effCol2W + 12;
  rect(pageAnalytics, effCol3X, effortBoxY, effCol3W, effortBoxH, C.bg, C.border);
  txtCenter(pageAnalytics, 'PROJECT COMPLETION', effCol3X + effCol3W / 2, effortBoxY + effortBoxH - 20, 8, bold, C.muted);
  txtCenter(pageAnalytics, `${reportData.completionRate ?? 0}%`, effCol3X + effCol3W / 2, effortBoxY + effortBoxH - 55, 24, bold, completionColor);
  txtCenter(pageAnalytics, `${reportData.completedItems ?? 0} of ${reportData.totalItems ?? 0} items completed`, effCol3X + effCol3W / 2, effortBoxY + effortBoxH - 75, 7.5, regular, C.body);
  txtCenter(pageAnalytics, `${reportData.members?.length ?? 0} active contributors`, effCol3X + effCol3W / 2, effortBoxY + effortBoxH - 90, 7.5, regular, C.muted);

  // ════════════════════════════════════════════════════════════════════════════
  // OPTIONAL PAGE: ADMIN EXECUTIVE NOTES
  // ════════════════════════════════════════════════════════════════════════════
  if (reportData.adminNotes && reportData.adminNotes.trim().length > 0) {
    const pageNotes = doc.addPage([PW, PH]);
    pages.push(pageNotes);

    let ny = drawTopHeader(pageNotes, regular, bold, reportData);
    ny = drawSectionTitle(pageNotes, bold, 'Executive Notes & Comments', ny);

    const notesH = 220;
    const notesY = ny - notesH;
    rect(pageNotes, ML, notesY, CW, notesH, C.bg, C.border);

    // Left decorative bar
    rect(pageNotes, ML, notesY, 4, notesH, C.primary);

    // Multi-line note text
    const noteLines = reportData.adminNotes.split('\n');
    let lineY = ny - 24;
    noteLines.forEach((nl) => {
      txt(pageNotes, nl, ML + 18, lineY, 9, regular, C.dark, CW - 36);
      lineY -= 14;
    });

    txt(
      pageNotes,
      `— Prepared by ${reportData.generatedBy || 'Admin'}, ${format(new Date(reportData.generatedAt || new Date()), 'dd MMMM yyyy')}`,
      ML + 18,
      notesY + 16,
      8,
      oblique,
      C.muted
    );
  }

  // ── Draw Footer on all pages ──
  const totalPages = pages.length;
  pages.forEach((p, idx) => {
    drawFooter(p, regular, reportData, idx + 1, totalPages);
  });

  const pdfBytes = await doc.save();
  return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}
