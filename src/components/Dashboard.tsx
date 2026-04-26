import { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Employee, Department } from '../types';
import { Users, Building2, UserCheck, Clock, Database, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { seedDatabase } from '../lib/seed';
import { cn } from '../lib/utils';
import { format, subMonths, isAfter, startOfMonth } from 'date-fns';

const COLORS = ['#4f46e5', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#3b82f6', '#ef4444', '#f59e0b'];

export function Dashboard() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(docs);
      setLoading(false);
    });

    const unsubDepts = onSnapshot(collection(db, 'departments'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department));
      setDepartments(docs);
    });

    return () => {
      unsubEmployees();
      unsubDepts();
    };
  }, []);

  // Growth Chart Data (Last 6 months)
  const last6Months = Array.from({ length: 6 }).map((_, i) => {
    const d = subMonths(new Date(), 5 - i);
    return {
      name: format(d, 'MMM'),
      start: startOfMonth(d),
      count: 0
    };
  });

  employees.forEach(emp => {
    const hireDate = new Date(emp.hireDate);
    last6Months.forEach(month => {
      if (isAfter(hireDate, month.start) && hireDate < startOfMonth(subMonths(month.start, -1))) {
        month.count++;
      }
    });
  });

  // Department Distribution data
  const deptDistribution = departments.map(dept => {
    const count = employees.filter(emp => emp.departmentId === dept.id).length;
    return { name: dept.name, value: count };
  }).filter(d => d.value > 0);

  const stats = [
    { 
      label: 'Total Employees', 
      value: employees.length.toString(), 
      icon: Users, 
      color: 'bg-blue-50 text-blue-600', 
      trend: `${Math.round((employees.length / 150) * 100)}% cap` 
    },
    { 
      label: 'Active Depts', 
      value: departments.length.toString(), 
      icon: Building2, 
      color: 'bg-purple-50 text-purple-600', 
      trend: 'Functional' 
    },
    { 
      label: 'On Leave', 
      value: employees.filter(e => e.status === 'on-leave').length.toString(), 
      icon: Clock, 
      color: 'bg-orange-50 text-orange-600', 
      trend: 'Current' 
    },
    { 
      label: 'New Hires', 
      value: employees.filter(e => isAfter(new Date(e.hireDate), subMonths(new Date(), 1))).length.toString(), 
      icon: UserCheck, 
      color: 'bg-green-50 text-green-600', 
      trend: 'Last 30d' 
    },
  ];

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      await seedDatabase();
      alert('Sample data added successfully!');
    } catch (err) {
      alert('Failed to seed data.');
    } finally {
      setIsSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 leading-tight">Workforce Overview</h2>
          <p className="text-gray-500 font-medium">Real-time metrics for your organization.</p>
        </div>
        <button
          onClick={handleSeed}
          disabled={isSeeding}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-50 shadow-xs"
        >
          {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
          Seed Sample Data
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm shadow-gray-200/50 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className={cn("p-3 rounded-xl", stat.color)}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-gray-50 text-gray-500 uppercase tracking-widest">
                {stat.trend}
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-500 mb-1">{stat.label}</h3>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="p-8 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6 font-sans">Growth Trend</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last6Months}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px' }}
                />
                <Bar dataKey="count" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-8 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6 font-sans">Department Distribution</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={deptDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {deptDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

