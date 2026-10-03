"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { ArrowLeft, Loader2, Download, Search, CheckCircle2 } from "lucide-react";
import Link from "next/link";

type SessionConfig = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
};

type DayConfig = {
  day: number;
  date: string;
  sessions: SessionConfig[];
};

type AttendanceRecord = {
  _id: string;
  registerNo: string;
  sessionId: string;
  status: string;
  markedAt: string;
};

type Participant = {
  name: string;
  registerNo: string;
  department: string;
  year: string;
  phone: string;
  registrationStatus: string;
};

export default function AttendanceReport() {
  const [adminKey, setAdminKey] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginInput, setLoginInput] = useState("");
  const [loading, setLoading] = useState(true);
  
  const [daysConfig, setDaysConfig] = useState<DayConfig[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  
  const [selectedSessionId, setSelectedSessionId] = useState("ALL");
  const [query, setQuery] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  const loadData = useCallback(async (key: string) => {
    setLoading(true);
    try {
      // 1. Load config
      const confRes = await fetch("/api/admin/attendance/settings", { headers: { "x-admin-key": key } });
      if (confRes.status === 401) { handleLogout(); return; }
      const confData = await confRes.json();
      if (confData.config && confData.config.days) {
        setDaysConfig(confData.config.days);
      }
      
      // 2. Load attendance
      const attRes = await fetch("/api/admin/attendance", { headers: { "x-admin-key": key } });
      const attData = await attRes.json();
      setAttendance(attData.attendance || []);
      
      // 3. Load all participants
      const partRes = await fetch("/api/admin/registrations", { headers: { "x-admin-key": key } });
      const partData = await partRes.json();
      setParticipants((partData.registrations || []).filter((p: any) => p.registrationStatus === "CONFIRMED"));
      
    } catch {
      setActionMsg("Failed to load report data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem("admin-key");
    if (saved) { 
      setAdminKey(saved); 
      setIsLoggedIn(true);
      loadData(saved);
    } else {
      setLoading(false);
    }
  }, [loadData]);

  async function handleLogin() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: loginInput }),
      });
      if (!res.ok) { setActionMsg("Incorrect password."); return; }
      sessionStorage.setItem("admin-key", loginInput);
      setAdminKey(loginInput);
      setIsLoggedIn(true);
    } catch {
      setActionMsg("Network error.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("admin-key");
    setAdminKey(""); setIsLoggedIn(false);
  }

  // Flatten sessions for columns
  const allSessions = useMemo(() => {
    const list: { id: string, label: string }[] = [];
    daysConfig.forEach(d => {
      d.sessions.forEach(s => {
        list.push({ id: s.id, label: `Day ${d.day} ${s.name.replace('Session ', 'S')}` });
      });
    });
    return list;
  }, [daysConfig]);

  const totalEligible = participants.length;
  
  // Stats calculation
  const sessionStats = useMemo(() => {
    if (selectedSessionId === "ALL") return null;
    const presentIds = new Set(attendance.filter(a => a.sessionId === selectedSessionId).map(a => a.registerNo.toUpperCase()));
    const present = presentIds.size;
    const notMarked = totalEligible - present;
    const percentage = totalEligible > 0 ? Math.round((present / totalEligible) * 100) : 0;
    
    return { present, notMarked, percentage };
  }, [selectedSessionId, attendance, totalEligible]);

  // Complete Report mapping
  const reportRows = useMemo(() => {
    // group attendance by register number
    const map = new Map<string, Set<string>>();
    attendance.forEach(a => {
      const regNo = a.registerNo.toUpperCase();
      if (!map.has(regNo)) map.set(regNo, new Set());
      map.get(regNo)!.add(a.sessionId);
    });
    
    let rows = participants.map(p => {
      const pAtt = map.get(p.registerNo.toUpperCase()) || new Set();
      let sessionsPresent = 0;
      allSessions.forEach(s => {
        if (pAtt.has(s.id)) sessionsPresent++;
      });
      const pct = allSessions.length > 0 ? Math.round((sessionsPresent / allSessions.length) * 100) : 0;
      
      return {
        ...p,
        attendanceSet: pAtt,
        sessionsPresent,
        totalSessions: allSessions.length,
        percentage: pct
      };
    });
    
    if (query) {
      const q = query.toLowerCase();
      rows = rows.filter(r => 
        r.name.toLowerCase().includes(q) || 
        r.registerNo.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q)
      );
    }
    
    return rows;
  }, [participants, attendance, allSessions, query]);

  const exportCurrentSessionCSV = () => {
    if (selectedSessionId === "ALL") return;
    
    let sName = "Session";
    for (const d of daysConfig) {
      for (const s of d.sessions) {
        if (s.id === selectedSessionId) sName = `Day ${d.day} ${s.name}`;
      }
    }
    
    const rows = [
      ["Register Number", "Name", "Phone", "Department", "Year", "Session", "Status"]
    ];
    
    const presentSet = new Set(attendance.filter(a => a.sessionId === selectedSessionId).map(a => a.registerNo.toUpperCase()));
    
    participants.forEach(p => {
      rows.push([
        p.registerNo,
        p.name,
        p.phone,
        p.department,
        p.year,
        sName,
        presentSet.has(p.registerNo.toUpperCase()) ? "PRESENT" : "ABSENT"
      ]);
    });
    
    downloadCSV(rows, `Attendance_${sName.replace(/ /g, '_')}.csv`);
  };

  const exportCompleteCSV = () => {
    const headers = ["Register Number", "Name", ...allSessions.map(s => s.label), "Total Present", "Total Sessions", "Attendance Percentage"];
    const rows = [headers];
    
    reportRows.forEach(r => {
      const row = [r.registerNo, r.name];
      allSessions.forEach(s => {
        row.push(r.attendanceSet.has(s.id) ? "✓" : "—");
      });
      row.push(r.sessionsPresent.toString(), r.totalSessions.toString(), `${r.percentage}%`);
      rows.push(row);
    });
    
    downloadCSV(rows, "Complete_Attendance_Report.csv");
  };

  const downloadCSV = (rows: string[][], filename: string) => {
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.map(item => `"${(item || '').toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isLoggedIn) {
    return (
      <main className="admin-page">
        <div className="admin-top">
          <Link href="/admin/attendance" className="back-link"><ArrowLeft size={18} /> Back to Attendance</Link>
          <div className="admin-brand">ATTENDANCE REPORT</div>
        </div>
        <div className="admin-login-wrap">
          <div className="admin-login-card">
            <h2>ACCESS DENIED</h2>
            <input type="password" placeholder="Password"
              className="admin-login-input"
              value={loginInput} onChange={(e) => setLoginInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()} autoFocus />
            <button className="primary-button admin-login-btn" onClick={handleLogin} disabled={loading}>
              {loading ? "Verifying..." : "LOGIN"}
            </button>
            {actionMsg && <p style={{color: "red", marginTop: 10}}>{actionMsg}</p>}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page" style={{ paddingBottom: 100 }}>
      <div className="admin-top">
        <Link href="/admin/attendance" className="back-link"><ArrowLeft size={18} /> Back to Attendance</Link>
        <div className="admin-brand">ATTENDANCE REPORT</div>
      </div>

      <div className="admin-shell">
        <div className="admin-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 20 }}>
          <div>
            <span className="brush-label">EVENT STATISTICS</span>
            <h1>Attendance Report</h1>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {selectedSessionId !== "ALL" && (
               <button className="secondary-button" onClick={exportCurrentSessionCSV} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                 <Download size={16} /> EXPORT SESSION
               </button>
            )}
            <button className="primary-button" onClick={exportCompleteCSV} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Download size={16} /> EXPORT COMPLETE REPORT
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 100 }}><Loader2 size={40} className="spin-icon" /></div>
        ) : (
          <>
            <div style={{ background: "white", padding: 20, borderRadius: 8, marginBottom: 20, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 250 }}>
                <label style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#555" }}>SELECT REPORT VIEW</label>
                <select 
                  value={selectedSessionId} 
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  style={{ padding: "10px", borderRadius: 4, border: "1px solid #ddd", fontSize: 16, background: "#f8f9fa", fontWeight: "bold" }}
                >
                  <option value="ALL">Complete Attendance Report</option>
                  {daysConfig.map(d => (
                    <optgroup key={`day-${d.day}`} label={`Day ${d.day} (${d.date})`}>
                      {d.sessions.map(s => (
                        <option key={s.id} value={s.id}>{`Day ${d.day} · ${s.name}`}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              
              <div className="search" style={{ flex: 1, margin: 0, minWidth: 250 }}>
                <Search size={18} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter participants..." />
              </div>
            </div>
            
            {selectedSessionId !== "ALL" && sessionStats && (
               <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 20, marginBottom: 20 }}>
                 <div style={{ background: "white", padding: 20, borderRadius: 8, textAlign: "center", border: "1px solid #eaeaea" }}>
                   <div style={{ fontSize: "0.85rem", color: "#888", fontWeight: "bold" }}>TOTAL ELIGIBLE</div>
                   <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#333" }}>{totalEligible}</div>
                 </div>
                 <div style={{ background: "#f0fdf4", padding: 20, borderRadius: 8, textAlign: "center", border: "1px solid #86efac" }}>
                   <div style={{ fontSize: "0.85rem", color: "#166534", fontWeight: "bold" }}>PRESENT</div>
                   <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#14532d" }}>{sessionStats.present}</div>
                 </div>
                 <div style={{ background: "#fff5f5", padding: 20, borderRadius: 8, textAlign: "center", border: "1px solid #feb2b2" }}>
                   <div style={{ fontSize: "0.85rem", color: "#9b2c2c", fontWeight: "bold" }}>NOT MARKED</div>
                   <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#742a2a" }}>{sessionStats.notMarked}</div>
                 </div>
                 <div style={{ background: "white", padding: 20, borderRadius: 8, textAlign: "center", border: "1px solid #eaeaea" }}>
                   <div style={{ fontSize: "0.85rem", color: "#888", fontWeight: "bold" }}>ATTENDANCE %</div>
                   <div style={{ fontSize: "2rem", fontWeight: "bold", color: "var(--primary)" }}>{sessionStats.percentage}%</div>
                 </div>
               </div>
            )}

            <div className="admin-table-card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Register No.</th>
                      <th>Name</th>
                      {selectedSessionId === "ALL" ? (
                        <>
                          {allSessions.map(s => <th key={s.id} style={{textAlign: "center"}}>{s.label}</th>)}
                          <th style={{textAlign: "center"}}>Total</th>
                          <th style={{textAlign: "center"}}>%</th>
                        </>
                      ) : (
                        <>
                          <th>Dept</th>
                          <th>Year</th>
                          <th>Status</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map(r => (
                      <tr key={r.registerNo}>
                        <td style={{ fontWeight: "bold", color: "#333" }}>{r.registerNo}</td>
                        <td>{r.name}</td>
                        {selectedSessionId === "ALL" ? (
                          <>
                            {allSessions.map(s => (
                              <td key={s.id} style={{textAlign: "center"}}>
                                {r.attendanceSet.has(s.id) ? <CheckCircle2 size={18} style={{ color: "#16a34a", margin: "0 auto" }} /> : <span style={{color: "#ccc"}}>—</span>}
                              </td>
                            ))}
                            <td style={{textAlign: "center", fontWeight: "bold"}}>{r.sessionsPresent} / {r.totalSessions}</td>
                            <td style={{textAlign: "center"}}>
                              <span style={{ 
                                padding: "4px 8px", 
                                borderRadius: 10, 
                                fontSize: "0.85rem", 
                                background: r.percentage >= 75 ? "#dcfce7" : r.percentage >= 50 ? "#fef9c3" : "#fee2e2",
                                color: r.percentage >= 75 ? "#166534" : r.percentage >= 50 ? "#854d0e" : "#991b1b",
                                fontWeight: "bold"
                              }}>
                                {r.percentage}%
                              </span>
                            </td>
                          </>
                        ) : (
                          <>
                            <td>{r.department}</td>
                            <td>{r.year}</td>
                            <td>
                              {r.attendanceSet.has(selectedSessionId) ? (
                                <span className="status-pill pill-paid">PRESENT</span>
                              ) : (
                                <span className="status-pill pill-rejected">ABSENT</span>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {reportRows.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "#888" }}>No participants found.</div>}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
