import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signInWithGoogle } from './lib/firebase';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { EmployeeList } from './components/EmployeeList';
import { DepartmentList } from './components/DepartmentList';
import { LeaveList } from './components/LeaveList';
import { PayrollList } from './components/PayrollList';
import { LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'dashboard' | 'employees' | 'departments' | 'leaves' | 'payroll'>('dashboard');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center"
        >
          <div className="w-20 h-20 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <LogIn className="w-10 h-10 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Employee Pro</h1>
          <p className="text-gray-600 mb-8">Manage your workforce with precision and ease. Sign in to get started.</p>
          <button
            onClick={signInWithGoogle}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-indigo-200"
          >
            Sign in with Google
          </button>
          {!user && (
            <p className="mt-4 text-xs text-gray-400">
              Note: Ensure your Google account email is verified.
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <Layout currentView={currentView} setCurrentView={setCurrentView} user={user}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentView}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          {currentView === 'dashboard' && <Dashboard />}
          {currentView === 'employees' && <EmployeeList />}
          {currentView === 'departments' && <DepartmentList />}
          {currentView === 'leaves' && <LeaveList />}
          {currentView === 'payroll' && <PayrollList />}
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}
