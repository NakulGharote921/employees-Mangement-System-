import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Payroll, Employee, OperationType } from '../types';
import { handleFirestoreError } from '../lib/utils';
import { Banknote, Plus, Search, Filter, CheckCircle, Clock, AlertCircle, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

const payrollSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  amount: z.number().min(0, 'Amount must be positive'),
  periodStart: z.string().min(1, 'Start date is required'),
  periodEnd: z.string().min(1, 'End date is required'),
  notes: z.string().optional(),
});

type PayrollFormData = z.infer<typeof payrollSchema>;

export function PayrollList() {
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState<Payroll | null>(null);
  const [payrollToDelete, setPayrollToDelete] = useState<Payroll | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<PayrollFormData>({
    resolver: zodResolver(payrollSchema),
  });

  useEffect(() => {
    // Sync Payrolls
    const qPayroll = query(collection(db, 'payrolls'), orderBy('periodStart', 'desc'));
    const unsubscribePayroll = onSnapshot(qPayroll, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payroll));
      setPayrolls(docs);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error('Payroll sync error:', err);
      setError('Permission denied to view payroll.');
      setLoading(false);
    });

    // Sync Employees for selection
    const qEmp = query(collection(db, 'employees'), orderBy('firstName', 'asc'));
    const unsubscribeEmp = onSnapshot(qEmp, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(docs);
    });

    return () => {
      unsubscribePayroll();
      unsubscribeEmp();
    };
  }, []);

  const onSubmit = async (data: PayrollFormData) => {
    try {
      if (editingPayroll) {
        await updateDoc(doc(db, 'payrolls', editingPayroll.id), {
          ...data,
        });
        alert('Payroll record updated.');
      } else {
        await addDoc(collection(db, 'payrolls'), {
          ...data,
          status: 'pending',
          createdAt: serverTimestamp(),
        });
        alert('Payroll record created.');
      }
      setIsModalOpen(false);
      setEditingPayroll(null);
      reset();
    } catch (err) {
      handleFirestoreError(err, editingPayroll ? OperationType.UPDATE : OperationType.CREATE, 'payrolls');
    }
  };

  const handleDelete = (pay: Payroll) => {
    setPayrollToDelete(pay);
  };

  const confirmDelete = async () => {
    if (!payrollToDelete) return;
    try {
      await deleteDoc(doc(db, 'payrolls', payrollToDelete.id));
      alert('Payroll record deleted.');
      setPayrollToDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `payrolls/${payrollToDelete.id}`);
    }
  };

  const handleStatusChange = async (id: string, newStatus: Payroll['status']) => {
    try {
      await updateDoc(doc(db, 'payrolls', id), {
        status: newStatus,
        paidAt: newStatus === 'processed' ? new Date().toISOString() : null,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `payrolls/${id}`);
    }
  };

  const getEmployeeName = (id: string) => {
    const emp = employees.find(e => e.id === id || e.email === id); // Fallback for seeds
    return emp ? `${emp.firstName} ${emp.lastName}` : id;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Payroll Management</h2>
          <p className="text-gray-500 font-medium mt-1">Track and manage employee compensation.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg shadow-indigo-100"
        >
          <Plus className="w-5 h-5" />
          New Payroll Run
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
          <div className="flex items-center gap-4 flex-1">
             <div className="bg-white border border-gray-200 px-4 py-2 rounded-xl flex items-center gap-3 w-full max-w-md shadow-xs">
              <Search className="w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search payrolls..." className="bg-transparent border-none focus:ring-0 text-sm w-full outline-hidden" />
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
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Employee</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Period</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">Loading payroll records...</td></tr>
              ) : error ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-red-500 font-bold">{error}</td></tr>
              ) : payrolls.length === 0 ? (
                <tr>
                   <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <Banknote className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                      No payroll records yet.
                   </td>
                </tr>
              ) : (
                payrolls.map((pay) => (
                  <tr key={pay.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-gray-900">{getEmployeeName(pay.employeeId)}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{pay.employeeId}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-indigo-600">
                        ${pay.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-gray-600 font-medium">
                        {format(new Date(pay.periodStart), 'MMM d')} - {format(new Date(pay.periodEnd), 'MMM d, yyyy')}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                        pay.status === 'processed' ? "bg-green-50 text-green-700" :
                        pay.status === 'failed' ? "bg-red-50 text-red-700" :
                        "bg-blue-50 text-blue-700"
                      )}>
                        {pay.status === 'processed' ? <CheckCircle className="w-3 h-3" /> :
                         pay.status === 'failed' ? <AlertCircle className="w-3 h-3" /> :
                         <Clock className="w-3 h-3" />}
                        {pay.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <div className="flex items-center justify-end gap-2">
                         {pay.status === 'pending' && (
                           <button 
                             onClick={() => handleStatusChange(pay.id, 'processed')}
                             className="text-[10px] font-bold text-green-600 hover:underline uppercase"
                           >
                             Approve
                           </button>
                         )}
                         <button 
                           onClick={() => handleDelete(pay)}
                           className="text-gray-400 hover:text-red-600 p-1 transition-colors"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
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
        {payrollToDelete && (
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
                  Are you sure you want to delete the payroll record for <span className="text-gray-900 font-bold">{getEmployeeName(payrollToDelete.employeeId)}</span> for the period <span className="text-gray-900 font-bold">{format(new Date(payrollToDelete.periodStart), 'MMM d')} - {format(new Date(payrollToDelete.periodEnd), 'MMM d, yyyy')}</span>?
                </p>
                <div className="flex gap-4 mt-8">
                  <button
                    onClick={() => setPayrollToDelete(null)}
                    className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors uppercase tracking-widest text-[10px]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 uppercase tracking-widest text-[10px]"
                  >
                    Delete
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
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-2xl font-bold text-gray-900 leading-none">Record Payroll</h3>
                <p className="text-sm text-gray-500 font-medium mt-2">Create a new compensation record for an employee.</p>
              </div>
              
              <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1 uppercase tracking-widest">Select Employee</label>
                  <select 
                    {...register('employeeId')}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all font-medium"
                    onChange={(e) => {
                      const emp = employees.find(emp => emp.id === e.target.value);
                      if (emp) setValue('amount', emp.salary / 12); // Default to monthly salary
                    }}
                  >
                    <option value="">Choose Employee...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                    ))}
                  </select>
                  {errors.employeeId && <p className="text-xs text-red-500 font-bold ml-1">{errors.employeeId.message}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1 uppercase tracking-widest">Payment Amount ($)</label>
                  <input 
                    type="number"
                    step="0.01"
                    {...register('amount', { valueAsNumber: true })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all font-medium" 
                  />
                  {errors.amount && <p className="text-xs text-red-500 font-bold ml-1">{errors.amount.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1 uppercase tracking-widest">Period Start</label>
                    <input 
                      type="date"
                      {...register('periodStart')}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all font-medium" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1 uppercase tracking-widest">Period End</label>
                    <input 
                      type="date"
                      {...register('periodEnd')}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all font-medium" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1 uppercase tracking-widest">Notes</label>
                  <textarea 
                    {...register('notes')}
                    rows={2}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all font-medium" 
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50">Cancel</button>
                  <button type="submit" className="flex-1 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100">Record Payment</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
