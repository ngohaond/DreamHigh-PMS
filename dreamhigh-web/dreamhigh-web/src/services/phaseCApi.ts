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

export async function getClassExams(classCode: string): Promise<ClassExamsResponse> {
  const response = await apiClient.get(`/classes/${classCode}/exams`);
  return response.data;
}

export async function createExam(data: CreateExamRequest): Promise<Exam> {
  const response = await apiClient.post('/exams', data);
  return response.data;
}

export async function submitBulkGrades(examId: string, data: BulkGradesRequest): Promise<BulkGradesResponse> {
  const response = await apiClient.post(`/exams/${examId}/grades/bulk`, data);
  return response.data;
}

export async function getExamGrades(examId: string) {
  const response = await apiClient.get(`/exams/${examId}/grades`);
  return response.data;
}
