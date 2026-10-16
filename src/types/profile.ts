import type { Role, LeaveType, LeaveStatus, TaskStatus, Priority } from '@prisma/client';

export interface LeaveBalanceEntry {
  type:      string;
  allowance: number;
  used:      number;
  remaining: number;
}

export interface AttendanceSummary {
  present: number;
  wfh:     number;
  halfDay: number;
  total:   number;
}

export interface RecentTask {
  id:       string;
  humanId:  string;
  title:    string;
  status:   TaskStatus;
  priority: Priority;
  dueDate:  string | null;
  project:  { id: string; name: string; prefix: string } | null;
}

export interface RecentLeave {
  id:       string;
  type:     LeaveType;
  fromDate: string;
  toDate:   string;
  days:     number;
  status:   LeaveStatus;
}

export interface MyProfile {
  id:                       string;
  email:                    string;
  name:                     string;
  role:                     Role;
  department:               string | null;
  designation:              string | null;
  phone:                    string | null;
  avatarUrl:                string | null;
  managerId:                string | null;
  isActive:                 boolean;
  employmentType:           string | null;
  fatherName:               string | null;
  motherName:               string | null;
  parentsPhone:             string | null;
  bondCertificateSubmitted: boolean;
  createdAt:                string;
  joiningDate:              string | null;
  passwordChangedAt:        string | null;
  passwordSetBy:            string | null;
  mustChangePasswordOnLogin: boolean;
  manager: {
    id:          string;
    name:        string;
    avatarUrl:   string | null;
    designation: string | null;
  } | null;
  reports: {
    id:          string;
    name:        string;
    avatarUrl:   string | null;
    designation: string | null;
    department:  string | null;
  }[];
  _count:             { leaves: number; tasks: number };
  leaveBalances:      LeaveBalanceEntry[];
  attendanceSummary:  AttendanceSummary;
  detailsPercent:     number;
  isClockedIn:        boolean;
  isOnLeave:          boolean;
  recentTasks:        RecentTask[];
  recentLeaves:       RecentLeave[];
}
