import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Department, Employee, OperationType } from '../types';
import { handleFirestoreError } from '../lib/utils';
import { Plus, Building2, MoreVertical, LayoutGrid, List, AlertCircle, Edit2, Trash2, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { cn } from '../lib/utils';

const deptSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional(),
  managerId: z.string().optional(),
});

type DeptFormData = z.infer<typeof deptSchema>;

export function DepartmentList() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<DeptFormData>({
    resolver: zodResolver(deptSchema),
  });

  useEffect(() => {
    const qDepts = query(collection(db, 'departments'), orderBy('name', 'asc'));
    const unsubscribeDepts = onSnapshot(qDepts, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department));
      setDepartments(docs);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error('Departments sync error:', err);
      setError('Permission denied or connection issue.');
      setLoading(false);
    });

    const qEmps = query(collection(db, 'employees'), orderBy('firstName', 'asc'));
    const unsubscribeEmps = onSnapshot(qEmps, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(docs);
    });

    return () => {
      unsubscribeDepts();
      unsubscribeEmps();
    };
  }, []);

  const onSubmit = async (data: DeptFormData) => {
    // Check for duplicate names
    const isDuplicate = departments.some(d => 
      d.name.toLowerCase() === data.name.toLowerCase() && 
      (!editingDept || d.id !== editingDept.id)
    );

    if (isDuplicate) {
      alert('A department with this name already exists.');
      return;
    }

    try {
      if (editingDept) {
        await updateDoc(doc(db, 'departments', editingDept.id), {
          ...data,
        });
        alert('Department updated successfully.');
      } else {
        await addDoc(collection(db, 'departments'), {
          ...data,
          createdBy: auth.currentUser?.uid,
        });
        alert('Department created successfully.');
      }
      setIsModalOpen(false);
      setEditingDept(null);
      reset();
    } catch (error) {
      handleFirestoreError(error, editingDept ? OperationType.UPDATE : OperationType.CREATE, 'departments');
    }
  };

  const handleDeleteClick = (dept: Department) => {
    setDeptToDelete(dept);
    setOpenMenuId(null);
  };

  const confirmDelete = async () => {
    if (!deptToDelete) return;
    try {
      await deleteDoc(doc(db, 'departments', deptToDelete.id));
      setDeptToDelete(null);
      alert('Department deleted successfully.');
    } catch (err) {
      alert('Failed to delete department.');
      handleFirestoreError(err, OperationType.DELETE, `departments/${deptToDelete.id}`);
    }
  };

  const handleEdit = (dept: Department) => {
    setEditingDept(dept);
    reset({
      name: dept.name,
      description: dept.description || '',
      managerId: dept.managerId || '',
    });
    setIsModalOpen(true);
    setOpenMenuId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Departments</h2>
          <p className="text-gray-500 font-medium mt-1">Structure your organization's units.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg shadow-indigo-100"
        >
          <Plus className="w-5 h-5" />
          Add Department
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-48 bg-white border border-gray-100 rounded-2xl animate-pulse" />
          ))
        ) : error ? (
          <div className="col-span-full py-20 bg-red-50 border border-red-100 rounded-3xl flex flex-col items-center gap-4 text-red-600">
             <AlertCircle className="w-12 h-12" />
             <p className="font-bold text-center px-8">{error}</p>
          </div>
        ) : departments.length === 0 ? (
          <div className="col-span-full py-20 bg-white border border-dashed border-gray-200 rounded-3xl flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300">
               <Building2 className="w-8 h-8" />
            </div>
            <p className="text-gray-500 font-medium text-lg">No departments yet.</p>
            <button onClick={() => setIsModalOpen(true)} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-colors">Create First Department</button>
          </div>
        ) : (
          departments.map((dept) => (
            <motion.div
              layout
              key={dept.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="group p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <div className="relative inline-block text-left">
                  <button 
                    onClick={() => setOpenMenuId(openMenuId === dept.id ? null : dept.id)}
                    className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors bg-white shadow-sm"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                  
                  <AnimatePresence>
                    {openMenuId === dept.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          className="absolute right-0 mt-2 w-36 bg-white rounded-xl shadow-xl border border-gray-100 z-20 py-1"
                        >
                          <button
                            onClick={() => handleEdit(dept)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors text-left"
                          >
                            <Edit2 className="w-4 h-4" />
                            Update
                          </button>
                          <button
                            onClick={() => handleDeleteClick(dept)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 mb-4 group-hover:scale-110 transition-transform">
                <Building2 className="w-6 h-6" />
              </div>
              
              <h4 className="text-xl font-bold text-gray-900 mb-1 truncate">{dept.name}</h4>
              
              {dept.managerId && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
                    <User className="w-3 h-3" />
                  </div>
                  <span className="text-[11px] font-bold text-gray-600 uppercase tracking-tight">
                    Mgr: {employees.find(e => e.id === dept.managerId)?.firstName} {employees.find(e => e.id === dept.managerId)?.lastName}
                  </span>
                </div>
              )}

              <p className="text-sm text-gray-500 font-medium mb-6 line-clamp-2 min-h-[2.5rem]">
                {dept.description || 'No description provided for this department.'}
              </p>
              
              <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                <div className="flex -space-x-2">
                   {/* Placeholders for avatars */}
                   <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white ring-1 ring-gray-100" />
                   <div className="w-8 h-8 rounded-full bg-indigo-100 border-2 border-white ring-1 ring-indigo-50 flex items-center justify-center text-[10px] font-bold text-indigo-600">+8</div>
                </div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Active</span>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <AnimatePresence>
        {deptToDelete && (
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
                <h3 id="delete-confirm-title" className="text-2xl font-bold text-gray-900 leading-none">Confirm Deletion</h3>
                <p id="delete-confirm-description" className="text-gray-500 font-medium mt-4">
                  Are you sure you want to permanently delete <span className="text-gray-900 font-bold">{deptToDelete.name}</span>? This action cannot be undone.
                </p>
                <div className="flex gap-4 mt-8">
                  <button
                    id="cancel-delete-btn"
                    onClick={() => setDeptToDelete(null)}
                    className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors uppercase tracking-widest text-[10px]"
                  >
                    Cancel
                  </button>
                  <button
                    id="confirm-delete-btn"
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
              <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 leading-none">
                    {editingDept ? 'Update Department' : 'New Department'}
                  </h3>
                  <p className="text-sm text-gray-500 font-medium mt-2">
                    {editingDept ? 'Modify department settings.' : 'Define a new organizational unit.'}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingDept(null);
                    reset();
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
                >
                  <AlertCircle className="w-6 h-6 rotate-45" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 ml-1 uppercase tracking-widest">Department Name</label>
                  <input 
                    {...register('name')}
                    placeholder="e.g. Research & Development"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all font-medium" 
                  />
                  {errors.name && <p className="text-xs text-red-500 font-bold ml-1">{errors.name.message}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 ml-1 uppercase tracking-widest">Department Manager</label>
                  <select 
                    {...register('managerId')}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all font-medium appearance-none"
                  >
                    <option value="">No manager assigned</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.positionId})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 ml-1 uppercase tracking-widest">Description</label>
                  <textarea 
                    {...register('description')}
                    rows={3}
                    placeholder="Briefly describe the department's focus..."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all font-medium resize-none" 
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setEditingDept(null);
                      reset();
                    }}
                    className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors uppercase tracking-widest text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 uppercase tracking-widest text-xs"
                  >
                    {editingDept ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
