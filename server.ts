import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  setDoc, 
  doc, 
  getDoc,
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load firebase-applet-config.json
let firebaseConfig: any = {};
try {
  const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (err) {
  console.warn('Could not load firebase-applet-config.json:', err);
}

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Helper: SHA-256 hash
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

// Helper: Formatter in school timezone
function getFormattedDateTime(timezone: string = 'Asia/Manila') {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now); // "YYYY-MM-DD"

  const timeStr = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(now); // e.g. "07:45:12 AM"

  const hour24Str = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now); // e.g. "07:45"

  return { dateStr, timeStr, hour24Str, isoTimestamp: now.toISOString() };
}

// Send Parent Email via Resend
async function sendParentEmail({
  recipient,
  studentName,
  studentId,
  gradeAndSection,
  eventType,
  timeStr,
  dateStr,
  status,
  schoolName = 'Oakridge Academy'
}: {
  recipient: string;
  studentName: string;
  studentId: string;
  gradeAndSection: string;
  eventType: 'ENTRY' | 'EXIT';
  timeStr: string;
  dateStr: string;
  status: string;
  schoolName?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  const isEntry = eventType === 'ENTRY';
  const subject = isEntry 
    ? `Student Entry Notification - ${studentName}`
    : `Student Exit Notification - ${studentName}`;

  const textBody = isEntry 
    ? `Dear Parent/Guardian,\n\nThis is to inform you that your child has successfully entered school.\n\nStudent Name: ${studentName}\nStudent ID: ${studentId}\nGrade and Section: ${gradeAndSection}\nDate: ${dateStr}\nEntry Time: ${timeStr}\nAttendance Status: ${status}\n\nThank you.\n\n${schoolName}\nAutomated Student Attendance System`
    : `Dear Parent/Guardian,\n\nThis is to inform you that your child has exited the school premises.\n\nStudent Name: ${studentName}\nStudent ID: ${studentId}\nGrade and Section: ${gradeAndSection}\nDate: ${dateStr}\nExit Time: ${timeStr}\n\nThank you.\n\n${schoolName}\nAutomated Student Attendance System`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="border-bottom: 2px solid ${isEntry ? '#2563eb' : '#0f172a'}; padding-bottom: 16px; margin-bottom: 20px;">
        <h2 style="color: #0f172a; margin: 0 0 6px 0; font-size: 20px;">${schoolName}</h2>
        <span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: bold; background-color: ${isEntry ? '#dbeafe' : '#fef3c7'}; color: ${isEntry ? '#1d4ed8' : '#92400e'};">
          ${isEntry ? 'CAMPUS ENTRY RECORDED' : 'CAMPUS EXIT RECORDED'}
        </span>
      </div>
      <p style="color: #334155; font-size: 15px; line-height: 1.5;">Dear Parent/Guardian,</p>
      <p style="color: #334155; font-size: 15px; line-height: 1.5;">
        ${isEntry 
          ? 'This is to inform you that your child has successfully entered the school premises.'
          : 'This is to inform you that your child has exited the school premises.'}
      </p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #1e293b;">
          <tr>
            <td style="padding: 6px 0; font-weight: bold; color: #64748b; width: 40%;">Student Name:</td>
            <td style="padding: 6px 0; font-weight: 600;">${studentName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold; color: #64748b;">Student ID:</td>
            <td style="padding: 6px 0;">${studentId}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold; color: #64748b;">Grade & Section:</td>
            <td style="padding: 6px 0;">${gradeAndSection}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold; color: #64748b;">Date:</td>
            <td style="padding: 6px 0;">${dateStr}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold; color: #64748b;">${isEntry ? 'Entry Time:' : 'Exit Time:'}</td>
            <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">${timeStr}</td>
          </tr>
          ${isEntry ? `
          <tr>
            <td style="padding: 6px 0; font-weight: bold; color: #64748b;">Attendance Status:</td>
            <td style="padding: 6px 0;"><span style="color: ${status === 'PRESENT' ? '#16a34a' : '#d97706'}; font-weight: bold;">${status}</span></td>
          </tr>` : ''}
        </table>
      </div>
      <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin-top: 24px;">
        Thank you.<br />
        <strong>${schoolName}</strong><br />
        Automated Student Attendance & Parent Notification System
      </p>
    </div>
  `;

  if (!apiKey || apiKey.startsWith('re_123456789') || apiKey === 'MY_RESEND_API_KEY') {
    // Graceful simulation when Resend API key is in placeholder state
    console.log(`[SIMULATED EMAIL DISPATCH] To: ${recipient} | Subject: ${subject}`);
    return {
      success: true,
      simulated: true,
      messageId: `sim_${crypto.randomUUID()}`
    };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${schoolName} Attendance <onboarding@resend.dev>`,
        to: [recipient],
        subject,
        text: textBody,
        html: htmlBody
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || 'Failed to dispatch email via Resend API');
    }

    return {
      success: true,
      simulated: false,
      messageId: data.id || `res_${crypto.randomUUID()}`
    };
  } catch (err: any) {
    console.error('Resend delivery error:', err);
    return {
      success: false,
      error: err.message || 'Email delivery failed'
    };
  }
}

// API: Generate cryptographically random token
app.post('/api/qr/generate-token', (req, res) => {
  try {
    // Generate 24 cryptographically random bytes encoded as base64url
    const rawToken = crypto.randomBytes(24).toString('base64url');
    const tokenHash = hashToken(rawToken);

    res.json({
      token: rawToken,
      tokenHash
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Token generation failed' });
  }
});

// API: Hash a token
app.post('/api/hash-token', (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }
  res.json({ tokenHash: hashToken(token) });
});

// API: Scanner processing endpoint
app.post('/api/scan', async (req, res) => {
  try {
    const { qrToken, eventType, guardId, guardName } = req.body;

    if (!qrToken || typeof qrToken !== 'string') {
      return res.status(400).json({ error: 'Valid QR token is required' });
    }
    if (!eventType || (eventType !== 'ENTRY' && eventType !== 'EXIT')) {
      return res.status(400).json({ error: 'eventType must be ENTRY or EXIT' });
    }

    const tokenHash = hashToken(qrToken);

    // 1. Look up student by qrTokenHash
    const studentsCol = collection(db, 'students');
    const studentQuery = query(studentsCol, where('qrTokenHash', '==', tokenHash));
    const studentSnap = await getDocs(studentQuery);

    if (studentSnap.empty) {
      return res.status(404).json({ 
        error: 'Invalid QR code. No registered student matching this credential was found.',
        code: 'STUDENT_NOT_FOUND'
      });
    }

    const studentDoc = studentSnap.docs[0];
    const student = studentDoc.data();
    const studentDocId = studentDoc.id;

    // 2. Check if student is active
    if (student.status !== 'ACTIVE') {
      return res.status(403).json({
        error: `Student ${student.firstName} ${student.lastName} is marked as ${student.status}. Access denied.`,
        code: 'STUDENT_INACTIVE'
      });
    }

    // 3. Fetch school settings for timezone & schedule
    let settings = {
      schoolName: 'Oakridge Academy',
      timezone: 'Asia/Manila',
      openingTime: '07:30',
      lateCutoff: '08:00',
      closingTime: '17:00'
    };

    try {
      const settingsDoc = await getDoc(doc(db, 'school_settings', 'global'));
      if (settingsDoc.exists()) {
        settings = { ...settings, ...settingsDoc.data() };
      }
    } catch (e) {
      console.warn('Error reading school_settings, falling back to defaults:', e);
    }

    const { dateStr, timeStr, hour24Str, isoTimestamp } = getFormattedDateTime(settings.timezone);

    // 4. Duplicate scan protection (60 seconds)
    const eventsCol = collection(db, 'attendance_events');
    const recentEventsQuery = query(
      eventsCol,
      where('studentId', '==', student.studentId),
      where('date', '==', dateStr),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const recentEventsSnap = await getDocs(recentEventsQuery);
    if (!recentEventsSnap.empty) {
      const lastEvent = recentEventsSnap.docs[0].data();
      const lastTime = new Date(lastEvent.timestamp).getTime();
      const nowTime = new Date(isoTimestamp).getTime();
      const diffSeconds = Math.floor((nowTime - lastTime) / 1000);

      if (diffSeconds < 60) {
        return res.status(429).json({
          error: `Duplicate scan detected! ${student.firstName} was scanned ${diffSeconds} seconds ago. Please wait at least 60 seconds.`,
          code: 'DUPLICATE_SCAN',
          studentName: `${student.firstName} ${student.lastName}`,
          secondsRemaining: 60 - diffSeconds
        });
      }
    }

    // 5. Determine attendance status for ENTRY
    let calculatedStatus: 'PRESENT' | 'LATE' | 'N/A' = 'N/A';
    if (eventType === 'ENTRY') {
      calculatedStatus = hour24Str > settings.lateCutoff ? 'LATE' : 'PRESENT';
    }

    // 6. Record attendance_event document
    const eventId = `evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const idempotencyKey = `${student.studentId}_${eventType}_${dateStr}_${hour24Str}`;

    const eventPayload = {
      eventId,
      studentId: student.studentId,
      studentName: `${student.firstName} ${student.lastName}`,
      eventType,
      timestamp: isoTimestamp,
      guardId: guardId || 'guard-gate-1',
      guardName: guardName || 'Duty Guard',
      date: dateStr,
      status: calculatedStatus,
      idempotencyKey,
      createdAt: isoTimestamp
    };

    await setDoc(doc(db, 'attendance_events', eventId), eventPayload);

    // 7. Update Daily Attendance rollup document
    const dailyAttendanceDocId = `${student.studentId}_${dateStr}`;
    const dailyAttendanceRef = doc(db, 'attendance', dailyAttendanceDocId);
    const dailySnap = await getDoc(dailyAttendanceRef);

    if (!dailySnap.exists()) {
      await setDoc(dailyAttendanceRef, {
        studentId: student.studentId,
        studentName: `${student.firstName} ${student.lastName}`,
        gradeLevel: student.gradeLevel,
        section: student.section,
        date: dateStr,
        status: calculatedStatus === 'N/A' ? 'PRESENT' : calculatedStatus,
        firstEntryAt: eventType === 'ENTRY' ? isoTimestamp : null,
        lastExitAt: eventType === 'EXIT' ? isoTimestamp : null,
        entryCount: eventType === 'ENTRY' ? 1 : 0,
        exitCount: eventType === 'EXIT' ? 1 : 0,
        createdAt: isoTimestamp,
        updatedAt: isoTimestamp
      });
    } else {
      const existing = dailySnap.data();
      const updates: any = {
        updatedAt: isoTimestamp,
        entryCount: eventType === 'ENTRY' ? (existing.entryCount || 0) + 1 : existing.entryCount || 0,
        exitCount: eventType === 'EXIT' ? (existing.exitCount || 0) + 1 : existing.exitCount || 0
      };

      if (eventType === 'ENTRY') {
        if (!existing.firstEntryAt) {
          updates.firstEntryAt = isoTimestamp;
          updates.status = calculatedStatus;
        }
      } else {
        updates.lastExitAt = isoTimestamp;
      }

      await setDoc(dailyAttendanceRef, updates, { merge: true });
    }

    // 8. Fetch registered parent/guardians
    const guardiansCol = collection(db, 'guardians');
    const guardianIds: string[] = student.guardianIds || [];
    let guardians: any[] = [];

    if (guardianIds.length > 0) {
      for (const gId of guardianIds) {
        try {
          const gSnap = await getDoc(doc(db, 'guardians', gId));
          if (gSnap.exists()) {
            guardians.push(gSnap.data());
          }
        } catch (e) {
          console.warn(`Error fetching guardian ${gId}:`, e);
        }
      }
    } else {
      // Fallback search by studentIds containing student.studentId
      const gQuery = query(guardiansCol, where('studentIds', 'array-contains', student.studentId));
      const gSnap = await getDocs(gQuery);
      guardians = gSnap.docs.map(d => d.data());
    }

    // Filter guardians who have notifications enabled (default true)
    const activeGuardians = guardians.filter(g => g.notificationsEnabled !== false && g.email);

    // 9. Dispatch Parent Notifications asynchronously (attendance recording must NOT fail if email fails)
    const emailResults: any[] = [];

    for (const guardian of activeGuardians) {
      const emailLogId = `log_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const emailSendResult = await sendParentEmail({
        recipient: guardian.email,
        studentName: `${student.firstName} ${student.lastName}`,
        studentId: student.studentId,
        gradeAndSection: `${student.gradeLevel} - ${student.section}`,
        eventType,
        timeStr,
        dateStr,
        status: calculatedStatus,
        schoolName: settings.schoolName
      });

      const logPayload = {
        logId: emailLogId,
        eventId,
        studentId: student.studentId,
        recipient: guardian.email,
        guardianName: guardian.fullName || 'Guardian',
        eventType,
        deliveryStatus: emailSendResult.success ? 'SENT' : 'FAILED',
        providerMessageId: emailSendResult.messageId || null,
        sentAt: isoTimestamp,
        errorMessage: emailSendResult.error || null,
        simulated: !!emailSendResult.simulated
      };

      try {
        await setDoc(doc(db, 'email_logs', emailLogId), logPayload);
      } catch (logErr) {
        console.error('Failed to write email_log to Firestore:', logErr);
      }

      emailResults.push({
        recipient: guardian.email,
        status: logPayload.deliveryStatus,
        simulated: logPayload.simulated
      });
    }

    // 10. Return success response
    return res.status(200).json({
      success: true,
      student: {
        studentId: student.studentId,
        firstName: student.firstName,
        middleName: student.middleName || '',
        lastName: student.lastName,
        fullName: `${student.firstName} ${student.middleName ? student.middleName + ' ' : ''}${student.lastName}`,
        gradeLevel: student.gradeLevel,
        section: student.section,
        status: student.status
      },
      attendance: {
        eventId,
        eventType,
        date: dateStr,
        time: timeStr,
        status: calculatedStatus
      },
      notifications: {
        totalTargeted: activeGuardians.length,
        dispatched: emailResults
      }
    });

  } catch (err: any) {
    console.error('Scan processing error:', err);
    res.status(500).json({
      error: err.message || 'Internal server error while processing QR scan'
    });
  }
});

// API: Send or retry an email log
app.post('/api/email/retry', async (req, res) => {
  try {
    const { logId } = req.body;
    if (!logId) {
      return res.status(400).json({ error: 'logId is required' });
    }

    const logRef = doc(db, 'email_logs', logId);
    const logSnap = await getDoc(logRef);
    if (!logSnap.exists()) {
      return res.status(404).json({ error: 'Email log not found' });
    }

    const logData = logSnap.data();

    // Fetch student info
    const studentsCol = collection(db, 'students');
    const studentQuery = query(studentsCol, where('studentId', '==', logData.studentId));
    const studentSnap = await getDocs(studentQuery);
    const student = !studentSnap.empty ? studentSnap.docs[0].data() : null;

    const studentName = student ? `${student.firstName} ${student.lastName}` : logData.studentId;
    const gradeAndSection = student ? `${student.gradeLevel} - ${student.section}` : 'N/A';

    const sendRes = await sendParentEmail({
      recipient: logData.recipient,
      studentName,
      studentId: logData.studentId,
      gradeAndSection,
      eventType: logData.eventType,
      timeStr: new Date(logData.sentAt).toLocaleTimeString(),
      dateStr: new Date(logData.sentAt).toLocaleDateString(),
      status: 'RECORDED'
    });

    const updatedStatus = sendRes.success ? 'SENT' : 'FAILED';
    await setDoc(logRef, {
      deliveryStatus: updatedStatus,
      errorMessage: sendRes.error || null,
      providerMessageId: sendRes.messageId || null,
      retriedAt: new Date().toISOString()
    }, { merge: true });

    res.json({ success: sendRes.success, updatedStatus });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Retry failed' });
  }
});

// API: Health & settings check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    resendConfigured: !!(process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.startsWith('re_123456789'))
  });
});

// Mount Vite or serve static dist
async function setupServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT} (mode: ${isProduction ? 'production' : 'development'})`);
  });
}

setupServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
