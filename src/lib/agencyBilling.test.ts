import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  generateProjectBillingExcelBuffer,
  generateAgencyAllProjectsExcelBuffer,
} from './billingExcel';

describe('Agency & Project Excel Generation', () => {
  it('generates a valid Excel workbook for a single project billing statement', async () => {
    const sampleProjectData = {
      agencyName: 'Yucel hub',
      projectName: 'Simco',
      clientName: 'Rohan',
      totalTasks: 2,
      completedTasks: 2,
      totalBilling: 1000,
      tasks: [
        {
          humanId: 'SIMCO-001',
          title: 'Karunyan Task',
          assigneeName: 'Karunyan',
          assignedDate: '2026-10-15T10:00:00.000Z',
          dueDate: '2026-10-16T18:00:00.000Z',
          status: 'CLOSED',
          amount: 500,
        },
        {
          humanId: 'SIMCO-002',
          title: 'Gokul Task',
          assigneeName: 'Gokul prasath',
          assignedDate: '2026-10-15T11:00:00.000Z',
          dueDate: '2026-10-16T18:00:00.000Z',
          status: 'DONE',
          amount: 500,
        },
      ],
    };

    const buffer = await generateProjectBillingExcelBuffer(sampleProjectData);
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(1000);

    // Read back and verify with ExcelJS
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.getWorksheet('Project Billing Statement');
    expect(worksheet).toBeDefined();

    // Check title banner
    expect(worksheet!.getCell('A1').value).toContain('PROJECT BILLING STATEMENT');

    // Check agency and project metadata
    expect(worksheet!.getCell('B3').value).toBe('Yucel hub');
    expect(worksheet!.getCell('F3').value).toBe('Simco');
    expect(worksheet!.getCell('B4').value).toBe('Rohan');
    expect(worksheet!.getCell('F6').value).toBe(1000);

    // Check task rows
    expect(worksheet!.getCell('A9').value).toBe('SIMCO-001');
    expect(worksheet!.getCell('B9').value).toBe('Karunyan Task');
    expect(worksheet!.getCell('C9').value).toBe('Rohan');
    expect(worksheet!.getCell('D9').value).toBe('Yucel hub');
    expect(worksheet!.getCell('E9').value).toBe('Simco');
    expect(worksheet!.getCell('F9').value).toBe('Karunyan');
    expect(worksheet!.getCell('J9').value).toBe(500);

    expect(worksheet!.getCell('A10').value).toBe('SIMCO-002');
    expect(worksheet!.getCell('J10').value).toBe(500);

    // Check total row
    expect(worksheet!.getCell('A11').value).toBe('TOTAL SUMMARY');
    expect(worksheet!.getCell('J11').value).toBe(1000);
  });

  it('generates a valid consolidated Excel workbook for all projects under an agency', async () => {
    const sampleAgencyData = {
      agency: {
        id: 'agency_Yucel%20hub',
        name: 'Yucel hub',
        totalProjects: 2,
        totalTasks: 3,
        completedTasks: 3,
        totalBilling: 1500,
      },
      projects: [
        {
          project: {
            id: 'proj_1',
            name: 'Simco',
            prefix: 'SIMCO',
            clientName: 'Rohan',
            status: 'ACTIVE',
          },
          tasks: [
            {
              humanId: 'SIMCO-001',
              title: 'Task A',
              assigneeName: 'User A',
              assignedDate: '2026-10-15T10:00:00.000Z',
              dueDate: null,
              status: 'DONE',
              amount: 500,
            },
            {
              humanId: 'SIMCO-002',
              title: 'Task B',
              assigneeName: 'User B',
              assignedDate: '2026-10-15T11:00:00.000Z',
              dueDate: null,
              status: 'CLOSED',
              amount: 500,
            },
          ],
          totalBilling: 1000,
        },
        {
          project: {
            id: 'proj_2',
            name: 'Portal Redesign',
            prefix: 'PR',
            clientName: 'Acme',
            status: 'ACTIVE',
          },
          tasks: [
            {
              humanId: 'PR-001',
              title: 'Design Task',
              assigneeName: 'User C',
              assignedDate: '2026-10-15T12:00:00.000Z',
              dueDate: null,
              status: 'VERIFIED',
              amount: 500,
            },
          ],
          totalBilling: 500,
        },
      ],
    };

    const buffer = await generateAgencyAllProjectsExcelBuffer(sampleAgencyData);
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(1000);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.getWorksheet('Agency Consolidated Billing');
    expect(worksheet).toBeDefined();

    expect(worksheet!.getCell('A1').value).toContain('CONSOLIDATED AGENCY BILLING REPORT');
    expect(worksheet!.getCell('B3').value).toBe('Yucel hub');
    expect(worksheet!.getCell('B4').value).toBe(2);
    expect(worksheet!.getCell('E4').value).toBe(3);
    expect(worksheet!.getCell('E5').value).toBe(1500);
  });

  it('separates clients under an agency from standalone direct clients', async () => {
    const { getAllAgencies, getAgencyProjects } = await import('./agencyBillingService');
    const all = await getAllAgencies();

    // Verify Yucel hub is an agency card
    const yucelHub = all.find((a) => a.name === 'Yucel hub');
    expect(yucelHub).toBeDefined();
    expect(yucelHub?.clientType).toBe('AGENCY');

    // Verify Rohan and javelian tiger (which come under Yucel hub) are NOT in the top-level list
    const rohan = all.find((a) => a.name === 'Rohan');
    const javelian = all.find((a) => a.name === 'javelian tiger');
    expect(rohan).toBeUndefined();
    expect(javelian).toBeUndefined();

    // Verify Acme Corp (separate client) shows individually
    const acme = all.find((a) => a.name === 'Acme Corp');
    expect(acme).toBeDefined();
    expect(acme?.clientType).toBe('CLIENT');

    // Verify clicking into Yucel hub displays the clients under that agency
    if (yucelHub) {
      const details = await getAgencyProjects(yucelHub.id);
      expect(details).toBeDefined();
      const clientNames = details?.projects.map((p) => p.clientName);
      expect(clientNames).toContain('Rohan');
      expect(clientNames).toContain('javelian tiger');
    }
  }, 15000);
});

