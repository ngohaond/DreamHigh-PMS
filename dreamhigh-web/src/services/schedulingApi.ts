import { apiClient } from './apiClient';
import type {
  ApiBranch,
  ApiClass,
  ApiClassDetail,
  ApiCourse,
  ApiRoom,
  ApiUserRef,
  CreateClassPayload,
  CreateClassWithSessionsPayload,
  SessionChangeEntry,
  SessionPreview,
  SessionView,
  TeachingHoursRow,
  UpdateClassPayload,
} from '../types/scheduling';

/**
 * Lớp bọc mỏng quanh `apiClient` cho nhóm API lớp học / lịch.
 * Base URL đã chứa `/api` nên dùng path trần (vd. `/classes`).
 */

/** Backend bọc mọi list vào `{ statusCode, message, data, meta }` — nhưng vài
 *  endpoint trả mảng trần. Chuẩn hoá về mảng cho mọi trường hợp. */
export function normalizeListPayload(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && 'data' in raw) {
    const d = (raw as { data?: unknown }).data;
    return Array.isArray(d) ? d : [];
  }
  return [];
}

export interface ListMeta {
  total: number;
  limit?: number;
  offset?: number;
}

export interface ClassesListResult {
  items: ApiClass[];
  meta: ListMeta;
}

/** `GET /classes` */
export async function fetchClasses(params: {
  status?: string;
  courseId?: number;
  branchId?: number;
  teacherId?: number;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<ClassesListResult> {
  const resp = await apiClient.get('/classes', { params });
  const body = resp.data as { data?: ApiClass[]; meta?: ListMeta };
  const items = Array.isArray(body?.data) ? body.data : [];
  return {
    items,
    meta: {
      total: body?.meta?.total ?? items.length,
      limit: body?.meta?.limit,
      offset: body?.meta?.offset,
    },
  };
}

/** `GET /classes/:classCode` — kèm sessions của lớp. */
export async function fetchClassDetail(classCode: string): Promise<ApiClassDetail> {
  const resp = await apiClient.get(`/classes/${encodeURIComponent(classCode)}`);
  const body = resp.data as { data?: ApiClassDetail };
  if (!body?.data) throw new Error('Không tìm thấy lớp học');
  return body.data;
}

/** `POST /classes` */
export async function createClass(payload: CreateClassPayload): Promise<ApiClass> {
  const resp = await apiClient.post('/classes', payload);
  const body = resp.data as { data?: ApiClass };
  return body.data as ApiClass;
}

/** `PATCH /classes/:id` */
export async function updateClass(classId: number, payload: UpdateClassPayload): Promise<ApiClass> {
  const resp = await apiClient.patch(`/classes/${classId}`, payload);
  const body = resp.data as { data?: ApiClass };
  return body.data as ApiClass;
}

/** `POST /classes/with-sessions` — tạo lớp + sinh session trong 1 transaction. */
export async function createClassWithSessions(
  payload: CreateClassWithSessionsPayload,
): Promise<{ classId: number; classCode: string; total: number }> {
  const resp = await apiClient.post('/classes/with-sessions', payload);
  const body = resp.data as { data?: { id: number; classCode: string }; meta?: { total?: number } };
  return {
    classId: body?.data?.id ?? 0,
    classCode: body?.data?.classCode ?? payload.classCode,
    total: body?.meta?.total ?? 0,
  };
}

/** `POST /classes/:id/sessions/preview` — không ghi DB. */
export async function previewSessions(
  classId: number,
  payload: {
    weekdays: number[];
    startDate: string;
    endDate?: string;
    startTime: string;
    endTime: string;
    sessionCount?: number;
    roomId?: number;
    teacherId?: number;
  },
): Promise<SessionPreview> {
  const resp = await apiClient.post(`/classes/${classId}/sessions/preview`, payload);
  return resp.data as SessionPreview;
}

/** `POST /classes/:id/sessions/generate` — sinh session cho lớp đã tồn tại. */
export async function generateSessions(
  classId: number,
  payload: {
    roomId: number;
    weekdays: number[];
    startDate: string;
    endDate?: string;
    startTime: string;
    endTime: string;
    sessionCount?: number;
  },
): Promise<number> {
  const resp = await apiClient.post(`/classes/${classId}/sessions/generate`, payload);
  const body = resp.data as { meta?: { created?: number } };
  return body?.meta?.created ?? 0;
}

/** `PATCH /sessions/:id/reschedule` */
export async function rescheduleSession(
  sessionId: number,
  payload: {
    date?: string;
    startTime?: string;
    endTime?: string;
    shiftFollowing?: boolean;
    reason?: string;
  },
): Promise<{ session: SessionView; shiftedCount: number }> {
  const resp = await apiClient.patch(`/sessions/${sessionId}/reschedule`, payload);
  const body = resp.data as { data?: { session?: SessionView; shiftedCount?: number } };
  return {
    session: body?.data?.session as SessionView,
    shiftedCount: body?.data?.shiftedCount ?? 0,
  };
}

/** `PATCH /sessions/:id/teacher` */
export async function changeSessionTeacher(
  sessionId: number,
  payload: { teacherId: number; reason?: string },
): Promise<SessionView> {
  const resp = await apiClient.patch(`/sessions/${sessionId}/teacher`, payload);
  const body = resp.data as { data?: SessionView };
  return body.data as SessionView;
}

/** `PATCH /sessions/:id/room` */
export async function changeSessionRoom(
  sessionId: number,
  payload: { roomId: number; reason?: string },
): Promise<SessionView> {
  const resp = await apiClient.patch(`/sessions/${sessionId}/room`, payload);
  const body = resp.data as { data?: SessionView };
  return body.data as SessionView;
}

/** `PATCH /sessions/:id/cancel` — reason bắt buộc, tối thiểu 3 ký tự. */
export async function cancelSession(sessionId: number, reason: string): Promise<SessionView> {
  const resp = await apiClient.patch(`/sessions/${sessionId}/cancel`, { reason });
  const body = resp.data as { data?: SessionView };
  return body.data as SessionView;
}

/** `GET /sessions/my-schedule?from=&to=` — server tự giới hạn theo JWT. */
export async function fetchMySchedule(
  from: string,
  to: string,
): Promise<{ items: SessionView[]; total: number; timeZone?: string }> {
  const resp = await apiClient.get('/sessions/my-schedule', { params: { from, to } });
  const body = resp.data as { data?: SessionView[]; meta?: { total?: number; timeZone?: string } };
  const items = Array.isArray(body?.data) ? body.data : [];
  return { items, total: body?.meta?.total ?? items.length, timeZone: body?.meta?.timeZone };
}

/** `GET /sessions/:id/history` */
export async function fetchSessionHistory(sessionId: number): Promise<SessionChangeEntry[]> {
  const resp = await apiClient.get(`/sessions/${sessionId}/history`);
  const body = resp.data as { data?: SessionChangeEntry[] };
  return Array.isArray(body?.data) ? body.data : [];
}

/** `GET /reports/teaching-hours?from=&to=` */
export async function fetchTeachingHours(
  from: string,
  to: string,
): Promise<{
  items: TeachingHoursRow[];
  meta: { totalMinutes: number; totalHours: number; timeZone?: string };
}> {
  const resp = await apiClient.get('/reports/teaching-hours', { params: { from, to } });
  const body = resp.data as {
    data?: TeachingHoursRow[];
    meta?: { totalMinutes?: number; totalHours?: number; timeZone?: string };
  };
  const items = Array.isArray(body?.data) ? body.data : [];
  return {
    items,
    meta: {
      totalMinutes: body?.meta?.totalMinutes ?? 0,
      totalHours: body?.meta?.totalHours ?? 0,
      timeZone: body?.meta?.timeZone,
    },
  };
}

/** `GET /categories/rooms` */
export async function fetchRooms(branchId?: number, includeInactive = false): Promise<ApiRoom[]> {
  const resp = await apiClient.get('/categories/rooms', {
    params: { branchId, includeInactive: includeInactive ? 'true' : undefined },
  });
  return normalizeListPayload(resp.data) as ApiRoom[];
}

/** `GET /categories/courses` */
export async function fetchCourses(limit = 100): Promise<ApiCourse[]> {
  const resp = await apiClient.get('/categories/courses', { params: { limit } });
  return normalizeListPayload(resp.data) as ApiCourse[];
}

/** `GET /categories/branches` */
export async function fetchBranches(): Promise<ApiBranch[]> {
  const resp = await apiClient.get('/categories/branches');
  return normalizeListPayload(resp.data) as ApiBranch[];
}

/** `GET /users/lookup/teachers` */
export async function fetchTeachers(): Promise<ApiUserRef[]> {
  const resp = await apiClient.get('/users/lookup/teachers');
  return normalizeListPayload(resp.data) as ApiUserRef[];
}
