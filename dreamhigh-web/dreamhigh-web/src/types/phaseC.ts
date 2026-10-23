// Phase C API Types for Attendance, Alerts, and Grades

// ========== Attendance (FR13) ==========
// API: POST /sessions/:sessionId/attendances
// Authorization: JWT Bearer token, user must be Teacher of class OR ADMIN/MANAGER

export type AttendanceStatus = 'PRESENT' | 'ABSENT_EXCUSED' | 'ABSENT_UNEXCUSED';

export interface BulkAttendanceRecord {
  studentId: number;
  status: AttendanceStatus;
  note?: string; // Optional, max 500 chars
}

export interface BulkAttendanceRequest {
  attendances: BulkAttendanceRecord[];
}

export interface AttendanceRecordResponse {
  id: number;
  sessionId: number;
  studentId: number;
  studentCode: string;
  studentName: string;
  status: AttendanceStatus;
  note: string | null;
}

export interface BulkAttendanceResponse {
  statusCode: number;
  message: string;
  data: AttendanceRecordResponse[];
  meta: {
    total: number;
  };
}

// ========== Attendance Risk Alerts (FR14) ==========
// API: GET /alerts/attendance-risk
// Authorization: Bearer token, Roles: ADMIN, MANAGER, STAFF

export interface AttendanceAlert {
  id: number;
  studentId: number;
  classId: number;
  consecutiveCount: number; // Số buổi vắng liên tục
  detectedAt: string; // ISO timestamp
  resolved: boolean;
  resolvedAt?: string; // ISO timestamp
  resolvedBy?: number;
  notes?: string;
  student: {
    id: number;
    studentCode: string;
    fullName: string;
    email: string;
  };
  trainingClass: {
    id: number;
    classCode: string;
    className: string;
  };
  resolver?: {
    id: number;
    fullName: string;
  };
}

export interface AttendanceAlertsFilters {
  resolved?: boolean; // Filter by resolution status
  classId?: number; // Filter by class
  studentId?: number; // Filter by student
}

export interface AttendanceAlertsResponse {
  data: AttendanceAlert[];
}

export interface ResolveAlertRequest {
  notes?: string;
}

// ========== Grades & Exams (FR15) ==========

export interface Exam {
  id: string;
  classCode: string;
  examName: string;
  examType: 'MIDTERM' | 'FINAL' | 'QUIZ' | 'ASSIGNMENT';
  maxScore: number;
  weight: number; // percentage of final grade
  examDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExamRequest {
  classCode: string;
  examName: string;
  examType: 'MIDTERM' | 'FINAL' | 'QUIZ' | 'ASSIGNMENT';
  maxScore: number;
  weight: number;
  examDate?: string;
}

export interface GradeRecord {
  studentId: string;
  score: number;
  feedback?: string;
}

export interface BulkGradesRequest {
  examId: string;
  grades: GradeRecord[];
}

export interface BulkGradesResponse {
  success: boolean;
  message: string;
  savedCount: number;
}

export interface StudentGrade {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  score: number;
  feedback?: string;
  gradedAt: string;
}

export interface ClassExamsResponse {
  exams: (Exam & { grades?: StudentGrade[] })[];
  total: number;
}
