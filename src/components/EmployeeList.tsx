import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  getDocs, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp, 
  onSnapshot,
  orderBy 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Employee, Department, OperationType } from '../types';
import { handleFirestoreError } from '../lib/utils';
import { Plus, Filter, MoreHorizontal, Mail, Phone, Calendar, Search, Users, AlertCircle, Edit2, Trash2, Database, X, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { cn } from '../lib/utils';

const employeeSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  departmentId: z.string().min(1, 'Department is required'),
  positionId: z.string().min(1, 'Position is required'),
  salary: z.number().min(0, 'Salary must be positive'),
  status: z.enum(['active', 'inactive', 'on-leave']),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

export function EmployeeList() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Employee | 'fullName'; direction: 'asc' | 'desc' }>({
    key: 'createdAt',
    direction: 'desc'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      status: 'active',
      salary: 0
    }
  });

  useEffect(() => {
    // Sync Employees
    const qEmp = query(collection(db, 'employees'), orderBy('createdAt', 'desc'));
    const unsubscribeEmp = onSnapshot(qEmp, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(docs);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error('Employees sync error:', err);
      setError('Permission denied. Ensure your email is verified.');
      setLoading(false);
    });

    // Sync Departments for the dropdown
    const qDept = query(collection(db, 'departments'), orderBy('name', 'asc'));
    const unsubscribeDept = onSnapshot(qDept, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department));
      setDepartments(docs);
    }, (err) => {
      console.error('Departments dropdown sync error:', err);
    });

    return () => {
      unsubscribeEmp();
      unsubscribeDept();
    };
  }, []);

  const handleAdd = () => {
    setEditingEmployee(null);
    reset({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      departmentId: '',
      positionId: '',
      salary: 0,
      status: 'active',
    });
    setIsModalOpen(true);
  };

  const handleEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    reset({
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      phone: emp.phone || '',
      departmentId: emp.departmentId,
      positionId: emp.positionId,
      salary: emp.salary,
      status: emp.status,
    });
    setIsModalOpen(true);
    setOpenMenuId(null);
  };

  const handleDeleteClick = (emp: Employee) => {
    setEmployeeToDelete(emp);
    setOpenMenuId(null);
  };

  const confirmDelete = async () => {
    if (!employeeToDelete) return;
    
    try {
      await deleteDoc(doc(db, 'employees', employeeToDelete.id));
      setEmployeeToDelete(null);
      alert('Employee deleted successfully.');
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete employee: Permission denied or connection issue.');
      handleFirestoreError(err, OperationType.DELETE, `employees/${employeeToDelete.id}`);
    }
  };

  const onSubmit = async (data: EmployeeFormData) => {
    try {
      if (editingEmployee) {
        const empRef = doc(db, 'employees', editingEmployee.id);
        await updateDoc(empRef, {
          ...data,
          updatedAt: serverTimestamp(),
        });
        alert('Employee updated successfully.');
      } else {
        await addDoc(collection(db, 'employees'), {
          ...data,
          createdBy: auth.currentUser?.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          hireDate: new Date().toISOString(),
        });
        alert('Employee created successfully.');
      }
      setIsModalOpen(false);
      setEditingEmployee(null);
      reset();
    } catch (error) {
      console.error('Submit error:', error);
      alert('Failed to save changes. Please try again.');
      handleFirestoreError(error, editingEmployee ? OperationType.UPDATE : OperationType.CREATE, 'employees');
    }
  };

  const handleSort = (key: keyof Employee | 'fullName') => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const filteredEmployees = employees.filter(emp => {
    const searchStr = `${emp.firstName} ${emp.lastName} ${emp.email} ${emp.id}`.toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  });

  const sortedEmployees = [...filteredEmployees].sort((a, b) => {
    let aVal: any = a[sortConfig.key as keyof Employee];
    let bVal: any = b[sortConfig.key as keyof Employee];

    if (sortConfig.key === 'fullName') {
      aVal = `${a.firstName} ${a.lastName}`.toLowerCase();
      bVal = `${b.firstName} ${b.lastName}`.toLowerCase();
    } else if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Employees</h2>
          <p className="text-gray-500 font-medium mt-1">Manage and organize your team members.</p>
        </div>
        <button
          onClick={handleAdd}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg shadow-indigo-100"
        >
          <Plus className="w-5 h-5" />
          Add Employee
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between gap-4 bg-gray-50/50">
          <div className="flex items-center gap-4 flex-1">
            <div className="bg-white border border-gray-200 px-4 py-2 rounded-xl flex items-center gap-3 w-full max-w-md shadow-xs focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
              <Search className="w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search by name, email, or ID..." 
                className="bg-transparent border-none focus:ring-0 text-sm w-full outline-hidden"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-xs">
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th 
                  className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest leading-none cursor-pointer hover:text-indigo-600 transition-colors"
                  onClick={() => handleSort('fullName')}
                >
                  <div className="flex items-center gap-2">
                    Employee
                    {sortConfig.key === 'fullName' && (
                       <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest leading-none cursor-pointer hover:text-indigo-600 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-2">
                    Status
                    {sortConfig.key === 'status' && (
                       <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest leading-none cursor-pointer hover:text-indigo-600 transition-colors"
                  onClick={() => handleSort('departmentId')}
                >
                  <div className="flex items-center gap-2">
                    Department
                    {sortConfig.key === 'departmentId' && (
                       <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest leading-none">Contact</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest leading-none text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">Loading team members...</td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-red-500 font-bold bg-red-50">
                    <div className="flex flex-col items-center gap-2">
                       <AlertCircle className="w-8 h-8" />
                       <p>{error}</p>
                    </div>
                  </td>
                </tr>
              ) : sortedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="w-8 h-8 text-gray-300" />
                      <p className="text-gray-500">No employees found.</p>
                      <button onClick={() => setIsModalOpen(true)} className="text-indigo-600 text-sm font-semibold hover:underline">Add your first employee</button>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold group-hover:scale-110 transition-transform">
                          {emp.firstName[0]}{emp.lastName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 leading-none mb-1">{emp.firstName} {emp.lastName}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{emp.positionId}</p>
                            <span className="w-1 h-1 rounded-full bg-gray-300" />
                            <p className="text-[10px] font-mono text-gray-400">ID: {emp.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ring-1 ring-inset whitespace-nowrap uppercase tracking-tighter",
                        emp.status === 'active' ? "bg-green-50 text-green-700 ring-green-600/20" :
                        emp.status === 'on-leave' ? "bg-orange-50 text-orange-700 ring-orange-600/20" :
                        "bg-gray-50 text-gray-700 ring-gray-600/20"
                      )}>
                        {emp.status.replace('-', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 font-medium">{emp.departmentId}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2 min-w-[220px]">
                        <div className="flex items-center justify-between group/contact">
                          <a 
                            href={`mailto:${emp.email}`}
                            className="flex items-center gap-2.5 text-[11px] font-bold text-gray-700 hover:text-indigo-600 transition-all group/link"
                          >
                            <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center group-hover/link:bg-indigo-50 border border-gray-100 group-hover/link:border-indigo-100 transition-all">
                              <Mail className="w-3.5 h-3.5 text-gray-400 group-hover/link:text-indigo-500" />
                            </div>
                            <span className="truncate max-w-[140px]">{emp.email}</span>
                          </a>
                          <button 
                            onClick={() => handleCopy(emp.email)}
                            className="p-1.5 opacity-0 group-hover/contact:opacity-100 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"
                            title="Copy Email"
                          >
                            {copiedText === emp.email ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>

                        {emp.phone && (
                          <div className="flex items-center justify-between group/contact">
                            <a 
                              href={`tel:${emp.phone}`}
                              className="flex items-center gap-2.5 text-[11px] font-bold text-gray-700 hover:text-indigo-600 transition-all group/link"
                            >
                              <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center group-hover/link:bg-indigo-50 border border-gray-100 group-hover/link:border-indigo-100 transition-all">
                                <Phone className="w-3.5 h-3.5 text-gray-400 group-hover/link:text-indigo-500" />
                              </div>
                              <span>{emp.phone}</span>
                            </a>
                            <button 
                              onClick={() => handleCopy(emp.phone || '')}
                              className="p-1.5 opacity-0 group-hover/contact:opacity-100 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"
                              title="Copy Phone"
                            >
                              {copiedText === emp.phone ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative inline-block text-left">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => setViewingEmployee(emp)}
                            className="px-3 py-1.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1.5 uppercase tracking-widest"
                          >
                            <Database className="w-3 h-3" />
                            Details
                          </button>
                          <button 
                            onClick={() => setOpenMenuId(openMenuId === emp.id ? null : emp.id)}
                            className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <MoreHorizontal className="w-5 h-5" />
                          </button>
                        </div>

                        <AnimatePresence>
                          {openMenuId === emp.id && (
                            <>
                              <div 
                                className="fixed inset-0 z-10" 
                                onClick={() => setOpenMenuId(null)}
                              />
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                className="absolute right-0 mt-2 w-36 bg-white rounded-xl shadow-xl border border-gray-100 z-20 py-1"
                              >
                                <button
                                  onClick={() => handleEdit(emp)}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors text-left font-medium"
                                >
                                  <Edit2 className="w-4 h-4" />
                                  Update
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(emp)}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left font-medium"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </button>
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {viewingEmployee && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-bold text-2xl">
                      {viewingEmployee.firstName[0]}{viewingEmployee.lastName[0]}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 leading-none">{viewingEmployee.firstName} {viewingEmployee.lastName}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <p className="text-gray-500 font-medium uppercase tracking-widest text-[10px] bg-gray-50 px-2 py-1 rounded-md inline-block">
                          {viewingEmployee.positionId}
                        </p>
                        <button 
                          onClick={() => handleCopy(viewingEmployee.id)}
                          className="text-[10px] font-mono text-gray-400 bg-gray-50 px-2 py-1 rounded-md hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center gap-1.5 group/id"
                        >
                          ID: {viewingEmployee.id.slice(0, 8)}...
                          {copiedText === viewingEmployee.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 opacity-0 group-hover/id:opacity-100" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setViewingEmployee(null)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Internal ID</p>
                      <p className="text-sm font-mono font-bold text-gray-900">{viewingEmployee.id}</p>
                    </div>

                    <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Employment Status</p>
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ring-1 ring-inset whitespace-nowrap uppercase tracking-tighter",
                        viewingEmployee.status === 'active' ? "bg-green-50 text-green-700 ring-green-600/20" :
                        viewingEmployee.status === 'on-leave' ? "bg-orange-50 text-orange-700 ring-orange-600/20" :
                        "bg-gray-50 text-gray-700 ring-gray-600/20"
                      )}>
                        {viewingEmployee.status.replace('-', ' ')}
                      </span>
                    </div>

                    <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Department</p>
                      <p className="text-sm font-bold text-gray-900">{viewingEmployee.departmentId}</p>
                    </div>

                    <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Position</p>
                      <p className="text-sm font-bold text-gray-900">{viewingEmployee.positionId}</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Annual Salary</p>
                      <p className="text-sm font-bold text-gray-900">${Number(viewingEmployee.salary).toLocaleString()}</p>
                    </div>

                    <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Hire Date</p>
                      <p className="text-sm font-bold text-gray-900">{new Date(viewingEmployee.hireDate).toLocaleDateString()}</p>
                    </div>

                    <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Work Email</p>
                      <p className="text-sm font-bold text-indigo-600">{viewingEmployee.email}</p>
                    </div>
                  </div>
                </div>

                {viewingEmployee.phone && (
                  <div className="mt-6 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Phone Number</p>
                    <p className="text-sm font-bold text-gray-900">{viewingEmployee.phone}</p>
                  </div>
                )}

                <div className="mt-10 flex gap-4">
                  <button
                    onClick={() => setViewingEmployee(null)}
                    className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setViewingEmployee(null);
                      handleEdit(viewingEmployee);
                    }}
                    className="flex-1 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit Member
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-2xl font-bold text-gray-900 leading-none">
                  {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
                </h3>
                <p className="text-sm text-gray-500 font-medium mt-2">
                  {editingEmployee ? 'Update the professional details for this team member.' : 'Enter the professional details for the new team member.'}
                </p>
              </div>
              
              <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1 uppercase tracking-widest">First Name</label>
                    <input 
                      {...register('firstName')}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all font-medium" 
                    />
                    {errors.firstName && <p className="text-xs text-red-500 font-bold ml-1">{errors.firstName.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1 uppercase tracking-widest">Last Name</label>
                    <input 
                      {...register('lastName')}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all font-medium" 
                    />
                    {errors.lastName && <p className="text-xs text-red-500 font-bold ml-1">{errors.lastName.message}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1 uppercase tracking-widest">Work Email</label>
                  <input 
                    {...register('email')}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all font-medium" 
                  />
                  {errors.email && <p className="text-xs text-red-500 font-bold ml-1">{errors.email.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1 uppercase tracking-widest">Department</label>
                    <select 
                      {...register('departmentId')}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all font-medium"
                    >
                      <option value="">Select Dept</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.name}>{dept.name}</option>
                      ))}
                    </select>
                    {errors.departmentId && <p className="text-xs text-red-500 font-bold ml-1">{errors.departmentId.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1 uppercase tracking-widest">Position</label>
                    <input 
                      {...register('positionId')}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all font-medium" 
                    />
                    {errors.positionId && <p className="text-xs text-red-500 font-bold ml-1">{errors.positionId.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1 uppercase tracking-widest">Salary (USD)</label>
                    <input 
                      type="number"
                      {...register('salary', { valueAsNumber: true })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all font-medium" 
                    />
                    {errors.salary && <p className="text-xs text-red-500 font-bold ml-1">{errors.salary.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1 uppercase tracking-widest">Status</label>
                    <select 
                      {...register('status')}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all font-medium"
                    >
                      <option value="active">Active</option>
                      <option value="on-leave">On Leave</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    {editingEmployee ? 'Save Changes' : 'Create Employee'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {employeeToDelete && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mx-auto mb-6">
                  <Trash2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 leading-none">Confirm Deletion</h3>
                <p className="text-gray-500 font-medium mt-4">
                  Are you sure you want to permanently delete <span className="text-gray-900 font-bold">{employeeToDelete.firstName} {employeeToDelete.lastName}</span>? This action cannot be undone.
                </p>
                <div className="flex gap-4 mt-8">
                  <button
                    onClick={() => setEmployeeToDelete(null)}
                    className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
