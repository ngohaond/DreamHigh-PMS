import { apiClient } from './apiClient';
import type {
  AttendanceAlertsFilters,
  AttendanceAlertsResponse,
  BulkAttendanceRequest,
  BulkAttendanceResponse,
  BulkGradesRequest,
  BulkGradesResponse,
  ClassExamsResponse,
  CreateExamRequest,
  Exam,
} from '../types/phaseC';

// ========== Attendance API (FR13) ==========
// POST /sessions/:sessionId/attendances
// Authorization: JWT Bearer token, user must be Teacher of class OR ADMIN/MANAGER

export async function submitBulkAttendance(
  sessionId: number,
  data: BulkAttendanceRequest
): Promise<BulkAttendanceResponse> {
  const response = await apiClient.post(`/sessions/${sessionId}/attendances`, data);
  return response.data;
}

// ========== Attendance Risk Alerts API (FR14) ==========
// GET /alerts/attendance-risk
// PATCH /alerts/attendance-risk/:id/resolve
// Authorization: Bearer token, Roles: ADMIN, MANAGER, STAFF

export async function getAttendanceAlerts(filters?: AttendanceAlertsFilters): Promise<AttendanceAlertsResponse> {
  const response = await apiClient.get('/alerts/attendance-risk', { params: filters });
  return response.data;
}

export async function resolveAlert(alertId: number, data?: { notes?: string }): Promise<void> {
  await apiClient.patch(`/alerts/attendance-risk/${alertId}/resolve`, data);
}

// ========== Grades & Exams API (FR15) ==========
// GET /api/classes/:id/exams, POST /api/exams, POST /api/exams/:id/grades/bulk
// Authorization: JWT Bearer token, RBAC enforced

export async function getClassExams(classId: number): Promise<ClassExamsResponse> {
  const response = await apiClient.get(`/classes/${classId}/exams`);
  return response.data;
}

export async function createExam(data: CreateExamRequest): Promise<{ statusCode: number; message: string; data: Exam }> {
  const response = await apiClient.post('/exams', data);
  return response.data;
}

export async function submitBulkGrades(examId: number, data: BulkGradesRequest): Promise<BulkGradesResponse> {
  const response = await apiClient.post(`/exams/${examId}/grades/bulk`, data);
  return response.data;
}

export async function getExamGrades(examId: number) {
  const response = await apiClient.get(`/exams/${examId}/grades`);
  return response.data;
}
