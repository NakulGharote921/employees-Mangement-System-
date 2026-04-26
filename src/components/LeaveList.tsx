import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  addDoc, 
  onSnapshot,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { LeaveRequest, Employee, OperationType } from '../types';
import { handleFirestoreError } from '../lib/utils';
import { Plus, Clock, CheckCircle2, XCircle, AlertCircle, Calendar, User, Trash2, Check, X, Search, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { cn } from '../lib/utils';
import { format, differenceInDays } from 'date-fns';

const leaveSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  type: z.enum(['sick', 'vacation', 'personal', 'maternity', 'paternity']),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  reason: z.string().optional(),
});

type LeaveFormData = z.infer<typeof leaveSchema>;

export function LeaveList() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<LeaveFormData>({
    resolver: zodResolver(leaveSchema),
  });

  useEffect(() => {
    const qLeaves = query(collection(db, 'leaves'), orderBy('startDate', 'desc'));
    const unsubscribeLeaves = onSnapshot(qLeaves, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest));
      setLeaves(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leaves');
    });

    const qEmployees = query(collection(db, 'employees'), orderBy('firstName', 'asc'));
    const unsubscribeEmployees = onSnapshot(qEmployees, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(docs);
    });

    return () => {
      unsubscribeLeaves();
      unsubscribeEmployees();
    };
  }, []);

  const onSubmit = async (data: LeaveFormData) => {
    try {
      await addDoc(collection(db, 'leaves'), {
        ...data,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setIsModalOpen(false);
      reset();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'leaves');
    }
  };

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    setProcessingId(id);
    try {
      await updateDoc(doc(db, 'leaves', id), { 
        status,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `leaves/${id}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this request?')) return;
    try {
      await deleteDoc(doc(db, 'leaves', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `leaves/${id}`);
    }
  };

  const filteredLeaves = leaves.filter(l => filter === 'all' || l.status === filter);

  const getEmployeeName = (id: string) => {
    const emp = employees.find(e => e.id === id);
    return emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown Employee';
  };

  const getLeaveTypeStyles = (type: string) => {
    switch(type) {
      case 'sick': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'vacation': return 'bg-sky-50 text-sky-600 border-sky-100';
      case 'personal': return 'bg-amber-50 text-amber-600 border-amber-100';
      default: return 'bg-indigo-50 text-indigo-600 border-indigo-100';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Leave Management</h2>
          <p className="text-gray-500 font-medium mt-1">Track and process employee time off requests.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-100 shrink-0"
        >
          <Plus className="w-5 h-5" />
          New Request
        </button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border shrink-0",
              filter === status 
                ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100" 
                : "bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
            )}
          >
            {status}
            <span className={cn(
              "ml-2 px-1.5 py-0.5 rounded-md text-[10px]",
              filter === status ? "bg-white/20" : "bg-gray-100"
            )}>
              {status === 'all' ? leaves.length : leaves.filter(l => l.status === status).length}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading ? (
          <div className="lg:col-span-2 p-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : filteredLeaves.length === 0 ? (
          <div className="lg:col-span-2 bg-white border-2 border-dashed border-gray-200 rounded-3xl p-16 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-300">
              <Calendar className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No requests found</h3>
            <p className="text-gray-500 font-medium mt-1">Try changing your filters or create a new request.</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredLeaves.map((leave) => {
              const days = differenceInDays(new Date(leave.endDate), new Date(leave.startDate)) + 1;
              return (
                <motion.div
                  layout
                  key={leave.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs hover:shadow-md transition-all group relative overflow-hidden"
                >
                  <div className={cn(
                    "absolute top-0 right-0 px-4 py-1.5 rounded-bl-2xl text-[10px] font-bold uppercase tracking-widest",
                    leave.status === 'approved' ? "bg-green-500 text-white" :
                    leave.status === 'rejected' ? "bg-rose-500 text-white" :
                    "bg-amber-500 text-white"
                  )}>
                    {leave.status}
                  </div>

                  <div className="flex gap-5">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 border-2",
                      getLeaveTypeStyles(leave.type)
                    )}>
                      <span className="text-lg font-black leading-none">{days}</span>
                      <span className="text-[10px] font-bold uppercase">Days</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-tighter border",
                          getLeaveTypeStyles(leave.type)
                        )}>
                          {leave.type}
                        </span>
                        <span className="w-1 h-1 bg-gray-300 rounded-full" />
                        <span className="text-[10px] font-mono text-gray-400">ID: {leave.id.slice(0, 8)}</span>
                      </div>
                      
                      <h4 className="text-lg font-bold text-gray-900 truncate">
                        {getEmployeeName(leave.employeeId)}
                      </h4>
                      
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(new Date(leave.startDate), 'MMM d')} - {format(new Date(leave.endDate), 'MMM d, yyyy')}
                        </div>
                      </div>

                      {leave.reason && (
                        <p className="mt-3 text-sm text-gray-500 line-clamp-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                          <span className="font-bold text-gray-400 uppercase text-[10px] block mb-1">Reason:</span>
                          {leave.reason}
                        </p>
                      )}

                      {leave.status === 'pending' && (
                        <div className="flex gap-2 mt-6">
                          <button
                            onClick={() => updateStatus(leave.id, 'approved')}
                            disabled={!!processingId}
                            className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-100"
                          >
                            <Check className="w-4 h-4" />
                            Approve
                          </button>
                          <button
                            onClick={() => updateStatus(leave.id, 'rejected')}
                            disabled={!!processingId}
                            className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-100"
                          >
                            <X className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      )}

                      {leave.status !== 'pending' && (
                        <div className="mt-6 flex justify-end">
                          <button
                            onClick={() => handleDelete(leave.id)}
                            className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 leading-none">New Leave Request</h3>
                  <p className="text-sm text-gray-500 font-medium mt-2">Submit a time off application.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Employee</label>
                  <select 
                    {...register('employeeId')}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all font-medium appearance-none"
                  >
                    <option value="">Select an employee</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.positionId})
                      </option>
                    ))}
                  </select>
                  {errors.employeeId && <p className="text-xs text-rose-500 font-bold ml-1">{errors.employeeId.message}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Leave Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['sick', 'vacation', 'personal', 'maternity', 'paternity'] as const).map((type) => (
                      <label key={type} className="relative flex items-center">
                        <input 
                          type="radio" 
                          value={type} 
                          {...register('type')} 
                          className="peer sr-only"
                        />
                        <div className="w-full p-3 text-center border border-gray-200 rounded-xl cursor-pointer peer-checked:bg-indigo-50 peer-checked:border-indigo-600 peer-checked:text-indigo-600 text-xs font-bold uppercase tracking-widest hover:bg-gray-50 transition-all">
                          {type}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Start Date</label>
                    <input 
                      type="date"
                      {...register('startDate')}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all font-bold" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">End Date</label>
                    <input 
                      type="date"
                      {...register('endDate')}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all font-bold" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Reason</label>
                  <textarea 
                    {...register('reason')}
                    rows={3}
                    placeholder="Briefly explain the reason for leave..."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all font-medium resize-none" 
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-3 border border-gray-200 text-gray-500 font-bold rounded-xl hover:bg-gray-50 uppercase tracking-widest text-xs transition-all">Cancel</button>
                  <button type="submit" className="flex-1 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 uppercase tracking-widest text-xs transition-all">Submit Request</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
