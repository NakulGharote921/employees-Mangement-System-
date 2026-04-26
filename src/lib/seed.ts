import { collection, addDoc, serverTimestamp, getDocs, query, limit } from 'firebase/firestore';
import { db, auth } from './firebase';

export async function seedDatabase() {
  if (!auth.currentUser) return;

  try {
    // 1. Seed Departments
    const depts = [
      { name: 'Engineering', description: 'Product development and infrastructure.' },
      { name: 'Marketing', description: 'Brand growth and customer acquisition.' },
      { name: 'Sales', description: 'Revenue generation and client relations.' },
      { name: 'HR', description: 'Personnel management and culture.' },
    ];

    const deptRefs: Record<string, string> = {};

    for (const dept of depts) {
      const docRef = await addDoc(collection(db, 'departments'), {
        ...dept,
        createdBy: auth.currentUser.uid,
      });
      deptRefs[dept.name] = dept.name; // Using name as ID for simplicity in this demo's logic
    }

    // 2. Seed Employees
    const employees = [
      {
        firstName: 'Sarah',
        lastName: 'Connor',
        email: 'sarah.c@company.com',
        departmentId: 'Engineering',
        positionId: 'Senior Frontend Engineer',
        salary: 125000,
        status: 'active',
      },
      {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.d@company.com',
        departmentId: 'Marketing',
        positionId: 'Growth Manager',
        salary: 95000,
        status: 'active',
      },
      {
        firstName: 'Elena',
        lastName: 'Fisher',
        email: 'elena.f@company.com',
        departmentId: 'Sales',
        positionId: 'Account Executive',
        salary: 85000,
        status: 'on-leave',
      },
      {
        firstName: 'Marcus',
        lastName: 'Fenix',
        email: 'marcus.f@company.com',
        departmentId: 'Engineering',
        positionId: 'DevOps Lead',
        salary: 140000,
        status: 'active',
      },
    ];

    for (const emp of employees) {
      await addDoc(collection(db, 'employees'), {
        ...emp,
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        hireDate: new Date().toISOString(),
      });
    }

    return true;
  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  }
}
