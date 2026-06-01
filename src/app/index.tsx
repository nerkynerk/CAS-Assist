import { useAuth } from '@/context/auth';
import AdminDashboardHome from '@/components/dashboard/admin-dashboard-home';
import FacultyDashboard   from '@/components/dashboard/faculty-dashboard';
import StaffDashboard     from '@/components/dashboard/staff-dashboard';
import StudentDashboard   from '@/components/dashboard/student-dashboard';

export default function HomeScreen() {
  const { profile } = useAuth();

  switch (profile?.role) {
    case 'super_admin': return <AdminDashboardHome />;
    case 'staff':       return <StaffDashboard />;
    case 'faculty':     return <FacultyDashboard />;
    default:            return <StudentDashboard />;
  }
}
