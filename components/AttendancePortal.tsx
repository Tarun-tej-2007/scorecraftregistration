"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, RefreshCw, Search, Loader2, QrCode } from "lucide-react";
import Link from "next/link";

type AttendanceRecord = {
  _id: string;
  registerNo: string;
  name: string;
  department: string;
  year: string;
  phone: string;
  registrationId: string;
  date: string;
  day: number;
  status: string;
  markedAt: string;
  method: string;
};

export default function AttendancePortal() {
  const [adminKey, setAdminKey] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginInput, setLoginInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [query, setQuery] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [markLoading, setMarkLoading] = useState(false);
  
  // Scanning/Manual entry state
  const [scanInput, setScanInput] = useState("");
  const [day, setDay] = useState(1);
  const dateStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const saved = sessionStorage.getItem("admin-key");
    if (saved) { setAdminKey(saved); setIsLoggedIn(true); }
  }, []);

  const loadData = useCallback(async (key: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/attendance", { headers: { "x-admin-key": key } });
      if (res.status === 401) { handleLogout(); return; }
      const data = await res.json();
      setRecords(data.attendance ?? []);
    } catch {
      setActionMsg("err:Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn && adminKey) loadData(adminKey);
  }, [isLoggedIn, adminKey, loadData]);

  async function handleLogin() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: loginInput }),
      });
      if (!res.ok) { setActionMsg("err:Incorrect password."); return; }
      sessionStorage.setItem("admin-key", loginInput);
      setAdminKey(loginInput);
      setIsLoggedIn(true);
    } catch {
      setActionMsg("err:Network error.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("admin-key");
    setAdminKey(""); setIsLoggedIn(false);
    setRecords([]);
  }

  async function handleMarkAttendance(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!scanInput.trim()) return;
    
    setMarkLoading(true);
    try {
      const res = await fetch("/api/admin/attendance/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({
          registerNumber: scanInput.trim(),
          date: dateStr,
          day: day,
          method: "MANUAL/QR"
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMsg(`err:${data.message}`);
      } else {
        setActionMsg(`ok:${data.message} - ${data.participant?.name || ''}`);
        loadData(adminKey); // refresh table
      }
    } catch {
      setActionMsg("err:Network error.");
    } finally {
      setMarkLoading(false);
      setScanInput("");
    }
  }

  const isOk = (msg: string) => msg.startsWith("ok:");
  const msgText = (msg: string) => msg.replace(/^(ok|err):/, "");

  const filtered = records.filter((r) =>
    [r.registerNo, r.name, r.phone, r.registrationId].some(
      (v) => v?.toLowerCase().includes(query.toLowerCase())
    )
  );

  if (!isLoggedIn) {
    return (
      <main className="admin-page">
        <div className="admin-top">
          <Link href="/" className="back-link"><ArrowLeft size={18} /> Back to event</Link>
          <div className="admin-brand">ATTENDANCE PORTAL</div>
        </div>
        <div className="admin-login-wrap">
          <div className="admin-login-card">
            <h2>ATTENDANCE ACCESS</h2>
            <input type="password" placeholder="Password"
              className="admin-login-input"
              value={loginInput} onChange={(e) => setLoginInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()} autoFocus />
            <button className="primary-button admin-login-btn" onClick={handleLogin} disabled={loading}>
              {loading ? "Verifying..." : "LOGIN"}
            </button>
            {actionMsg && <p style={{color: "red", marginTop: 10}}>{msgText(actionMsg)}</p>}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <div className="admin-top">
        <Link href="/admin" className="back-link"><ArrowLeft size={18} /> Admin Dashboard</Link>
        <div className="admin-brand">ATTENDANCE PORTAL</div>
        <button className="secondary-button" onClick={handleLogout} style={{ marginLeft: "auto" }}>Logout</button>
      </div>

      <div className="admin-shell">
        <div className="admin-heading">
          <div>
            <span className="brush-label">SCAN OR ENTER REGISTER NUMBER</span>
            <h1>Attendance</h1>
          </div>
        </div>

        {actionMsg && (
          <div className={`admin-action-msg ${isOk(actionMsg) ? "msg-success" : "msg-error"}`}>
            {msgText(actionMsg)}
            <button className="msg-close" onClick={() => setActionMsg("")}>✕</button>
          </div>
        )}

        {/* Scan/Manual Entry Block */}
        <div style={{ background: "white", padding: 20, borderRadius: 8, marginBottom: 20, display: "flex", gap: 16, alignItems: "flex-end" }}>
          <form onSubmit={handleMarkAttendance} style={{ display: "flex", gap: 16, flex: 1, alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#555" }}>REGISTER NUMBER (SCAN QR)</label>
              <div style={{ position: "relative" }}>
                <QrCode size={20} style={{ position: "absolute", left: 12, top: 12, color: "#888" }} />
                <input 
                  type="text" 
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="e.g. 99230040835"
                  autoFocus
                  style={{ width: "100%", padding: "10px 10px 10px 40px", borderRadius: 4, border: "1px solid #ddd", fontSize: 16 }}
                />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#555" }}>DAY</label>
              <select 
                value={day} 
                onChange={(e) => setDay(Number(e.target.value))}
                style={{ padding: "10px", borderRadius: 4, border: "1px solid #ddd", fontSize: 16 }}
              >
                <option value={1}>Day 1</option>
                <option value={2}>Day 2</option>
              </select>
            </div>
            <button type="submit" className="primary-button" disabled={markLoading || !scanInput.trim()}>
              {markLoading ? <Loader2 size={16} className="spin-icon" /> : <CheckCircle2 size={16} />}
              MARK PRESENT
            </button>
          </form>
        </div>

        {/* Attendance Table */}
        <div className="admin-table-card">
          <div className="search">
            <Search size={18} />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by registration number, name, phone, registration ID..." />
          </div>

          {loading ? (
            <div className="admin-loading"><Loader2 size={32} className="spin-icon" /> Loading...</div>
          ) : filtered.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Register No.</th>
                    <th>Name</th>
                    <th>Dept.</th>
                    <th>Year</th>
                    <th>Phone</th>
                    <th>Attendance</th>
                    <th>Time</th>
                    <th>Method</th>
                    <th>Reg ID</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((record) => (
                    <tr key={record._id}>
                      <td style={{ fontWeight: "bold", color: "var(--primary)" }}>{record.registerNo}</td>
                      <td>{record.name}</td>
                      <td>{record.department}</td>
                      <td>{record.year}</td>
                      <td>{record.phone}</td>
                      <td>
                        <span className="status-pill pill-paid">
                          Day {record.day}: {record.status}
                        </span>
                      </td>
                      <td>{new Date(record.markedAt).toLocaleString()}</td>
                      <td>{record.method}</td>
                      <td><small className="td-mono">{record.registrationId}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-loading">No attendance records found.</div>
          )}
        </div>
      </div>
    </main>
  );
}
