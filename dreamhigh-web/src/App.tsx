import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ClassDetailsPage } from './pages/ClassDetailsPage';
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import UserManagerPage from './pages/Admin/UserManagerPage';
import CategoryManagerPage from './pages/Admin/CategoryManagerPage';
import CategoryManagement from './pages/Admin/CategoryManagement';
import AuditLogPage from './pages/Admin/AuditLogPage';
import ProfilePage from './pages/Profile/ProfilePage';
import { ProtectedRoute } from './router/ProtectedRoute';
import LeadsPage from './pages/CRM/LeadsPage';
import StudentListPage from './pages/CRM/StudentListPage';
import StudentApiDetailPage from './pages/CRM/StudentApiDetailPage';
import StudentManagement from './pages/CRM/StudentManagement';
import TeacherManagement from './pages/HR/TeacherManagement';
import DashboardPage from './pages/Dashboard/DashboardPage';
import ClassesHubPage from './pages/Classes/ClassesHubPage';
import ClassScheduleManagement from './pages/Classes/ClassScheduleManagement';
import MySchedulePage from './pages/Classes/MySchedulePage';
import TeachingHoursPage from './pages/Reports/TeachingHoursPage';
import CoursesHubPage from './pages/Courses/CoursesHubPage';
import CourseManagement from './pages/Courses/CourseManagement';
import CurriculumManagement from './pages/Courses/CurriculumManagement';
import { AttendanceAlertsPage } from './pages/AttendanceAlertsPage';

// Initialize React Query Client
const queryClient = new QueryClient();

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

function AppRoutes() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/courses" element={<CoursesHubPage />} />
          <Route path="/courses/manage" element={<CourseManagement />} />
          <Route path="/courses/curriculum" element={<CurriculumManagement />} />
          <Route path="/classes" element={<ClassesHubPage />} />
          <Route path="/classes/schedule" element={<ClassScheduleManagement />} />
          <Route path="/classes/my-schedule" element={<MySchedulePage />} />
          <Route path="/classes/:id" element={<ClassDetailsPage />} />
          <Route path="/alerts/attendance" element={<AttendanceAlertsPage />} />
          <Route path="/reports/teaching-hours" element={<TeachingHoursPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          {/* Redirect authorized users from root to dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Route>

        {/* Admin Routes — catalog: ADMIN + MANAGER (FR1) */}
        <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']} />}>
          <Route path="/admin/categories" element={<CategoryManagerPage />} />
          <Route path="/admin/category-catalog" element={<CategoryManagement />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
          <Route path="/admin/users" element={<UserManagerPage />} />
          <Route path="/admin/audit-logs" element={<AuditLogPage />} />
        </Route>

        {/* CRM & HR (staff-facing) */}
        <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'STAFF']} />}>
          <Route path="/crm/leads" element={<LeadsPage />} />
          <Route path="/crm/students" element={<StudentListPage />} />
          <Route path="/crm/students/manage" element={<StudentManagement />} />
          <Route path="/crm/students/:id" element={<StudentApiDetailPage />} />
          <Route path="/hr/teachers" element={<TeacherManagement />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

function App() {
  const tree = (
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
    </QueryClientProvider>
  );

  if (googleClientId) {
    return <GoogleOAuthProvider clientId={googleClientId}>{tree}</GoogleOAuthProvider>;
  }
  return tree;
}

export default App;
