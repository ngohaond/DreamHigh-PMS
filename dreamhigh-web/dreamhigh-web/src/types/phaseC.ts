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
// API: GET /api/classes/:id/exams, POST /api/exams, POST /api/exams/:id/grades/bulk
// Authorization: JWT Bearer token, RBAC enforced

export interface Exam {
  id: number;
  classId: number;
  title: string;
  examType?: string; // Optional: QUIZ, MIDTERM, FINAL, etc.
  scheduledAt: string; // ISO 8601 required
  maxScore: number;
  weightPercent?: number; // Optional: percentage of final grade
  createdAt: string;
  updatedAt: string;
}

export interface CreateExamRequest {
  classId: number;
  title: string;
  examType?: string;
  scheduledAt: string; // ISO 8601 required
  maxScore: number;
  weightPercent?: number;
}

export interface GradeRecord {
  studentId: number;
  score: number;
  gradeLabel?: string; // e.g., "A", "B+", "Pass"
  remarks?: string; // Optional notes/feedback
}

export interface BulkGradesRequest {
  grades: GradeRecord[];
}

export interface LowScoreAlert {
  studentId: number;
  score: number;
}

export interface BulkGradesResponse {
  statusCode: number;
  message: string;
  data: {
    upsertedCount: number;
    lowScoreAlerts?: LowScoreAlert[];
  };
}

export interface StudentGrade {
  id: number;
  examId: number;
  studentId: number;
  score: number;
  gradeLabel?: string;
  remarks?: string;
  gradedAt: string;
}

export interface ClassExamsResponse {
  statusCode: number;
  message: string;
  data: Exam[];
  meta: {
    total: number;
    limit?: number;
    offset?: number;
  };
}
