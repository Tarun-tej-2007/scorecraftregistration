"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Save, Plus, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";

type Session = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
};

type DayConfig = {
  day: number;
  date: string;
  sessions: Session[];
};

export default function AttendanceConfiguration() {
  const [adminKey, setAdminKey] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [numDays, setNumDays] = useState(2);
  const [days, setDays] = useState<DayConfig[]>([]);
  const [actionMsg, setActionMsg] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem("admin-key");
    if (saved) { 
      setAdminKey(saved); 
      setIsLoggedIn(true);
      loadConfig(saved);
    } else {
      setLoading(false);
    }
  }, []);

  const loadConfig = async (key: string) => {
    try {
      const res = await fetch("/api/admin/attendance/settings", { headers: { "x-admin-key": key } });
      const data = await res.json();
      if (res.ok && data.config) {
        setDays(data.config.days);
        setNumDays(data.config.days.length);
      }
    } catch {
      setActionMsg("err:Failed to load configuration.");
    } finally {
      setLoading(false);
    }
  };

  const updateNumDays = (val: number) => {
    if (val < 1) val = 1;
    setNumDays(val);
    const newDays = [...days];
    while (newDays.length < val) {
      const dayNum = newDays.length + 1;
      newDays.push({
        day: dayNum,
        date: `2026-10-${String(2 + dayNum).padStart(2, '0')}`,
        sessions: [
          { id: `DAY${dayNum}-SESSION1`, name: "Session 1", startTime: "09:00", endTime: "11:00" }
        ]
      });
    }
    while (newDays.length > val) {
      newDays.pop();
    }
    setDays(newDays);
  };

  const updateDayDate = (index: number, date: string) => {
    const newDays = [...days];
    newDays[index].date = date;
    setDays(newDays);
  };

  const addSession = (dayIndex: number) => {
    const newDays = [...days];
    const sLen = newDays[dayIndex].sessions.length;
    const dayNum = newDays[dayIndex].day;
    newDays[dayIndex].sessions.push({
      id: `DAY${dayNum}-SESSION${sLen + 1}-${Date.now()}`,
      name: `Session ${sLen + 1}`,
      startTime: "11:30",
      endTime: "13:00"
    });
    setDays(newDays);
  };

  const updateSession = (dayIndex: number, sIndex: number, field: keyof Session, val: string) => {
    const newDays = [...days];
    newDays[dayIndex].sessions[sIndex] = { ...newDays[dayIndex].sessions[sIndex], [field]: val };
    setDays(newDays);
  };

  const removeSession = (dayIndex: number, sIndex: number) => {
    const newDays = [...days];
    if (newDays[dayIndex].sessions.length <= 1) {
      setActionMsg("err:At least 1 session is required per day.");
      return;
    }
    newDays[dayIndex].sessions.splice(sIndex, 1);
    setDays(newDays);
  };

  const saveConfig = async () => {
    setSaving(true);
    setActionMsg("");
    try {
      const res = await fetch("/api/admin/attendance/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ days }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg("ok:Configuration saved successfully.");
      } else {
        setActionMsg(`err:${data.message}`);
      }
    } catch {
      setActionMsg("err:Network error.");
    } finally {
      setSaving(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <main className="admin-page">
        <div className="admin-top">
          <Link href="/admin/attendance" className="back-link"><ArrowLeft size={18} /> Back to Attendance</Link>
          <div className="admin-brand">ATTENDANCE CONFIGURATION</div>
        </div>
        <div className="admin-login-wrap">
          <div className="admin-login-card">
            <h2>ACCESS DENIED</h2>
            <p>Please login through the main Attendance Portal first.</p>
            <Link href="/admin/attendance" className="primary-button" style={{ display: "inline-block", marginTop: 10 }}>GO TO LOGIN</Link>
          </div>
        </div>
      </main>
    );
  }

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: 100 }}><Loader2 size={40} className="spin-icon" /></div>;
  }

  return (
    <main className="admin-page" style={{ paddingBottom: 100 }}>
      <div className="admin-top">
        <Link href="/admin/attendance" className="back-link"><ArrowLeft size={18} /> Back to Attendance</Link>
        <div className="admin-brand">ATTENDANCE CONFIGURATION</div>
      </div>

      <div className="admin-shell" style={{ maxWidth: 800 }}>
        <div className="admin-heading">
          <div>
            <span className="brush-label">EVENT STRUCTURE</span>
            <h1>Configuration</h1>
          </div>
        </div>

        {actionMsg && (
          <div className={`admin-action-msg ${actionMsg.startsWith("ok:") ? "msg-success" : "msg-error"}`} style={{ marginBottom: 20 }}>
            {actionMsg.replace(/^(ok|err):/, "")}
          </div>
        )}

        <div style={{ background: "white", padding: 25, borderRadius: 8, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: "1.2rem", borderBottom: "2px solid var(--primary)", paddingBottom: 10 }}>GENERAL SETTINGS</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label style={{ fontWeight: "bold", fontSize: "0.9rem" }}>NUMBER OF DAYS</label>
              <input type="number" min={1} max={7} value={numDays} onChange={(e) => updateNumDays(Number(e.target.value))} style={{ padding: "8px 12px", width: 80, borderRadius: 4, border: "1px solid #ddd", fontSize: 16 }} />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
            {days.map((day, dIdx) => (
              <div key={`day-${day.day}`} style={{ border: "1px solid #eaeaea", borderRadius: 8, padding: 20, background: "#fafafa" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
                  <h3 style={{ margin: 0, color: "var(--primary)" }}>DAY {day.day}</h3>
                  <input type="date" value={day.date} onChange={(e) => updateDayDate(dIdx, e.target.value)} style={{ padding: 8, borderRadius: 4, border: "1px solid #ccc" }} />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                  {day.sessions.map((session, sIdx) => (
                    <div key={session.id} style={{ display: "flex", flexWrap: "wrap", gap: 15, alignItems: "flex-end", background: "white", padding: 15, borderRadius: 6, border: "1px solid #ddd" }}>
                      <div style={{ flex: "1 1 200px" }}>
                        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "bold", marginBottom: 5 }}>Session Name</label>
                        <input type="text" value={session.name} onChange={(e) => updateSession(dIdx, sIdx, "name", e.target.value)} placeholder="e.g. Session 1" style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ccc" }} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "bold", marginBottom: 5 }}>Start Time</label>
                        <input type="time" value={session.startTime} onChange={(e) => updateSession(dIdx, sIdx, "startTime", e.target.value)} style={{ padding: 8, borderRadius: 4, border: "1px solid #ccc" }} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "bold", marginBottom: 5 }}>End Time</label>
                        <input type="time" value={session.endTime} onChange={(e) => updateSession(dIdx, sIdx, "endTime", e.target.value)} style={{ padding: 8, borderRadius: 4, border: "1px solid #ccc" }} />
                      </div>
                      <button onClick={() => removeSession(dIdx, sIdx)} style={{ background: "none", border: "none", color: "#e53e3e", cursor: "pointer", padding: 8 }} title="Delete Session"><Trash2 size={20} /></button>
                    </div>
                  ))}
                  
                  <button onClick={() => addSession(dIdx)} className="secondary-button" style={{ alignSelf: "flex-start", marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                    <Plus size={16} /> ADD SESSION
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 30, borderTop: "1px solid #eee", paddingTop: 20, textAlign: "right" }}>
            <button className="primary-button" onClick={saveConfig} disabled={saving} style={{ padding: "12px 24px", fontSize: "1.1rem" }}>
              {saving ? <Loader2 className="spin-icon" size={20} /> : <Save size={20} />}
              SAVE ATTENDANCE CONFIGURATION
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
