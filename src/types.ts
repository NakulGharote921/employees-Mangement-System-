export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  departmentId: string;
  positionId: string;
  salary: number;
  hireDate: string;
  status: 'active' | 'inactive' | 'on-leave';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  managerId?: string;
  createdBy: string;
}

export interface Position {
  id: string;
  title: string;
  departmentId: string;
  baseSalary?: number;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: 'sick' | 'vacation' | 'personal' | 'maternity' | 'paternity';
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  approvedBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Payroll {
  id: string;
  employeeId: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  status: 'pending' | 'processed' | 'failed';
  paidAt?: string;
  notes?: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}
