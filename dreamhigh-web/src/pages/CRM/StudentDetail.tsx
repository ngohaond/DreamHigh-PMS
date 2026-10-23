import React, { useMemo, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  Award,
  Banknote,
  CalendarDays,
  Clock,
  Download,
  MessageSquare,
  Receipt,
  Share2,
  Smartphone,
  X,
} from 'lucide-react';
import { Button } from '../../design-system/components/ui/Button';
import { Card } from '../../design-system/components/ui/Card';
import { TextArea } from '../../design-system/components/ui/Input';
import type { AdminMessage } from '../../types/adminSystem';
import type { CrmStudent, PaymentRecord } from '../../types/crmStudent';
import {
  getCoursePaymentStatusClass,
  getCrmStudentStatusClass,
  getPaymentPeriodStatusClass,
} from '../../utils/crmStudentUi';
import NotificationPortal from '../Admin/system/NotificationPortal';
import { getIcon } from '../Admin/system/adminSystemIcons';

export interface StudentDetailProps {
  student: CrmStudent;
  onBack: () => void;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

const StudentDetail: React.FC<StudentDetailProps> = ({ student, onBack }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'academic' | 'finance'>('profile');
  const [message, setMessage] = useState<AdminMessage | null>(null);
  const initialFinance = useMemo(
    () => student.courses.find((c) => c.isCurrent) || (student.courses.length > 0 ? student.courses[0] : null),
    [student.courses],
  );
  const [selectedFinanceKey, setSelectedFinanceKey] = useState<{ studentId: string; courseId: string } | null>(null);
  const selectedCourseFinance = selectedFinanceKey?.studentId === student.id
    ? student.courses.find((course) => course.courseId === selectedFinanceKey.courseId) ?? initialFinance
    : initialFinance;
  const [notificationPeriod, setNotificationPeriod] = useState<PaymentRecord | null>(null);

  const generateNoticeText = () => {
    if (!notificationPeriod || !selectedCourseFinance) return '';
    return `Kính gửi phụ huynh em ${student.studentName},

Trung tâm Dream High xin thông báo đến hạn thanh toán học phí cho em.
- Khóa học: ${selectedCourseFinance.courseName}
- Đợt thanh toán: ${notificationPeriod.periodName}
- Số tiền: ${formatCurrency(notificationPeriod.amount)}
- Hạn thanh toán: ${notificationPeriod.deadline || 'Sớm nhất có thể'}

Quý phụ huynh vui lòng thanh toán qua:
STK: 123456789 - Ngân hàng VCB
Chủ TK: Dream High Center
Nội dung: ${student.studentCode} - HP ${notificationPeriod.periodName}

Trân trọng!`;
  };

  return (
    <div className="animate-fade-in space-y-6">
      <NotificationPortal message={message} onClose={() => setMessage(null)} />

      <Card className="flex flex-wrap items-center justify-between gap-4 p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="rounded-full p-2 text-midnight/45 transition-colors hover:bg-midnight/5"
            aria-label="Quay lại"
          >
            <span className="inline-block rotate-180">{getIcon('ChevronRight', 24)}</span>
          </button>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gold font-headline text-2xl italic text-midnight">
              {student.studentName.charAt(0)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-headline text-2xl italic text-midnight">{student.studentName}</h2>
                <span
                  className={`rounded-full border px-2 py-0.5 font-label text-[10px] font-semibold uppercase tracking-widest ${getCrmStudentStatusClass(student.status)}`}
                >
                  {student.status}
                </span>
              </div>
              <p className="font-body text-sm text-midnight/50">
                Mã: {student.studentCode} · Gia nhập: {student.createdAt}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" className="text-xs">
            In thẻ học viên
          </Button>
          <Button type="button" className="text-xs">
            Nhắn phụ huynh (mock)
          </Button>
        </div>
      </Card>

      <nav className="flex flex-wrap gap-6 border-b border-midnight/15 px-2">
        {(
          [
            ['profile', 'Hồ sơ & Bảo lưu'],
            ['academic', 'Đào tạo & Chứng chỉ'],
            ['finance', 'Tài chính chi tiết'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`relative pb-4 font-label text-xs font-semibold uppercase tracking-widest transition-colors ${
              activeTab === id ? 'text-gold' : 'text-midnight/40 hover:text-midnight/65'
            }`}
          >
            {label}
            {activeTab === id ? <span className="absolute bottom-0 left-0 h-1 w-full rounded-t-full bg-gold" /> : null}
          </button>
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {activeTab === 'profile' && (
          <>
            <div className="space-y-6 lg:col-span-2">
              <Card className="space-y-8 p-8 shadow-sm animate-fade-in">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-midnight/10 pb-4">
                  <h3 className="font-label text-sm font-semibold uppercase tracking-widest text-midnight">
                    Thông tin cá nhân &amp; lộ trình
                  </h3>
                  <span className="rounded bg-midnight/5 px-2 py-0.5 font-label text-[10px] font-semibold text-midnight/50">
                    Nhập học: {student.entryDate}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                  <ProfileItem icon={getIcon('Users', 20)} label="Tên phụ huynh" value={student.parentName} />
                  <ProfileItem icon={getIcon('Phone', 20)} label="Số điện thoại" value={student.phone} />
                  <ProfileItem icon={getIcon('GraduationCap', 20)} label="Cấp độ nhập học" value={student.entryLevel} />
                  <ProfileItem icon={<Award size={20} strokeWidth={2} className="text-gold" aria-hidden />} label="Cấp độ hiện tại" value={student.currentLevel} />
                  <ProfileItem icon={getIcon('Mail', 20)} label="Email" value={student.email || 'Chưa cập nhật'} />
                  <ProfileItem icon={<CalendarDays size={20} strokeWidth={2} className="text-gold" aria-hidden />} label="Ngày sinh" value={student.birthday || 'Chưa cập nhật'} />
                  <div className="sm:col-span-2">
                    <ProfileItem icon={getIcon('MapPin', 20)} label="Địa chỉ" value={student.address || 'Chưa cập nhật'} />
                  </div>
                </div>
              </Card>

              {student.status === 'Bảo lưu' && (
                <Card className="flex animate-fade-in items-center gap-6 border border-warning/25 bg-warning-bg p-6">
                  <div className="rounded-2xl bg-surface p-4 text-warning shadow-sm">
                    <Clock size={32} strokeWidth={2} aria-hidden />
                  </div>
                  <div>
                    <h4 className="font-label text-xs font-semibold uppercase tracking-widest text-warning">Thời gian bảo lưu</h4>
                    <p className="mt-1 font-headline text-lg italic text-midnight">
                      Từ: <span className="text-midnight">{student.reservationFrom}</span>
                      <span className="mx-3 text-warning/50">→</span>
                      Đến: <span className="text-midnight">{student.reservationTo}</span>
                    </p>
                  </div>
                </Card>
              )}
            </div>
            <Card className="relative overflow-hidden bg-midnight p-8 text-white shadow-xl animate-fade-in">
              <div className="pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-gold/20 blur-xl" />
              <h4 className="relative z-10 mb-4 font-label text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">Ghi chú quản lý</h4>
              <div className="relative z-10 min-h-[100px] rounded-2xl border border-white/10 bg-white/5 p-4 font-body text-sm italic leading-relaxed text-white/70">
                {student.notes || 'Không có ghi chú.'}
              </div>
            </Card>
          </>
        )}

        {activeTab === 'academic' && (
          <div className="space-y-6 lg:col-span-3 animate-fade-in">
            <Card className="overflow-hidden p-0 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-midnight/10 bg-midnight/[0.02] p-6">
                <h3 className="font-label font-semibold uppercase tracking-tight text-midnight">Chứng chỉ đạt được</h3>
                <span className="font-label text-xs font-semibold uppercase text-gold">{student.certificates.length} chứng chỉ</span>
              </div>
              <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
                {student.certificates.length > 0 ? (
                  student.certificates.map((cert) => (
                    <Card key={cert.id} className="group flex items-center gap-4 border border-midnight/10 p-4 shadow-sm transition-colors hover:border-gold/35">
                      <div className="rounded-xl bg-gold/15 p-3 text-gold transition-colors group-hover:bg-gold group-hover:text-midnight">
                        <Award size={24} strokeWidth={2} aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-body text-sm font-semibold text-midnight">{cert.name}</p>
                        <p className="mt-0.5 font-label text-[10px] font-semibold text-midnight/45">Ngày cấp: {cert.issueDate}</p>
                      </div>
                      <button type="button" className="text-midnight/30 transition-colors hover:text-gold" title="Tải">
                        <Download size={18} strokeWidth={2} aria-hidden />
                      </button>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-full flex flex-col items-center py-12 opacity-35">
                    <AlertCircle size={48} strokeWidth={1.25} aria-hidden />
                    <p className="mt-4 font-label text-sm font-semibold uppercase text-midnight">Chưa có chứng chỉ</p>
                  </div>
                )}
              </div>
            </Card>

            <Card className="overflow-hidden p-0 shadow-sm">
              <div className="border-b border-midnight/10 bg-midnight/[0.02] p-6">
                <h3 className="font-label font-semibold uppercase tracking-tight text-midnight">Lịch sử đào tạo</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-midnight/[0.03]">
                      <th className="px-6 py-4 font-label text-[10px] font-semibold uppercase tracking-widest text-gold">Ngày ghi danh</th>
                      <th className="px-6 py-4 font-label text-[10px] font-semibold uppercase tracking-widest text-gold">Khóa học</th>
                      <th className="px-6 py-4 text-center font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
                        Điểm CK
                      </th>
                      <th className="px-6 py-4 font-label text-[10px] font-semibold uppercase tracking-widest text-gold">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-midnight/5">
                    {student.courses.map((c, i) => (
                      <tr key={`${c.courseId}-${i}`} className={c.isCurrent ? 'bg-gold/5' : ''}>
                        <td className="px-6 py-4 font-body text-xs font-semibold text-midnight/60">{c.enrollmentDate}</td>
                        <td className="px-6 py-4">
                          <p className="font-body text-sm font-semibold text-midnight">{c.courseName}</p>
                          {c.isCurrent ? (
                            <span className="mt-0.5 inline-block animate-pulse font-label text-[9px] font-semibold uppercase tracking-widest text-gold">
                              Đang học
                            </span>
                          ) : null}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {c.finalScore != null ? (
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-midnight font-label text-xs font-semibold text-gold">
                              {c.finalScore}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`rounded-lg px-2 py-1 font-label text-[9px] font-semibold uppercase tracking-widest ${
                              c.isCurrent ? 'bg-success-bg text-success' : 'bg-midnight/5 text-midnight/50'
                            }`}
                          >
                            {c.isCurrent ? 'Active' : 'Completed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'finance' && (
          <div className="space-y-8 lg:col-span-3 animate-fade-in">
            <Card className="overflow-hidden p-0 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-midnight p-6 text-white">
                <h3 className="flex items-center gap-2 font-label text-sm font-semibold uppercase tracking-widest">
                  <Receipt size={18} strokeWidth={2} aria-hidden />
                  Tiến độ học phí &amp; ưu đãi
                </h3>
                <Button type="button" variant="secondary" className="bg-white/10 px-3 py-1 text-[10px] text-white hover:bg-white hover:text-midnight">
                  Sao kê (mock)
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-midnight/10 bg-midnight/5">
                      <th className="px-6 py-4 font-label text-[10px] font-semibold uppercase tracking-widest text-gold">Khóa học</th>
                      <th className="px-6 py-4 text-right font-label text-[10px] font-semibold uppercase tracking-widest text-gold">Học phí gốc</th>
                      <th className="px-6 py-4 text-right font-label text-[10px] font-semibold uppercase tracking-widest text-gold">Ưu đãi</th>
                      <th className="px-6 py-4 text-right font-label text-[10px] font-semibold uppercase tracking-widest text-gold">Sau ưu đãi</th>
                      <th className="px-6 py-4 text-center font-label text-[10px] font-semibold uppercase tracking-widest text-gold">Tiến độ</th>
                      <th className="px-6 py-4 text-center font-label text-[10px] font-semibold uppercase tracking-widest text-gold">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-midnight/5">
                    {student.courses.map((c, i) => {
                      const paidCount = c.paymentHistory?.filter((p) => p.status === 'Đã đóng').length || 0;
                      const totalCount = c.totalPeriods || 1;
                      const progressPercent = Math.round((paidCount / totalCount) * 100);
                      return (
                        <tr
                          key={`${c.courseId}-fin-${i}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedFinanceKey({ studentId: student.id, courseId: c.courseId })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedFinanceKey({ studentId: student.id, courseId: c.courseId });
                            }
                          }}
                          className={`cursor-pointer transition-colors hover:bg-gold/5 ${
                            selectedCourseFinance?.courseId === c.courseId ? 'bg-gold/10' : ''
                          }`}
                        >
                          <td className="px-6 py-5">
                            <p className="flex items-center gap-2 font-body text-sm font-semibold text-midnight">
                              {c.courseName}
                              {c.isCurrent ? <span className="h-2 w-2 animate-pulse rounded-full bg-gold" aria-hidden /> : null}
                            </p>
                            <p className="mt-1 font-label text-[10px] font-semibold uppercase text-midnight/45">
                              Ghi danh: {c.enrollmentDate}
                            </p>
                          </td>
                          <td className="px-6 py-5 text-right font-body text-sm font-semibold text-midnight/60">{formatCurrency(c.originalFee)}</td>
                          <td className="px-6 py-5 text-right">
                            <p className="font-body text-xs font-semibold text-info">-{formatCurrency(c.discountAmount)}</p>
                            <p className="mt-0.5 font-label text-[9px] font-semibold italic uppercase text-midnight/45">{c.scholarship}</p>
                          </td>
                          <td className="px-6 py-5 text-right font-body text-sm font-semibold text-gold">{formatCurrency(c.finalFee)}</td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col items-center gap-1">
                              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-midnight/10">
                                <div className="h-full bg-gold" style={{ width: `${progressPercent}%` }} />
                              </div>
                              <span className="font-label text-[9px] font-semibold uppercase text-midnight/50">
                                {paidCount}/{totalCount} kỳ
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <span
                              className={`rounded-full border px-3 py-1 font-label text-[9px] font-semibold uppercase tracking-widest ${getCoursePaymentStatusClass(c.paymentStatus)}`}
                            >
                              {c.paymentStatus}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {selectedCourseFinance && (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 animate-fade-in">
                <div className="space-y-6 xl:col-span-1">
                  <Card className="relative overflow-hidden p-6 shadow-sm">
                    <div className="pointer-events-none absolute right-0 top-0 p-4 opacity-5">
                      <Banknote size={80} strokeWidth={1.25} aria-hidden />
                    </div>
                    <h4 className="mb-4 font-label text-[10px] font-semibold uppercase tracking-widest text-midnight/45">
                      Thông tin kỳ thanh toán
                    </h4>
                    <h3 className="mb-6 font-headline text-lg italic text-midnight">{selectedCourseFinance.courseName}</h3>
                    <div className="space-y-4 font-body text-xs">
                      <div className="flex justify-between">
                        <span className="font-label font-semibold uppercase tracking-tight text-midnight/45">Số kỳ</span>
                        <span className="font-semibold text-midnight">{selectedCourseFinance.totalPeriods} kỳ</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-label font-semibold uppercase tracking-tight text-midnight/45">Mỗi kỳ</span>
                        <span className="font-semibold text-gold">{formatCurrency(selectedCourseFinance.amountPerPeriod)}</span>
                      </div>
                      <div className="border-t border-midnight/10 pt-3">
                        <div className="flex justify-between">
                          <span className="font-label font-semibold uppercase tracking-tight text-midnight/45">Đã thanh toán</span>
                          <span className="font-semibold text-success">
                            {formatCurrency(
                              selectedCourseFinance.paymentHistory
                                ?.filter((p) => p.status === 'Đã đóng')
                                .reduce((acc, curr) => acc + curr.amount, 0) || 0,
                            )}
                          </span>
                        </div>
                        <div className="mt-2 flex justify-between">
                          <span className="font-label font-semibold uppercase tracking-tight text-midnight/45">Còn phải đóng</span>
                          <span className="font-semibold text-error">
                            {formatCurrency(
                              selectedCourseFinance.finalFee -
                                (selectedCourseFinance.paymentHistory
                                  ?.filter((p) => p.status === 'Đã đóng')
                                  .reduce((acc, curr) => acc + curr.amount, 0) || 0),
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-8 rounded-2xl border border-midnight/10 bg-midnight/[0.02] p-4">
                      <p className="mb-3 font-label text-[9px] font-semibold uppercase tracking-widest text-midnight/45">
                        Thông báo đóng tiền
                      </p>
                      <Button
                        type="button"
                        className="w-full gap-2 text-[10px]"
                        onClick={() => {
                          const unpaid = selectedCourseFinance.paymentHistory?.find((p) => p.status !== 'Đã đóng');
                          if (unpaid) setNotificationPeriod(unpaid);
                        }}
                      >
                        Soạn thông báo kỳ tiếp theo
                      </Button>
                    </div>
                  </Card>
                </div>

                <Card className="flex flex-col overflow-hidden p-0 shadow-sm xl:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-midnight/10 p-5">
                    <h4 className="font-label text-[10px] font-semibold uppercase tracking-widest text-midnight/45">
                      Kế hoạch đóng phí chi tiết
                    </h4>
                    <span className="font-label text-[9px] font-semibold uppercase tracking-widest text-gold">Mock — chưa gửi Zalo</span>
                  </div>
                  <div className="flex-1 overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-midnight/[0.02]">
                          <th className="px-6 py-3 font-label text-[10px] font-semibold uppercase tracking-widest text-gold">Kỳ</th>
                          <th className="px-6 py-3 text-right font-label text-[10px] font-semibold uppercase tracking-widest text-gold">Số tiền</th>
                          <th className="px-6 py-3 text-center font-label text-[10px] font-semibold uppercase tracking-widest text-gold">Hạn</th>
                          <th className="px-6 py-3 text-center font-label text-[10px] font-semibold uppercase tracking-widest text-gold">Trạng thái</th>
                          <th className="px-6 py-3 pr-8 text-right font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
                            Thao tác
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-midnight/5">
                        {selectedCourseFinance.paymentHistory?.map((ph) => (
                          <tr key={ph.id} className={`transition-colors hover:bg-midnight/[0.02] ${ph.status === 'Quá hạn' ? 'bg-error-bg/30' : ''}`}>
                            <td className="px-6 py-4">
                              <p className="font-body text-xs font-semibold text-midnight">{ph.periodName}</p>
                            </td>
                            <td className="px-6 py-4 text-right font-body text-xs font-semibold text-midnight">{formatCurrency(ph.amount)}</td>
                            <td className="px-6 py-4 text-center">
                              <p className={`font-body text-[10px] font-semibold ${ph.status === 'Quá hạn' ? 'text-error' : 'text-midnight/55'}`}>
                                {ph.deadline || '—'}
                              </p>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span
                                className={`rounded-lg border px-2 py-0.5 font-label text-[8px] font-semibold uppercase tracking-widest ${getPaymentPeriodStatusClass(ph.status)}`}
                              >
                                {ph.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 pr-8 text-right">
                              <div className="flex justify-end gap-2">
                                {ph.status !== 'Đã đóng' ? (
                                  <button
                                    type="button"
                                    onClick={() => setNotificationPeriod(ph)}
                                    className="rounded-lg p-1.5 text-gold transition-colors hover:bg-gold/15"
                                    title="Soạn thông báo"
                                  >
                                    <MessageSquare size={16} strokeWidth={2} aria-hidden />
                                  </button>
                                ) : null}
                                <button type="button" className="rounded-lg p-1.5 text-midnight/30 transition-colors hover:text-gold" title="Biên lai">
                                  <Receipt size={16} strokeWidth={2} aria-hidden />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>

      {notificationPeriod && selectedCourseFinance ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-midnight/60 p-4 backdrop-blur-md">
          <Card className="max-h-[90vh] w-full max-w-xl overflow-hidden p-0 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between bg-midnight px-6 py-5">
              <h2 className="font-label text-base font-semibold uppercase tracking-tight text-white">Soạn thông báo đóng phí</h2>
              <button
                type="button"
                onClick={() => setNotificationPeriod(null)}
                className="rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white"
                aria-label="Đóng"
              >
                <X size={24} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <div className="space-y-6 p-8">
              <div className="flex items-center gap-4 rounded-2xl border border-gold/25 bg-gold/5 p-4">
                <div className="rounded-xl bg-gold p-3 text-midnight shadow-md">
                  <Smartphone size={24} strokeWidth={2} aria-hidden />
                </div>
                <div>
                  <p className="font-label text-[10px] font-semibold uppercase tracking-widest text-midnight/45">Nội dung cho</p>
                  <p className="font-body text-sm font-semibold text-midnight">
                    {notificationPeriod.periodName} — {student.studentName}
                  </p>
                </div>
              </div>
              <TextArea readOnly rows={12} className="font-mono text-sm text-midnight/80" value={generateNoticeText()} />
              <div className="grid grid-cols-2 gap-4 border-t border-midnight/10 pt-6">
                <Button type="button" variant="ghost" className="py-4" onClick={() => setNotificationPeriod(null)}>
                  Hủy
                </Button>
                <Button
                  type="button"
                  className="gap-2 py-4"
                  onClick={() => {
                    setNotificationPeriod(null);
                    setMessage({ code: 'PAY-NOTI', text: 'Đã gửi thông báo đóng phí (mock).', type: 'success' });
                  }}
                >
                  <Share2 size={18} strokeWidth={2} aria-hidden />
                  Gửi thông báo
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
};

const ProfileItem: React.FC<{ icon: ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-start gap-4">
    <div className="shrink-0 rounded-2xl bg-midnight/5 p-3 text-gold shadow-sm">{icon}</div>
    <div className="min-w-0">
      <p className="mb-1 font-label text-[10px] font-semibold uppercase tracking-wider text-midnight/45">{label}</p>
      <p className="font-body text-sm font-semibold leading-tight text-midnight">{value}</p>
    </div>
  </div>
);

export default StudentDetail;
