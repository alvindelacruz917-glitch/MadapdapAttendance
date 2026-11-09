import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { sounds } from '../../utils/audio';
import confetti from 'canvas-confetti';
import { 
  ScanLine, 
  Camera, 
  LogIn, 
  LogOut, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Mail, 
  Clock, 
  ShieldCheck, 
  Volume2, 
  VolumeX, 
  Keyboard 
} from 'lucide-react';
import { ScanResult, EventType } from '../../types';

export const GuardScanner: React.FC = () => {
  const { userProfile } = useAuth();
  const { settings } = useSettings();

  const [mode, setMode] = useState<EventType>('ENTRY');
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [scanning, setScanning] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [processing, setProcessing] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Manual fallback input
  const [manualCode, setManualCode] = useState<string>('');
  const [showManualInput, setShowManualInput] = useState<boolean>(false);

  // Scan Results
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null);
  const [lastScanError, setLastScanError] = useState<{ message: string; code?: string; studentName?: string } | null>(null);
  const [scanHistory, setScanHistory] = useState<Array<{
    id: string;
    studentName: string;
    studentId: string;
    eventType: EventType;
    status: string;
    time: string;
    success: boolean;
  }>>([]);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isCooldownRef = useRef<boolean>(false);

  // Live time ticker
  const [liveTime, setLiveTime] = useState<string>('');
  const [liveDate, setLiveDate] = useState<string>('');

  useEffect(() => {
    const updateTicker = () => {
      try {
        const now = new Date();
        const t = new Intl.DateTimeFormat('en-US', {
          timeZone: settings.timezone || 'Asia/Manila',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }).format(now);
        const d = new Intl.DateTimeFormat('en-US', {
          timeZone: settings.timezone || 'Asia/Manila',
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        }).format(now);
        setLiveTime(t);
        setLiveDate(d);
      } catch {
        setLiveTime(new Date().toLocaleTimeString());
      }
    };
    updateTicker();
    const interval = setInterval(updateTicker, 1000);
    return () => clearInterval(interval);
  }, [settings.timezone]);

  // Enumerate cameras
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices.map((d) => ({ id: d.id, label: d.label || `Camera ${d.id.slice(0, 5)}` })));
          // Prefer environment / back camera on smartphones
          const backCam = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        } else {
          setCameraError('No camera devices detected on this device.');
        }
      })
      .catch((err) => {
        console.warn('Camera enumeration error:', err);
        setCameraError('Camera access requires permission. Please ensure you have granted camera permissions.');
      });

    return () => {
      stopCameraScanner();
    };
  }, []);

  const startCameraScanner = async (cameraIdToUse?: string) => {
    const camId = cameraIdToUse || selectedCameraId;
    setCameraError('');

    try {
      if (html5QrCodeRef.current) {
        await stopCameraScanner();
      }

      const scanner = new Html5Qrcode('qr-reader-container');
      html5QrCodeRef.current = scanner;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      await scanner.start(
        camId ? { deviceId: { exact: camId } } : { facingMode: 'environment' },
        config,
        (decodedText) => {
          handleDetectedCode(decodedText);
        },
        (errorMessage) => {
          // ignore scan frame errors
        }
      );

      setScanning(true);
    } catch (err: any) {
      console.error('Failed to start camera:', err);
      setCameraError(err.message || 'Failed to start camera. Please check camera permissions.');
      setScanning(false);
    }
  };

  const stopCameraScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Error stopping scanner:', e);
      }
      html5QrCodeRef.current = null;
      setScanning(false);
    }
  };

  // Core scan processing logic
  const handleDetectedCode = async (rawCode: string) => {
    if (isCooldownRef.current || processing) return;

    // Set momentary cooldown to avoid re-scanning within 2.5 seconds on client frame
    isCooldownRef.current = true;
    setTimeout(() => {
      isCooldownRef.current = false;
    }, 2500);

    setProcessing(true);
    setLastScanError(null);

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrToken: rawCode.trim(),
          eventType: mode,
          guardId: userProfile?.uid || 'gate-guard-1',
          guardName: userProfile?.fullName || 'Duty Guard'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (soundEnabled) sounds.playError();
        setLastScanError({
          message: data.error || 'Failed to process student QR.',
          code: data.code,
          studentName: data.studentName
        });
        setLastScanResult(null);

        // Add to history
        setScanHistory(prev => [
          {
            id: `err_${Date.now()}`,
            studentName: data.studentName || 'Unidentified Student',
            studentId: 'Unknown',
            eventType: mode,
            status: data.code || 'REJECTED',
            time: new Date().toLocaleTimeString(),
            success: false
          },
          ...prev.slice(0, 19)
        ]);

        return;
      }

      // Success!
      if (soundEnabled) {
        if (mode === 'ENTRY') {
          sounds.playSuccess();
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.6 }
          });
        } else {
          sounds.playExit();
        }
      }

      const result: ScanResult = data;
      setLastScanResult(result);
      setLastScanError(null);

      // Add to history
      setScanHistory(prev => [
        {
          id: result.attendance.eventId,
          studentName: result.student.fullName,
          studentId: result.student.studentId,
          eventType: result.attendance.eventType,
          status: result.attendance.status,
          time: result.attendance.time,
          success: true
        },
        ...prev.slice(0, 19)
      ]);

    } catch (err: any) {
      if (soundEnabled) sounds.playError();
      setLastScanError({
        message: err.message || 'Network error connecting to school gate verification server.'
      });
      setLastScanResult(null);
    } finally {
      setProcessing(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleDetectedCode(manualCode.trim());
    setManualCode('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-12">
      {/* Top Banner: Shift details & Mode Selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <ScanLine className="w-5 h-5 text-blue-600" />
              <span>Gate Attendance Terminal</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Duty Guard: <strong className="text-slate-800">{userProfile?.fullName || 'Guard on Duty'}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-xs font-mono font-bold text-slate-900">{liveTime}</div>
              <div className="text-[10px] text-slate-500">{liveDate} ({settings.timezone})</div>
            </div>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border text-xs transition-colors ${
                soundEnabled 
                  ? 'bg-blue-50 text-blue-700 border-blue-200' 
                  : 'bg-slate-100 text-slate-400 border-slate-200'
              }`}
              title={soundEnabled ? 'Mute audio tones' : 'Unmute audio tones'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Large Mode Switcher: ENTRY vs EXIT */}
        <div className="pt-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Select Scanning Gate Mode:
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode('ENTRY')}
              className={`py-3.5 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 transition-all shadow-sm ${
                mode === 'ENTRY'
                  ? 'bg-emerald-600 text-white shadow-emerald-600/30 ring-4 ring-emerald-100 scale-[1.01]'
                  : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <LogIn className="w-5 h-5" />
              <div className="text-left">
                <div className="leading-tight">STUDENT ENTRY</div>
                <div className={`text-[10px] font-normal ${mode === 'ENTRY' ? 'text-emerald-100' : 'text-slate-400'}`}>
                  Records arrival &amp; alerts parents
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode('EXIT')}
              className={`py-3.5 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 transition-all shadow-sm ${
                mode === 'EXIT'
                  ? 'bg-blue-600 text-white shadow-blue-600/30 ring-4 ring-blue-100 scale-[1.01]'
                  : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <LogOut className="w-5 h-5" />
              <div className="text-left">
                <div className="leading-tight">STUDENT EXIT</div>
                <div className={`text-[10px] font-normal ${mode === 'EXIT' ? 'text-blue-100' : 'text-slate-400'}`}>
                  Records departure &amp; alerts parents
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Main Scanner Section */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left Column: Camera Viewport */}
        <div className="md:col-span-7 space-y-3">
          <div className="bg-slate-900 rounded-2xl p-4 text-white shadow-md relative overflow-hidden">
            {/* Camera Control Bar */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${scanning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                <span className="text-xs font-bold text-slate-200">
                  {scanning ? 'Camera Live' : 'Camera Standby'}
                </span>
              </div>

              {cameras.length > 1 && (
                <select
                  value={selectedCameraId}
                  onChange={(e) => {
                    setSelectedCameraId(e.target.value);
                    if (scanning) {
                      startCameraScanner(e.target.value);
                    }
                  }}
                  className="bg-slate-800 text-slate-200 text-xs px-2.5 py-1 rounded-lg border border-slate-700 focus:outline-none"
                >
                  {cameras.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Viewport Box */}
            <div className="relative aspect-square max-h-[340px] w-full mx-auto bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800">
              <div id="qr-reader-container" className="w-full h-full" />

              {!scanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 z-10">
                  <Camera className="w-12 h-12 text-slate-600 mb-3" />
                  <p className="text-xs text-slate-300 font-medium max-w-xs mb-4">
                    Position the student's QR code in front of the lens to record gate attendance.
                  </p>
                  <button
                    onClick={() => startCameraScanner()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors shadow-lg shadow-blue-500/30"
                  >
                    <Camera className="w-4 h-4" />
                    Activate Camera
                  </button>
                </div>
              )}

              {/* Processing Overlay */}
              {processing && (
                <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center z-20">
                  <RefreshCw className="w-10 h-10 text-blue-400 animate-spin mb-2" />
                  <span className="text-xs font-bold text-white tracking-wide">
                    Verifying Cryptographic QR...
                  </span>
                </div>
              )}
            </div>

            {/* Bottom Camera Buttons */}
            <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-800 text-xs">
              {scanning ? (
                <button
                  onClick={stopCameraScanner}
                  className="text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Turn Off Camera
                </button>
              ) : (
                <button
                  onClick={() => startCameraScanner()}
                  className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                >
                  Restart Camera
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowManualInput(!showManualInput)}
                className="text-slate-400 hover:text-white flex items-center gap-1.5"
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>Manual Token Entry</span>
              </button>
            </div>
          </div>

          {/* Camera Error Alert */}
          {cameraError && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Camera Notice</p>
                <p className="text-[11px] mt-0.5">{cameraError}</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Tip: On mobile browsers, make sure camera permissions are enabled in browser settings or use the Manual Token Entry below.
                </p>
              </div>
            </div>
          )}

          {/* Manual Input Fallback */}
          {showManualInput && (
            <form onSubmit={handleManualSubmit} className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Manual QR Token Lookup (For Damaged Cards)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Paste or enter student token / ID..."
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!manualCode.trim() || processing}
                  className="px-4 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
                >
                  Verify
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right Column: Scan Result Confirmation Box */}
        <div className="md:col-span-5 space-y-3">
          {/* SUCCESS CONFIRMATION BOX */}
          {lastScanResult && (
            <div
              className={`rounded-2xl border-2 p-5 text-center shadow-lg animate-in zoom-in-95 duration-200 ${
                lastScanResult.attendance.eventType === 'ENTRY'
                  ? 'bg-emerald-50/70 border-emerald-500 text-emerald-950'
                  : 'bg-blue-50/70 border-blue-500 text-blue-950'
              }`}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle2
                  className={`w-7 h-7 ${
                    lastScanResult.attendance.eventType === 'ENTRY' ? 'text-emerald-600' : 'text-blue-600'
                  }`}
                />
                <span className="text-sm font-black tracking-wider uppercase">
                  STUDENT {lastScanResult.attendance.eventType} SUCCESSFUL
                </span>
              </div>

              {/* Student Name */}
              <h3 className="text-lg font-black text-slate-900 mt-2">
                {lastScanResult.student.fullName}
              </h3>
              <p className="text-xs font-mono font-bold text-blue-700">
                Student ID: {lastScanResult.student.studentId}
              </p>
              <p className="text-xs text-slate-600 font-medium">
                {lastScanResult.student.gradeLevel} &bull; Section {lastScanResult.student.section}
              </p>

              {/* Badges details */}
              <div className="bg-white/90 rounded-xl p-3 my-3 text-xs border border-slate-200/80 space-y-1.5 text-left shadow-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Recorded Time:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {lastScanResult.attendance.time}
                  </span>
                </div>

                {lastScanResult.attendance.eventType === 'ENTRY' && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Attendance Status:</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        lastScanResult.attendance.status === 'PRESENT'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {lastScanResult.attendance.status}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                  <span className="text-slate-500 font-medium flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-blue-600" />
                    Parent Email Alerts:
                  </span>
                  <span className="font-bold text-blue-700 text-[11px]">
                    {lastScanResult.notifications.totalTargeted > 0
                      ? `Dispatched to ${lastScanResult.notifications.totalTargeted} Guardian(s)`
                      : 'No guardians linked'}
                  </span>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 font-medium flex items-center justify-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Next student scan can proceed immediately</span>
              </div>
            </div>
          )}

          {/* ERROR ALERT BOX */}
          {lastScanError && (
            <div className="rounded-2xl border-2 border-rose-500 bg-rose-50/80 p-5 text-center shadow-lg animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-2">
                <XCircle className="w-8 h-8" />
              </div>

              <h4 className="text-sm font-black text-rose-900 uppercase tracking-wide">
                Scan Verification Failed
              </h4>

              <p className="text-xs font-bold text-rose-700 mt-2 leading-relaxed">
                {lastScanError.message}
              </p>

              {lastScanError.code === 'DUPLICATE_SCAN' && (
                <div className="mt-3 p-2 bg-white rounded-lg border border-rose-200 text-[11px] text-rose-800">
                  Duplicate scans within 60 seconds are rejected to protect attendance integrity.
                </div>
              )}

              {lastScanError.code === 'STUDENT_INACTIVE' && (
                <div className="mt-3 p-2 bg-white rounded-lg border border-rose-200 text-[11px] text-rose-800">
                  Student is marked Inactive or Suspended. Refer student to school administration.
                </div>
              )}

              <button
                type="button"
                onClick={() => setLastScanError(null)}
                className="mt-3 px-4 py-1.5 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors"
              >
                Dismiss Notice
              </button>
            </div>
          )}

          {/* Prompt to scan when idle */}
          {!lastScanResult && !lastScanError && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-slate-400">
              <ShieldCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <h4 className="text-xs font-bold text-slate-600">Awaiting QR Scan</h4>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                Scan confirmation and student parent email dispatch will appear here instantly.
              </p>
            </div>
          )}

          {/* Shift Scan History (Mini Feed) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center justify-between">
              <span>Recent Shift Scans</span>
              <span className="text-[10px] text-slate-500 font-normal">
                {scanHistory.length} Recorded
              </span>
            </h4>

            {scanHistory.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                No scans recorded yet in this shift.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {scanHistory.map((item) => (
                  <div key={item.id} className="py-2 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-800 block leading-tight">
                        {item.studentName}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {item.time} &bull; {item.studentId}
                      </span>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.success
                            ? item.eventType === 'ENTRY'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {item.eventType} {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
