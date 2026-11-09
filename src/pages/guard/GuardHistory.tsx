import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { AttendanceEvent, EventType } from '../../types';
import { History, Search, Filter, LogIn, LogOut, CheckCircle2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const GuardHistory: React.FC = () => {
  const { userProfile } = useAuth();
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | EventType>('ALL');

  useEffect(() => {
    const q = query(
      collection(db, 'attendance_events'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => doc.data() as AttendanceEvent);
      setEvents(list);
      setLoading(false);
    }, (err) => {
      console.warn('Error loading attendance events:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filtered = events.filter((ev) => {
    const matchesSearch =
      (ev.studentName?.toLowerCase() || '').includes(search.toLowerCase()) ||
      ev.studentId.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'ALL' || ev.eventType === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              <span>Gate Scan Event Log</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Real-time audit log of all student entries and exits recorded at the gate.
            </p>
          </div>

          <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl">
            Total Scans: {events.length}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student name or ID..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                filterType === 'ALL' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All Scans
            </button>
            <button
              onClick={() => setFilterType('ENTRY')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 ${
                filterType === 'ENTRY' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:text-emerald-800'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Entries
            </button>
            <button
              onClick={() => setFilterType('EXIT')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 ${
                filterType === 'EXIT' ? 'bg-blue-600 text-white shadow-xs' : 'text-blue-700 hover:text-blue-800'
              }`}
            >
              <LogOut className="w-3.5 h-3.5" />
              Exits
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            Loading scan events...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No gate scan records match your filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3 pl-4">Timestamp</th>
                  <th className="p-3">Student Name</th>
                  <th className="p-3">Student ID</th>
                  <th className="p-3">Gate Mode</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Duty Guard</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => (
                  <tr key={item.eventId} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 pl-4 font-mono text-slate-500 whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleTimeString()} &bull; {item.date}
                    </td>
                    <td className="p-3 font-bold text-slate-900">
                      {item.studentName || item.studentId}
                    </td>
                    <td className="p-3 font-mono font-semibold text-blue-600">
                      {item.studentId}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          item.eventType === 'ENTRY'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {item.eventType === 'ENTRY' ? <LogIn className="w-3 h-3" /> : <LogOut className="w-3 h-3" />}
                        {item.eventType}
                      </span>
                    </td>
                    <td className="p-3">
                      {item.eventType === 'ENTRY' ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.status === 'PRESENT'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {item.status}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px] font-medium">DEPARTED</span>
                      )}
                    </td>
                    <td className="p-3 text-slate-600">
                      {item.guardName || item.guardId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
