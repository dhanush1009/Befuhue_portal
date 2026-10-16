import type { Role } from '@/types/auth';

export const can = {
  // Attendance
  viewOwnAttendance:   (_role: Role) => true,
  viewAllAttendance:   (role: Role)  => role === 'ADMIN',
  viewTeamAttendance:  (role: Role)  => role === 'ADMIN',

  // Leaves
  applyLeave:          (_role: Role) => true,
  approveLeave:        (role: Role)  => role === 'ADMIN',
  viewAllLeaves:       (role: Role)  => role === 'ADMIN',
  viewOwnLeaves:       (_role: Role) => true,

  // Tasks
  createTask:          (_role: Role) => true,
  assignTask:          (_role: Role) => true,
  deleteTask:          (role: Role)  => role === 'ADMIN',
  viewAllTasks:        (role: Role)  => role === 'ADMIN',
  createProject:       (role: Role)  => role === 'ADMIN',
  deleteProject:       (role: Role)  => role === 'ADMIN',

  // Employees
  viewDirectory:       (_role: Role) => true,
  viewOwnProfile:      (_role: Role) => true,
  viewOtherProfile:    (_role: Role) => true,
  editOwnProfile:      (_role: Role) => true,
  editAnyProfile:      (role: Role)  => role === 'ADMIN',
  onboardEmployee:     (role: Role)  => role === 'ADMIN',
  deactivateEmployee:  (role: Role)  => role === 'ADMIN',
  resetPassword:       (role: Role)  => role === 'ADMIN',
  changeRole:          (role: Role)  => role === 'ADMIN',

  // Communication
  viewAnnouncements:   (_role: Role) => true,
  createAnnouncement:  (role: Role)  => role === 'ADMIN',
  createPoll:          (role: Role)  => role === 'ADMIN',
  editWiki:            (role: Role)  => role === 'ADMIN',

  // Settings
  viewCompanySettings: (role: Role)  => role === 'ADMIN',
  editCompanySettings: (role: Role)  => role === 'ADMIN',

  // Approvals
  viewApprovals:       (role: Role)  => role === 'ADMIN',

  // Payroll
  viewOwnPayslips:     (_role: Role) => true,
  viewAllPayslips:     (role: Role)  => role === 'ADMIN',
  manageSalary:        (role: Role)  => role === 'ADMIN',
  runPayroll:          (role: Role)  => role === 'ADMIN',
  publishPayslip:      (role: Role)  => role === 'ADMIN',
};
