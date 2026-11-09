import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, setDoc, getDocs } from 'firebase/firestore';
import { Student, Guardian } from '../../types';
import { 
  Users, 
  Search, 
  Filter, 
  Plus, 
  UploadCloud, 
  Download, 
  QrCode, 
  Edit, 
  RefreshCw, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  ChevronLeft, 
  ChevronRight,
  Printer,
  Mail,
  UserCheck
} from 'lucide-react';

interface StudentManagementProps {
  onOpenRegister: () => void;
  onOpenCsvImport: () => void;
  onSelectStudentForCard: (student: Student) => void;
  onSelectStudentForEdit: (student: Student) => void;
  onSelectStudentForRegenerate: (student: Student) => void;
}

export const StudentManagement: React.FC<StudentManagementProps> = ({
  onOpenRegister,
  onOpenCsvImport,
  onSelectStudentForCard,
  onSelectStudentForEdit,
  onSelectStudentForRegenerate
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [guardiansMap, setGuardiansMap] = useState<Record<string, Guardian>>({});
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    // 1. Listen to students
    const unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      const list = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Student));
      setStudents(list);
      setLoading(false);
    });

    // 2. Fetch guardians
    const loadGuardians = async () => {
      try {
        const snap = await getDocs(collection(db, 'guardians'));
        const map: Record<string, Guardian> = {};
        snap.docs.forEach(d => {
          map[d.id] = d.data() as Guardian;
        });
        setGuardiansMap(map);
      } catch (e) {
        console.warn('Error loading guardians map:', e);
      }
    };
    loadGuardians();

    return () => unsubStudents();
  }, []);

  // Toggle student status (Active / Inactive)
  const toggleStudentStatus = async (student: Student) => {
    const nextStatus = student.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const confirmMsg = nextStatus === 'INACTIVE'
      ? `Deactivate ${student.firstName} ${student.lastName}? This student will be rejected at the gate.`
      : `Reactivate ${student.firstName} ${student.lastName}? Student will regain campus entry access.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const docId = student.id || `std_${student.studentId}`;
      await setDoc(doc(db, 'students', docId), {
        status: nextStatus,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err: any) {
      alert(`Error updating status: ${err.message}`);
    }
  };

  // Distinct grades for filter
  const uniqueGrades = Array.from(new Set(students.map(s => s.gradeLevel).filter(Boolean)));

  // Filtered students
  const filteredStudents = students.filter(s => {
    const sName = `${s.firstName} ${s.middleName || ''} ${s.lastName}`.toLowerCase();
    const matchesSearch =
      sName.includes(search.toLowerCase()) ||
      s.studentId.toLowerCase().includes(search.toLowerCase()) ||
      s.section.toLowerCase().includes(search.toLowerCase());

    const matchesGrade = selectedGrade === 'ALL' || s.gradeLevel === selectedGrade;
    const matchesStatus = selectedStatus === 'ALL' || s.status === selectedStatus;

    return matchesSearch && matchesGrade && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Export students to CSV
  const handleExportCsv = () => {
    if (students.length === 0) return;
    const headers = ['Student ID', 'First Name', 'Middle Name', 'Last Name', 'Grade Level', 'Section', 'Status', 'Guardian Emails', 'Created At'];
    const rows = students.map(s => {
      const gEmails = (s.guardianIds || [])
        .map(id => guardiansMap[id]?.email)
        .filter(Boolean)
        .join('; ');

      return [
        `"${s.studentId}"`,
        `"${s.firstName}"`,
        `"${s.middleName || ''}"`,
        `"${s.lastName}"`,
        `"${s.gradeLevel}"`,
        `"${s.section}"`,
        `"${s.status}"`,
        `"${gEmails}"`,
        `"${s.createdAt || ''}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Students_Directory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span>Student Roster &amp; QR Credentials</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Manage student enrollment, cryptographic QR badges, and registered parent alert contacts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl transition-colors shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={onOpenCsvImport}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition-colors shadow-xs"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Import CSV</span>
            </button>

            <button
              onClick={onOpenRegister}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-xl transition-colors shadow-xs shadow-blue-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Register Student</span>
            </button>
          </div>
        </div>

        {/* Filters and search row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by student name, ID, or section..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Grade filter */}
            <select
              value={selectedGrade}
              onChange={(e) => {
                setSelectedGrade(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 border border-slate-300 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Grades</option>
              {uniqueGrades.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>

            {/* Status filter */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 border border-slate-300 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active (Authorized)</option>
              <option value="INACTIVE">Inactive (Suspended)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            Loading student records...
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <p>No students match your search and filter criteria.</p>
            <button
              onClick={onOpenRegister}
              className="inline-flex items-center gap-1.5 text-blue-600 font-bold hover:underline"
            >
              <Plus className="w-4 h-4" />
              Register new student
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3 pl-4">Student ID</th>
                  <th className="p-3">Student Name</th>
                  <th className="p-3">Grade &amp; Section</th>
                  <th className="p-3">Parent Notification Email</th>
                  <th className="p-3">QR Status</th>
                  <th className="p-3">Enrollment</th>
                  <th className="p-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedStudents.map((std) => {
                  const guardianEmails = (std.guardianIds || [])
                    .map(id => guardiansMap[id]?.email)
                    .filter(Boolean);

                  return (
                    <tr key={std.studentId} className="hover:bg-slate-50/70 transition-colors">
                      {/* ID */}
                      <td className="p-3 pl-4 font-mono font-bold text-blue-600 whitespace-nowrap">
                        {std.studentId}
                      </td>

                      {/* Name */}
                      <td className="p-3">
                        <div className="font-bold text-slate-900">
                          {std.firstName} {std.middleName ? std.middleName + ' ' : ''}{std.lastName}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Registered: {std.createdAt ? new Date(std.createdAt).toLocaleDateString() : 'N/A'}
                        </div>
                      </td>

                      {/* Grade & Section */}
                      <td className="p-3 whitespace-nowrap">
                        <span className="font-medium text-slate-800">{std.gradeLevel}</span>
                        <span className="text-slate-400 mx-1">&bull;</span>
                        <span className="text-slate-600">{std.section}</span>
                      </td>

                      {/* Parent Email */}
                      <td className="p-3">
                        {guardianEmails.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            {guardianEmails.map((email, i) => (
                              <span key={i} className="text-slate-700 font-mono text-[11px] flex items-center gap-1">
                                <Mail className="w-3 h-3 text-slate-400" />
                                {email}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">No email assigned</span>
                        )}
                      </td>

                      {/* QR Status */}
                      <td className="p-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <QrCode className="w-3 h-3" />
                          Hashed &amp; Active
                        </span>
                      </td>

                      {/* Enrollment Status */}
                      <td className="p-3 whitespace-nowrap">
                        <button
                          onClick={() => toggleStudentStatus(std)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-transform active:scale-95 ${
                            std.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                          }`}
                          title="Click to toggle status"
                        >
                          {std.status === 'ACTIVE' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {std.status}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="p-3 pr-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* Print ID Card Button */}
                          <button
                            onClick={() => onSelectStudentForCard(std)}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Print Student ID Card"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Edit Details */}
                          <button
                            onClick={() => onSelectStudentForEdit(std)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit Student & Guardian"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          {/* Regenerate / Revoke QR */}
                          <button
                            onClick={() => onSelectStudentForRegenerate(std)}
                            className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Revoke & Regenerate QR Code"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination bar */}
        <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
          <div>
            Showing {filteredStudents.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
            {Math.min(currentPage * pageSize, filteredStudents.length)} of {filteredStudents.length} students
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-bold text-slate-800">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
