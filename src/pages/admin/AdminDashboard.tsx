import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { Student, AttendanceRecord, AttendanceEvent, EmailLog } from '../../types';
import { useSettings } from '../../context/SettingsContext';
import { 
  Users, 
  UserCheck, 
  Clock, 
  UserX, 
  Building2, 
  LogIn, 
  LogOut, 
  AlertTriangle, 
  QrCode, 
  Download, 
  Plus, 
  CheckCircle2, 
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  Mail
} from 'lucide-react';

interface AdminDashboardProps {
  setActiveTab: (tab: string) => void;
  onOpenRegisterStudent: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  setActiveTab,
  onOpenRegisterStudent
}) => {
  const { settings } = useSettings();

  const [students, setStudents] = useState<Student[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([]);
  const [recentEvents, setRecentEvents] = useState<AttendanceEvent[]>([]);
  const [failedEmails, setFailedEmails] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Formatted today string in school timezone
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: settings.timezone || 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  useEffect(() => {
    // 1. Listen to students
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Student));
      setStudents(list);
    });

    // 2. Listen to today's attendance rollup
    const attendanceQ = query(
      collection(db, 'attendance'),
      where('date', '==', todayStr)
    );
    const unsubAttendance = onSnapshot(attendanceQ, (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as AttendanceRecord));
      setTodayAttendance(list);
    });

    // 3. Listen to recent scan events (gate live feed)
    const eventsQ = query(
      collection(db, 'attendance_events'),
      orderBy('timestamp', 'desc'),
      limit(15)
    );
    const unsubEvents = onSnapshot(eventsQ, (snap) => {
      const list = snap.docs.map(d => d.data() as AttendanceEvent);
      setRecentEvents(list);
      setLoading(false);
    });

    // 4. Listen to failed emails
    const emailsQ = query(
      collection(db, 'email_logs'),
      where('deliveryStatus', '==', 'FAILED')
    );
    const unsubEmails = onSnapshot(emailsQ, (snap) => {
      const list = snap.docs.map(d => d.data() as EmailLog);
      setFailedEmails(list);
    });

    return () => {
      unsubStudents();
      unsubAttendance();
      unsubEvents();
      unsubEmails();
    };
  }, [todayStr]);

  // Calculations
  const totalStudents = students.length;
  const activeStudents = students.filter(s => s.status === 'ACTIVE').length;

  const presentCount = todayAttendance.filter(a => a.status === 'PRESENT').length;
  const lateCount = todayAttendance.filter(a => a.status === 'LATE').length;
  const totalAttendedToday = presentCount + lateCount;

  // Students absent = active students who haven't had an entry scan today
  const absentCount = Math.max(0, activeStudents - totalAttendedToday);

  // Total scans today
  const todayEvents = recentEvents.filter(e => e.date === todayStr);
  const entryScansCount = todayEvents.filter(e => e.eventType === 'ENTRY').length;
  const exitScansCount = todayEvents.filter(e => e.eventType === 'EXIT').length;

  // Currently Inside School:
  // For each student with today's attendance, if exitCount < entryCount, or last recorded event was ENTRY
  const insideSchoolCount = todayAttendance.filter(a => (a.entryCount || 0) > (a.exitCount || 0)).length;

  const attendanceRate = activeStudents > 0 
    ? Math.round((totalAttendedToday / activeStudents) * 100) 
    : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Welcome & Quick actions bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Campus Operations Center
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time QR tracking &amp; automated parent notifications &bull; {todayStr}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onOpenRegisterStudent}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-xs shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Register Student</span>
          </button>

          <button
            onClick={() => setActiveTab('guard-scanner')}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-xs shadow-emerald-500/20"
          >
            <QrCode className="w-4 h-4" />
            <span>Launch Gate Scanner</span>
          </button>

          <button
            onClick={() => setActiveTab('admin-reports')}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export Reports</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid (8 Cards as requested in prompt) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Students */}
        <div 
          onClick={() => setActiveTab('admin-students')}
          className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Total Enrolled</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{totalStudents}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="font-semibold text-emerald-600">{activeStudents} Active</span>
            <span>&bull; {totalStudents - activeStudents} Inactive</span>
          </div>
        </div>

        {/* Present Today */}
        <div 
          onClick={() => setActiveTab('admin-attendance')}
          className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Present Today</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-2">{presentCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            On-time gate entry before {settings.lateCutoff}
          </div>
        </div>

        {/* Late Today */}
        <div 
          onClick={() => setActiveTab('admin-attendance')}
          className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs hover:border-amber-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Late Arrivals</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 mt-2">{lateCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Arrived after {settings.lateCutoff} cutoff
          </div>
        </div>

        {/* Absent Today */}
        <div 
          onClick={() => setActiveTab('admin-attendance')}
          className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs hover:border-rose-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Absent Today</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 mt-2">{absentCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            No gate entry recorded today
          </div>
        </div>

        {/* Currently Inside School */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Inside Campus</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-700 mt-2">{insideSchoolCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Actively present on school grounds
          </div>
        </div>

        {/* Total Entry Scans */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Entry Scans</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <LogIn className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{entryScansCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Total gate entries recorded
          </div>
        </div>

        {/* Total Exit Scans */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Exit Scans</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <LogOut className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{exitScansCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Total campus departures recorded
          </div>
        </div>

        {/* Failed Email Alerts */}
        <div 
          onClick={() => setActiveTab('admin-email-logs')}
          className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs hover:border-rose-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Failed Alerts</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-black mt-2 ${failedEmails.length > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {failedEmails.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {failedEmails.length > 0 ? 'Click to inspect & retry' : '100% email delivery rate'}
          </div>
        </div>
      </div>

      {/* Middle Section: Attendance Progress & Quick Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Attendance Progress & Breakdown Card */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span>Today's Attendance Rate</span>
              </h3>
              <span className="text-xs font-bold text-blue-600">{attendanceRate}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex mb-4">
              <div 
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${activeStudents > 0 ? (presentCount / activeStudents) * 100 : 0}%` }}
                title={`Present: ${presentCount}`}
              />
              <div 
                className="bg-amber-500 h-full transition-all duration-500"
                style={{ width: `${activeStudents > 0 ? (lateCount / activeStudents) * 100 : 0}%` }}
                title={`Late: ${lateCount}`}
              />
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  On-Time (Present)
                </span>
                <span className="font-bold text-slate-900">{presentCount}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Late Arrivals (Tardy)
                </span>
                <span className="font-bold text-slate-900">{lateCount}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  Not Yet Arrived (Absent)
                </span>
                <span className="font-bold text-slate-900">{absentCount}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100">
            <div className="bg-slate-50 p-3 rounded-xl text-[11px] text-slate-600 space-y-1">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                School Schedule In Effect:
              </div>
              <div>School Open: <strong>{settings.openingTime}</strong> &bull; Cutoff: <strong>{settings.lateCutoff}</strong></div>
              <div>Dismissal: <strong>{settings.closingTime}</strong> &bull; Timezone: <strong>{settings.timezone}</strong></div>
            </div>
          </div>
        </div>

        {/* Live Attendance Stream */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Gate Activity Stream</span>
              </h3>
              <p className="text-xs text-slate-500">Real-time scan logs recorded by school security guards</p>
            </div>

            <button
              onClick={() => setActiveTab('guard-history')}
              className="text-xs text-blue-600 font-bold hover:text-blue-700 flex items-center gap-1"
            >
              <span>View All Logs</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentEvents.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No scan activity recorded today yet. Launch the Gate Scanner to start logging attendance.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto pr-1">
              {recentEvents.map((ev) => (
                <div key={ev.eventId} className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                      ev.eventType === 'ENTRY' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {ev.eventType === 'ENTRY' ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                    </div>

                    <div>
                      <div className="font-bold text-slate-900 leading-tight">
                        {ev.studentName || ev.studentId}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        ID: {ev.studentId} &bull; Guard: {ev.guardName || 'Security'}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-slate-700 font-bold">
                      {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                    <div>
                      {ev.eventType === 'ENTRY' ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ev.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {ev.status}
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                          EXIT
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Latest Enrolled Students Quick View */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recently Enrolled Students</h3>
            <p className="text-xs text-slate-500">Students with generated cryptographic QR credentials</p>
          </div>
          <button
            onClick={() => setActiveTab('admin-students')}
            className="text-xs text-blue-600 font-bold hover:text-blue-700 flex items-center gap-1"
          >
            <span>Manage All Students</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {students.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            No students registered yet. Click "Register Student" to enroll the first student.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {students.slice(0, 6).map((std) => (
              <div key={std.studentId} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    {std.firstName} {std.lastName}
                  </div>
                  <div className="text-[11px] text-blue-600 font-mono font-semibold">
                    ID: {std.studentId}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {std.gradeLevel} &bull; {std.section}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    std.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {std.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
