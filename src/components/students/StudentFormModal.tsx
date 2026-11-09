import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Student, Guardian } from '../../types';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc,
  updateDoc 
} from 'firebase/firestore';
import { generateQrDataUrl, downloadDataUrl } from '../../utils/qr';
import { 
  QrCode, 
  Download, 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  UserPlus, 
  Trash2, 
  Plus, 
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';

interface StudentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (student: Student, rawToken?: string) => void;
  studentToEdit?: Student | null;
}

export const StudentFormModal: React.FC<StudentFormModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  studentToEdit
}) => {
  const { userProfile } = useAuth();
  const { settings } = useSettings();

  // Student Fields
  const [studentId, setStudentId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gradeLevel, setGradeLevel] = useState('Grade 10');
  const [section, setSection] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

  // Guardian Fields (Supports multiple guardians)
  const [guardians, setGuardians] = useState<Array<{ fullName: string; email: string; notificationsEnabled: boolean; guardianId?: string }>>([
    { fullName: '', email: '', notificationsEnabled: true }
  ]);

  // Submission & Post-registration state
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successResult, setSuccessResult] = useState<{
    student: Student;
    rawToken: string;
    qrDataUrl: string;
  } | null>(null);

  useEffect(() => {
    if (studentToEdit) {
      setStudentId(studentToEdit.studentId);
      setFirstName(studentToEdit.firstName);
      setMiddleName(studentToEdit.middleName || '');
      setLastName(studentToEdit.lastName);
      setGradeLevel(studentToEdit.gradeLevel);
      setSection(studentToEdit.section);
      setStatus(studentToEdit.status);

      // Fetch guardians
      const loadGuardians = async () => {
        if (studentToEdit.guardianIds && studentToEdit.guardianIds.length > 0) {
          const list: any[] = [];
          for (const gId of studentToEdit.guardianIds) {
            try {
              const gSnap = await getDoc(doc(db, 'guardians', gId));
              if (gSnap.exists()) {
                const gData = gSnap.data();
                list.push({
                  fullName: gData.fullName,
                  email: gData.email,
                  notificationsEnabled: gData.notificationsEnabled ?? true,
                  guardianId: gSnap.id
                });
              }
            } catch (e) {
              console.warn(e);
            }
          }
          if (list.length > 0) {
            setGuardians(list);
          }
        }
      };
      loadGuardians();
    } else {
      // Reset form with unique student ID suggestion
      const randomNum = Math.floor(100 + Math.random() * 900);
      setStudentId(`2026-${randomNum}`);
      setFirstName('');
      setMiddleName('');
      setLastName('');
      setGradeLevel('Grade 10');
      setSection('Emerald-A');
      setStatus('ACTIVE');
      setGuardians([{ fullName: '', email: '', notificationsEnabled: true }]);
      setSuccessResult(null);
      setErrorMessage('');
    }
  }, [studentToEdit, isOpen]);

  const handleAddGuardian = () => {
    if (guardians.length >= 3) return;
    setGuardians([...guardians, { fullName: '', email: '', notificationsEnabled: true }]);
  };

  const handleRemoveGuardian = (index: number) => {
    if (guardians.length === 1) return;
    setGuardians(guardians.filter((_, i) => i !== index));
  };

  const handleGuardianChange = (index: number, field: string, value: any) => {
    const updated = [...guardians];
    updated[index] = { ...updated[index], [field]: value };
    setGuardians(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSubmitting(true);

    try {
      const cleanStudentId = studentId.trim();
      const cleanFirstName = firstName.trim();
      const cleanLastName = lastName.trim();

      if (!cleanStudentId || !cleanFirstName || !cleanLastName || !section.trim()) {
        throw new Error('Please fill in all required student details.');
      }

      // Check guardian email
      for (let i = 0; i < guardians.length; i++) {
        const g = guardians[i];
        if (!g.fullName.trim() || !g.email.trim()) {
          throw new Error(`Please complete all fields for Guardian #${i + 1}`);
        }
        if (!g.email.includes('@') || !g.email.includes('.')) {
          throw new Error(`Invalid email address for Guardian #${i + 1}: ${g.email}`);
        }
      }

      // 1. Check duplicate student ID if creating new student
      if (!studentToEdit) {
        const checkQuery = query(
          collection(db, 'students'),
          where('studentId', '==', cleanStudentId)
        );
        const existingDocs = await getDocs(checkQuery);
        if (!existingDocs.empty) {
          throw new Error(`Student ID "${cleanStudentId}" already exists. Please choose a unique ID.`);
        }
      }

      let rawToken = '';
      let tokenHash = studentToEdit?.qrTokenHash || '';

      // 2. Generate cryptographically random token if new student
      if (!studentToEdit || !tokenHash) {
        const tokenRes = await fetch('/api/qr/generate-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        if (!tokenRes.ok) {
          throw new Error('Failed to generate cryptographic QR token from backend.');
        }
        const tokenData = await tokenRes.json();
        rawToken = tokenData.token;
        tokenHash = tokenData.tokenHash;
      }

      // 3. Save / Update Guardians
      const guardianIdList: string[] = [];
      const timestamp = new Date().toISOString();

      for (let i = 0; i < guardians.length; i++) {
        const g = guardians[i];
        const gId = g.guardianId || `guard_${cleanStudentId}_${i + 1}_${Date.now()}`;
        guardianIdList.push(gId);

        const guardianPayload: Guardian = {
          guardianId: gId,
          fullName: g.fullName.trim(),
          email: g.email.trim().toLowerCase(),
          studentIds: [cleanStudentId],
          emailVerified: true,
          notificationsEnabled: g.notificationsEnabled,
          createdAt: timestamp
        };

        await setDoc(doc(db, 'guardians', gId), guardianPayload, { merge: true });
      }

      // 4. Save Student
      const studentDocId = studentToEdit?.id || `std_${cleanStudentId}`;
      const studentPayload: Student = {
        studentId: cleanStudentId,
        firstName: cleanFirstName,
        middleName: middleName.trim() || undefined,
        lastName: cleanLastName,
        gradeLevel: gradeLevel.trim(),
        section: section.trim(),
        status,
        qrTokenHash: tokenHash,
        guardianIds: guardianIdList,
        createdAt: studentToEdit?.createdAt || timestamp,
        updatedAt: timestamp
      };

      await setDoc(doc(db, 'students', studentDocId), studentPayload);

      // Audit log
      try {
        await setDoc(doc(db, 'audit_logs', `audit_${Date.now()}`), {
          actorId: userProfile?.uid || 'admin',
          action: studentToEdit ? 'UPDATE_STUDENT' : 'REGISTER_STUDENT',
          targetId: cleanStudentId,
          details: `${studentToEdit ? 'Updated' : 'Registered'} student ${cleanFirstName} ${cleanLastName} with ${guardians.length} guardian(s).`,
          timestamp
        });
      } catch (err) {
        console.warn('Audit log write error:', err);
      }

      if (!studentToEdit) {
        // Generate QR image data url for immediate preview & print
        const qrUrl = await generateQrDataUrl(rawToken);
        setSuccessResult({
          student: { ...studentPayload, id: studentDocId },
          rawToken,
          qrDataUrl: qrUrl
        });
        onSaved({ ...studentPayload, id: studentDocId }, rawToken);
      } else {
        onSaved({ ...studentPayload, id: studentDocId });
        onClose();
      }

    } catch (err: any) {
      console.error('Error saving student:', err);
      setErrorMessage(err.message || 'An error occurred while saving student.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintCard = () => {
    if (!successResult) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const s = successResult.student;
    const qr = successResult.qrDataUrl;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Student ID - ${s.firstName} ${s.lastName}</title>
          <style>
            @page { size: auto; margin: 10mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background-color: #f1f5f9; }
            .card { width: 330px; height: 500px; background: white; border: 2px solid #0f172a; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1); position: relative; display: flex; flex-direction: column; text-align: center; }
            .header { background: #0f172a; color: white; padding: 18px 12px; }
            .school-name { font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
            .sub { font-size: 10px; color: #94a3b8; font-weight: 500; margin-top: 4px; }
            .avatar-box { margin-top: 16px; display: flex; justify-content: center; }
            .avatar { width: 72px; height: 72px; border-radius: 50%; background: #e2e8f0; color: #0f172a; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: bold; border: 3px solid #2563eb; }
            .student-name { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 10px; margin-bottom: 2px; }
            .student-id { font-size: 13px; font-weight: 700; color: #2563eb; font-family: monospace; }
            .details { font-size: 11px; color: #475569; margin-top: 4px; font-weight: 600; }
            .qr-container { margin: 12px auto; padding: 6px; background: white; border: 1px dashed #cbd5e1; border-radius: 10px; display: inline-block; }
            .qr-container img { width: 140px; height: 140px; display: block; }
            .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 10px; font-size: 9px; color: #64748b; margin-top: auto; }
            @media print {
              body { background: white; }
              .card { box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <div class="school-name">${settings.schoolName || 'Oakridge Academy'}</div>
              <div class="sub">OFFICIAL STUDENT IDENTIFICATION</div>
            </div>
            <div class="avatar-box">
              <div class="avatar">${s.firstName.charAt(0)}${s.lastName.charAt(0)}</div>
            </div>
            <div class="student-name">${s.firstName} ${s.lastName}</div>
            <div class="student-id">ID: ${s.studentId}</div>
            <div class="details">${s.gradeLevel} &bull; Section ${s.section}</div>
            <div class="qr-container">
              <img src="${qr}" alt="Student QR Code" />
            </div>
            <div class="footer">
              Valid for School Gate Entry &amp; Exit Recording &bull; Automated Parent Alerts
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        successResult
          ? 'Registration Successful!'
          : studentToEdit
          ? 'Edit Student Profile'
          : 'Register New Student'
      }
      description={
        successResult
          ? 'Cryptographic QR credential generated and linked to guardian email addresses.'
          : 'Enrolls student and configures automated parent attendance alerts.'
      }
      maxWidth="2xl"
    >
      {/* SUCCESS SCREEN */}
      {successResult ? (
        <div className="py-2 text-center space-y-6 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-50">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {successResult.student.firstName} {successResult.student.lastName}
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Student ID: {successResult.student.studentId} &bull; {successResult.student.gradeLevel} - {successResult.student.section}
            </p>
          </div>

          {/* QR Box */}
          <div className="inline-block p-4 bg-white border-2 border-dashed border-slate-300 rounded-2xl shadow-xs">
            <img 
              src={successResult.qrDataUrl} 
              alt="Generated Student QR" 
              className="w-48 h-48 mx-auto rounded-lg"
            />
            <div className="mt-2 text-[11px] font-semibold text-slate-500 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              Cryptographic Opaque Token (No PII in QR)
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-left text-xs text-slate-700">
            <div className="font-bold text-slate-900 mb-1">Registered Guardians &amp; Alerts:</div>
            {guardians.map((g, i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-none">
                <span>{g.fullName} ({g.email})</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
                  Alerts Enabled
                </span>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <button
              type="button"
              onClick={() => downloadDataUrl(successResult.qrDataUrl, `QR_${successResult.student.studentId}.png`)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-xs"
            >
              <Download className="w-4 h-4" />
              Download QR
            </button>
            <button
              type="button"
              onClick={handlePrintCard}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-xs shadow-blue-500/20"
            >
              <Printer className="w-4 h-4" />
              Print ID Card
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        /* REGISTRATION FORM */
        <form onSubmit={handleSubmit} className="space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* SECTION 1: STUDENT DETAILS */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-blue-600" />
              Student Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Student ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={!!studentToEdit}
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g. 2026-001"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  First Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Juan"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Middle Name <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  placeholder="e.g. Santos"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Last Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Dela Cruz"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Grade Level <span className="text-rose-500">*</span>
                </label>
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                >
                  <option value="Grade 7">Grade 7</option>
                  <option value="Grade 8">Grade 8</option>
                  <option value="Grade 9">Grade 9</option>
                  <option value="Grade 10">Grade 10</option>
                  <option value="Grade 11">Grade 11 - STEM</option>
                  <option value="Grade 11 - ABM">Grade 11 - ABM</option>
                  <option value="Grade 11 - HUMSS">Grade 11 - HUMSS</option>
                  <option value="Grade 12 - STEM">Grade 12 - STEM</option>
                  <option value="Grade 12 - ABM">Grade 12 - ABM</option>
                  <option value="Grade 12 - HUMSS">Grade 12 - HUMSS</option>
                  <option value="Grade 12 - ICT">Grade 12 - ICT</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Section <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  placeholder="e.g. Section 10-A"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Student Status
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    checked={status === 'ACTIVE'}
                    onChange={() => setStatus('ACTIVE')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>Active (Can scan &amp; enter)</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    checked={status === 'INACTIVE'}
                    onChange={() => setStatus('INACTIVE')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>Inactive (Gate access revoked)</span>
                </label>
              </div>
            </div>
          </div>

          {/* SECTION 2: PARENT / GUARDIAN INFORMATION */}
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Registered Parent / Guardians (For Real-time Email Alerts)
              </h4>
              {guardians.length < 3 && (
                <button
                  type="button"
                  onClick={handleAddGuardian}
                  className="text-xs text-blue-600 font-bold flex items-center gap-1 hover:text-blue-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Another Guardian
                </button>
              )}
            </div>

            <div className="space-y-3">
              {guardians.map((guardian, index) => (
                <div
                  key={index}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 relative group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-500">
                      Guardian #{index + 1} {index === 0 ? '(Primary Recipient)' : ''}
                    </span>
                    {guardians.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveGuardian(index)}
                        className="text-rose-500 hover:text-rose-700 text-xs p-1 rounded transition-colors"
                        title="Remove guardian"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={guardian.fullName}
                        onChange={(e) => handleGuardianChange(index, 'fullName', e.target.value)}
                        placeholder="e.g. Maria Dela Cruz"
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Email Address <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={guardian.email}
                        onChange={(e) => handleGuardianChange(index, 'email', e.target.value)}
                        placeholder="e.g. parent@gmail.com"
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                      />
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={guardian.notificationsEnabled}
                        onChange={(e) => handleGuardianChange(index, 'notificationsEnabled', e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Send automatic entry and exit email notifications</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form Actions */}
          <div className="border-t border-slate-100 pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-xs shadow-blue-500/20 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <QrCode className="w-4 h-4" />
                  <span>{studentToEdit ? 'Save Changes' : 'Register & Generate QR'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
