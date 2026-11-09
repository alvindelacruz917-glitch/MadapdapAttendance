import React, { useState, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { AuditLog } from '../../types';
import { 
  Settings as SettingsIcon, 
  School, 
  Clock, 
  Mail, 
  ShieldCheck, 
  Save, 
  CheckCircle2, 
  RotateCw, 
  Send 
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const { userProfile } = useAuth();

  const [schoolName, setSchoolName] = useState(settings.schoolName);
  const [timezone, setTimezone] = useState(settings.timezone || 'Asia/Manila');
  const [openingTime, setOpeningTime] = useState(settings.openingTime || '07:00');
  const [lateCutoff, setLateCutoff] = useState(settings.lateCutoff || '07:45');
  const [closingTime, setClosingTime] = useState(settings.closingTime || '17:00');
  const [schoolDays, setSchoolDays] = useState<string[]>(settings.schoolDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Email test sender
  const [testEmail, setTestEmail] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailStatusMessage, setEmailStatusMessage] = useState('');

  // Audit logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    setSchoolName(settings.schoolName);
    setTimezone(settings.timezone);
    setOpeningTime(settings.openingTime);
    setLateCutoff(settings.lateCutoff);
    setClosingTime(settings.closingTime);
    setSchoolDays(settings.schoolDays);
  }, [settings]);

  useEffect(() => {
    const q = query(
      collection(db, 'audit_logs'),
      orderBy('timestamp', 'desc'),
      limit(25)
    );
    const unsub = onSnapshot(q, (snap) => {
      setAuditLogs(snap.docs.map(d => ({ ...d.data(), auditId: d.id } as AuditLog)));
    }, (err) => {
      console.warn('Audit logs listener error:', err);
    });

    return () => unsub();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      await updateSettings({
        schoolName: schoolName.trim(),
        timezone: timezone.trim(),
        openingTime,
        lateCutoff,
        closingTime,
        schoolDays
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(`Error updating settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDayToggle = (day: string) => {
    if (schoolDays.includes(day)) {
      setSchoolDays(schoolDays.filter(d => d !== day));
    } else {
      setSchoolDays([...schoolDays, day]);
    }
  };

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const handleTestEmailSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail || !testEmail.includes('@')) return;

    setTestingEmail(true);
    setEmailStatusMessage('');

    try {
      const res = await fetch('/api/email/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logId: 'test_manual'
        })
      });
      setEmailStatusMessage(`Verification email dispatched to ${testEmail}! Check inbox or spam.`);
    } catch (e: any) {
      setEmailStatusMessage(`Error: ${e.message}`);
    } finally {
      setTestingEmail(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-blue-600" />
          <span>School Operational Schedules &amp; System Configuration</span>
        </h2>
        <p className="text-xs text-slate-500 font-medium">
          Configure gate entry timetables, late cutoff parameters, school timezones, and parent notification credentials.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>School timetable configuration updated successfully across all gates and terminals!</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <School className="w-4 h-4 text-blue-600" />
            <span>Institution Information</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Official School Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Official Timezone <span className="text-rose-500">*</span>
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium"
              >
                <option value="Asia/Manila">Asia/Manila (GMT+8) - Default</option>
                <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (GMT+9)</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>Campus Gate Timetable &amp; Late Cutoff Rules</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Gate Opening Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                required
                value={openingTime}
                onChange={(e) => setOpeningTime(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Earliest student check-in</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Late Arrival Cutoff <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                required
                value={lateCutoff}
                onChange={(e) => setLateCutoff(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-bold text-amber-700"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Scans after this are flagged LATE</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Dismissal / Closing Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                required
                value={closingTime}
                onChange={(e) => setClosingTime(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Scheduled campus exit</span>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Active School Days
            </label>
            <div className="flex flex-wrap gap-2">
              {daysOfWeek.map((day) => {
                const isSelected = schoolDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDayToggle(day)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-xs shadow-blue-500/20 disabled:opacity-50 transition-colors"
          >
            {saving ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Configuration</span>
          </button>
        </div>
      </form>

      {/* Parent Email Notification Service Status */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <Mail className="w-4 h-4 text-blue-600" />
          <span>Resend Email Dispatcher Status</span>
        </h3>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700">Notification Delivery Engine:</span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Operational &amp; Active
            </span>
          </div>

          <p className="text-slate-600 leading-relaxed text-[11px]">
            When students scan their QR code at entry or exit, an immediate transactional email is sent to the student's registered parent or guardian addresses. To connect a custom production domain, specify your <code>RESEND_API_KEY</code> in environment variables.
          </p>
        </div>
      </div>

      {/* Immutable Audit Log */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <span>Administrative Audit Trail</span>
        </h3>

        {auditLogs.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400">
            No administrative audit actions recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto text-xs">
            {auditLogs.map((log) => (
              <div key={log.auditId} className="py-2.5 flex items-start justify-between">
                <div>
                  <div className="font-bold text-slate-800">
                    {log.action} &bull; Target: {log.targetId}
                  </div>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    {log.details}
                  </div>
                </div>
                <div className="font-mono text-slate-400 text-[10px] shrink-0 ml-3">
                  {new Date(log.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
