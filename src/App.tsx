import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { ToastContainer, ToastMessage } from './components/ui/Toast';

// Modals
import { StudentFormModal } from './components/students/StudentFormModal';
import { StudentIdCardModal } from './components/students/StudentIdCardModal';
import { CsvImportModal } from './components/students/CsvImportModal';
import { QrRegenerateModal } from './components/students/QrRegenerateModal';
import { AttendanceCorrectionModal } from './components/attendance/AttendanceCorrectionModal';

// Pages
import { Login } from './pages/Login';
import { GuardScanner } from './pages/guard/GuardScanner';
import { GuardHistory } from './pages/guard/GuardHistory';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { StudentManagement } from './pages/admin/StudentManagement';
import { GuardianManagement } from './pages/admin/GuardianManagement';
import { QRCodes } from './pages/admin/QRCodes';
import { AttendanceManagement } from './pages/admin/AttendanceManagement';
import { Reports } from './pages/admin/Reports';
import { UserManagement } from './pages/admin/UserManagement';
import { EmailLogs } from './pages/admin/EmailLogs';
import { Settings } from './pages/admin/Settings';

import { Student, AttendanceRecord } from './types';
import { RefreshCw } from 'lucide-react';

function AppContent() {
  const { userProfile, role, loading, isAdmin } = useAuth();

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<string>('admin-dashboard');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Modals state
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);

  const [idCardStudent, setIdCardStudent] = useState<Student | null>(null);
  const [idCardRawToken, setIdCardRawToken] = useState<string | undefined>(undefined);

  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [regenerateStudent, setRegenerateStudent] = useState<Student | null>(null);
  const [correctionRecord, setCorrectionRecord] = useState<AttendanceRecord | null>(null);

  // Toast messages
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: ToastMessage['type'], title: string, message?: string) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // If loading auth
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
        <p className="text-xs font-semibold text-slate-400">Loading Secure Campus Portal...</p>
      </div>
    );
  }

  // If unauthenticated, show Login
  if (!userProfile) {
    return <Login />;
  }

  // Guard role default route
  const effectiveTab = (!isAdmin && activeTab.startsWith('admin-')) ? 'guard-scanner' : activeTab;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Sidebar
        activeTab={effectiveTab}
        setActiveTab={setActiveTab}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Wrapper with Sidebar Offset */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        <Navbar
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          activeTab={effectiveTab}
          setActiveTab={setActiveTab}
        />

        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          {/* TAB ROUTING */}
          {effectiveTab === 'admin-dashboard' && (
            <AdminDashboard
              setActiveTab={setActiveTab}
              onOpenRegisterStudent={() => {
                setStudentToEdit(null);
                setIsRegisterOpen(true);
              }}
            />
          )}

          {effectiveTab === 'admin-students' && (
            <StudentManagement
              onOpenRegister={() => {
                setStudentToEdit(null);
                setIsRegisterOpen(true);
              }}
              onOpenCsvImport={() => setIsCsvImportOpen(true)}
              onSelectStudentForCard={(std) => {
                setIdCardStudent(std);
                setIdCardRawToken(undefined);
              }}
              onSelectStudentForEdit={(std) => {
                setStudentToEdit(std);
                setIsRegisterOpen(true);
              }}
              onSelectStudentForRegenerate={(std) => {
                setRegenerateStudent(std);
              }}
            />
          )}

          {effectiveTab === 'admin-guardians' && <GuardianManagement />}

          {effectiveTab === 'admin-qr-codes' && (
            <QRCodes
              onSelectStudentForCard={(std) => {
                setIdCardStudent(std);
                setIdCardRawToken(undefined);
              }}
              onSelectStudentForRegenerate={(std) => {
                setRegenerateStudent(std);
              }}
            />
          )}

          {effectiveTab === 'admin-attendance' && (
            <AttendanceManagement
              onOpenCorrection={(rec) => setCorrectionRecord(rec)}
            />
          )}

          {effectiveTab === 'admin-reports' && <Reports />}

          {effectiveTab === 'admin-users' && <UserManagement />}

          {effectiveTab === 'admin-email-logs' && <EmailLogs />}

          {effectiveTab === 'admin-settings' && <Settings />}

          {/* GUARD TABS */}
          {effectiveTab === 'guard-scanner' && <GuardScanner />}

          {effectiveTab === 'guard-history' && <GuardHistory />}
        </main>
      </div>

      {/* MODALS */}
      {/* 1. Student Registration & Edit Modal */}
      <StudentFormModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        studentToEdit={studentToEdit}
        onSaved={(savedStudent, rawToken) => {
          if (rawToken) {
            setIdCardStudent(savedStudent);
            setIdCardRawToken(rawToken);
          }
          addToast(
            'success',
            studentToEdit ? 'Student Updated' : 'Student Registered',
            `${savedStudent.firstName} ${savedStudent.lastName}'s profile is active.`
          );
        }}
      />

      {/* 2. Student ID Card Print Modal */}
      <StudentIdCardModal
        isOpen={!!idCardStudent}
        onClose={() => {
          setIdCardStudent(null);
          setIdCardRawToken(undefined);
        }}
        student={idCardStudent}
        rawToken={idCardRawToken}
      />

      {/* 3. CSV Import Modal */}
      <CsvImportModal
        isOpen={isCsvImportOpen}
        onClose={() => setIsCsvImportOpen(false)}
        onImportComplete={(count) => {
          addToast('success', 'Batch Import Complete', `Successfully imported ${count} students with cryptographic QR codes.`);
        }}
      />

      {/* 4. QR Code Regeneration Modal */}
      <QrRegenerateModal
        isOpen={!!regenerateStudent}
        onClose={() => setRegenerateStudent(null)}
        student={regenerateStudent}
        onRegenerated={(updated) => {
          addToast('success', 'QR Credential Rotated', `Generated replacement cryptographic QR token for ${updated.firstName} ${updated.lastName}.`);
        }}
      />

      {/* 5. Attendance Correction Modal */}
      <AttendanceCorrectionModal
        isOpen={!!correctionRecord}
        onClose={() => setCorrectionRecord(null)}
        record={correctionRecord}
        onSaved={() => {
          addToast('success', 'Attendance Record Corrected', 'Audit trail updated successfully.');
        }}
      />

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <AppContent />
      </SettingsProvider>
    </AuthProvider>
  );
}
