"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Search, Loader2, QrCode, Camera, XCircle, ChevronRight } from "lucide-react";
import Link from "next/link";
import jsQR from "jsqr";

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

type ScannedParticipant = {
  name: string;
  registerNo: string;
  department: string;
  year: string;
  registrationStatus: string;
  rejectionReason?: string;
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

  // Scanner UI State
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [cameraLoading, setCameraLoading] = useState(false);
  
  // Scanned Participant Validation State
  const [scannedParticipant, setScannedParticipant] = useState<ScannedParticipant | null>(null);
  const [participantLookupLoading, setParticipantLookupLoading] = useState(false);
  const [participantLookupError, setParticipantLookupError] = useState("");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef<number | null>(null);

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

  const stopScanner = useCallback(() => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setShowScanner(false);
  }, []);

  // Ensure camera closes if component unmounts
  useEffect(() => {
    return () => { stopScanner(); };
  }, [stopScanner]);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });
        
        if (code && code.data) {
          handleQRFound(code.data);
          return; // Stop ticking once found
        }
      }
    }
    if (showScanner) {
      requestRef.current = requestAnimationFrame(tick);
    }
  }, [showScanner]);

  useEffect(() => {
    if (showScanner) {
      setCameraLoading(true);
      setScannerError("");
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.setAttribute("playsinline", "true");
            videoRef.current.play();
            requestRef.current = requestAnimationFrame(tick);
          }
          setCameraLoading(false);
        })
        .catch((err) => {
          console.error("Camera error:", err);
          setScannerError("CAMERA NOT AVAILABLE. Please allow camera access to scan the participant QR code.");
          setCameraLoading(false);
        });
    }
  }, [showScanner, tick]);

  const handleQRFound = (data: string) => {
    stopScanner();
    const regNo = data.trim();
    setScanInput(regNo);
    lookupParticipant(regNo);
  };

  const lookupParticipant = async (regNo: string) => {
    setParticipantLookupLoading(true);
    setScannedParticipant(null);
    setParticipantLookupError("");
    setActionMsg("");
    
    try {
      // We need a specific endpoint to just lookup, or we can use the main admin get user endpoint.
      // Wait, there's no direct "get participant by registerNo" endpoint. Let's do it via the mark endpoint
      // but without actually marking? The mark endpoint does validation. 
      // Actually, we can fetch all records and filter, or we can do a fetch to the mark endpoint with a dry-run flag.
      // But we don't have a dry-run flag. Let's just create a quick client-side filter of the participants list 
      // we already fetched in `loadData`, but `loadData` returns all *confirmed* participants and attendance.
      // Wait, if we use `loadData` we only have confirmed participants. What if they are pending?
      // For now, let's just attempt to mark attendance, and let the backend return the error or success.
      // BUT the prompt says: "Show the participant confirmation briefly and allow: [ MARK PRESENT ] Do NOT automatically mark attendance without giving the admin an opportunity to see which participant was scanned."
      
      // Let's use the attendance records we have to find the participant name, if they are confirmed.
      // If we don't have a lookup endpoint, we might need to rely on the backend.
      // I'll call a new endpoint I'll add quickly, or just use the existing GET /api/admin/registrations and find them.
      const res = await fetch("/api/admin/registrations", { headers: { "x-admin-key": adminKey } });
      const data = await res.json();
      
      if (!res.ok) {
        setParticipantLookupError("Failed to lookup participant.");
        return;
      }
      
      const p = data.registrations.find((r: any) => r.registerNo.toLowerCase() === regNo.toLowerCase());
      
      if (!p) {
        setParticipantLookupError(`PARTICIPANT NOT FOUND\nRegister Number: ${regNo}\nThis registration number is not associated with a SCORECRAFT participant.`);
      } else if (p.registrationStatus !== "CONFIRMED") {
        setParticipantLookupError(`REGISTRATION NOT CONFIRMED\nName: ${p.name}\nRegister Number: ${p.registerNo}\nStatus: ${p.registrationStatus}\nThis participant cannot be marked present.`);
      } else {
        // Check if already marked
        const already = records.find(r => r.registerNo.toLowerCase() === regNo.toLowerCase() && r.day === day);
        if (already) {
           setParticipantLookupError(`ALREADY MARKED\nName: ${p.name}\nRegister Number: ${p.registerNo}\nDay: Day ${day}\nMarked at: ${new Date(already.markedAt).toLocaleTimeString()}\nDo NOT create another attendance record.`);
        } else {
           setScannedParticipant(p);
        }
      }
    } catch (e) {
      setParticipantLookupError("Network error during lookup.");
    } finally {
      setParticipantLookupLoading(false);
    }
  };

  async function handleMarkAttendance(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!scanInput.trim()) return;
    
    // If not validated yet, validate first
    if (!scannedParticipant && !participantLookupError) {
      await lookupParticipant(scanInput.trim());
      return;
    }
    
    // If we have a scanned participant, actually mark them
    if (scannedParticipant) {
      setMarkLoading(true);
      try {
        const res = await fetch("/api/admin/attendance/mark", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
          body: JSON.stringify({
            registerNumber: scannedParticipant.registerNo,
            date: dateStr,
            day: day,
            method: "QR"
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setActionMsg(`err:${data.message}`);
        } else {
          setActionMsg(`ok:ATTENDANCE MARKED - ${scannedParticipant.name} (Day ${day})`);
          setScannedParticipant(null); // Clear so we can show "SCAN NEXT"
          loadData(adminKey); // refresh table
        }
      } catch {
        setActionMsg("err:Network error.");
      } finally {
        setMarkLoading(false);
        setScanInput("");
      }
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
    <main className="admin-page" style={{ paddingBottom: 100 }}>
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

        {/* Scan/Manual Entry Block */}
        <div style={{ background: "white", padding: 20, borderRadius: 8, marginBottom: 20 }}>
          <form onSubmit={(e) => { e.preventDefault(); lookupParticipant(scanInput.trim()); }} style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#555" }}>REGISTER NUMBER</label>
              <input 
                type="text" 
                value={scanInput}
                onChange={(e) => {
                  setScanInput(e.target.value);
                  setScannedParticipant(null);
                  setParticipantLookupError("");
                }}
                placeholder="Enter register number..."
                style={{ width: "100%", padding: "10px", borderRadius: 4, border: "1px solid #ddd", fontSize: 16 }}
              />
            </div>
            
            <button type="button" className="primary-button" onClick={() => setShowScanner(true)} style={{ background: "var(--primary)", padding: "10px 20px" }}>
              <Camera size={18} /> SCAN QR
            </button>
            
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
            
            <button type="submit" className="primary-button" disabled={participantLookupLoading || !scanInput.trim()}>
              {participantLookupLoading ? <Loader2 size={16} className="spin-icon" /> : <Search size={16} />}
              LOOKUP
            </button>
          </form>
        </div>
        
        {/* Validation Error Banner */}
        {participantLookupError && (
          <div style={{ background: "#fff5f5", border: "1px solid #fc8181", padding: 20, borderRadius: 8, marginBottom: 20 }}>
             <h3 style={{ color: "#c53030", margin: "0 0 10px 0" }}>{participantLookupError.split('\n')[0]}</h3>
             {participantLookupError.split('\n').slice(1).map((line, i) => (
               <p key={i} style={{ margin: "5px 0", color: "#742a2a" }}>{line}</p>
             ))}
             <div style={{ display: "flex", gap: 10, marginTop: 15 }}>
               <button className="primary-button" onClick={() => setShowScanner(true)}><Camera size={16}/> SCAN AGAIN</button>
               <button className="secondary-button" onClick={() => { setParticipantLookupError(""); setScanInput(""); }}>ENTER MANUALLY</button>
             </div>
          </div>
        )}

        {/* Action message */}
        {actionMsg && (
          <div className={`admin-action-msg ${isOk(actionMsg) ? "msg-success" : "msg-error"}`} style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <CheckCircle2 size={20} style={{ display: "inline", verticalAlign: "middle", marginRight: 8 }}/>
              <span style={{ fontWeight: "bold", verticalAlign: "middle" }}>{msgText(actionMsg)}</span>
            </div>
            <button className="primary-button" onClick={() => { setActionMsg(""); setShowScanner(true); }}>
              <Camera size={16} /> SCAN NEXT
            </button>
          </div>
        )}

        {/* Found Participant Card */}
        {scannedParticipant && !actionMsg && (
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", padding: 20, borderRadius: 8, marginBottom: 20 }}>
            <h3 style={{ color: "#166534", margin: "0 0 15px 0", display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={20} /> PARTICIPANT FOUND</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              <div><small style={{color:"#166534"}}>Name</small><div style={{fontWeight:"bold", color:"#14532d"}}>{scannedParticipant.name}</div></div>
              <div><small style={{color:"#166534"}}>Register Number</small><div style={{fontWeight:"bold", color:"#14532d"}}>{scannedParticipant.registerNo}</div></div>
              <div><small style={{color:"#166534"}}>Department</small><div style={{fontWeight:"bold", color:"#14532d"}}>{scannedParticipant.department}</div></div>
              <div><small style={{color:"#166534"}}>Year</small><div style={{fontWeight:"bold", color:"#14532d"}}>{scannedParticipant.year}</div></div>
              <div><small style={{color:"#166534"}}>Registration Status</small><div style={{fontWeight:"bold", color:"#14532d"}}>{scannedParticipant.registrationStatus}</div></div>
            </div>
            <button className="primary-button" onClick={handleMarkAttendance} disabled={markLoading} style={{ width: "100%", padding: 15, fontSize: "1.1rem" }}>
              {markLoading ? <Loader2 size={20} className="spin-icon" /> : <CheckCircle2 size={20} />}
              MARK PRESENT (DAY {day})
            </button>
          </div>
        )}

        {/* Scanner Modal */}
        {showScanner && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: "white", width: "100%", maxWidth: 500, borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "15px 20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>SCAN PARTICIPANT QR</h3>
                <button onClick={stopScanner} style={{ background: "none", border: "none", cursor: "pointer", color: "#888" }}><XCircle size={24} /></button>
              </div>
              
              <div style={{ position: "relative", width: "100%", background: "#000", aspectRatio: "1/1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {cameraLoading && <Loader2 size={40} className="spin-icon" style={{ color: "white" }} />}
                {scannerError ? (
                  <div style={{ padding: 20, color: "white", textAlign: "center" }}>
                    <XCircle size={40} style={{ color: "#fc8181", marginBottom: 10 }} />
                    <p>{scannerError}</p>
                    <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
                      <button className="primary-button" onClick={() => {setShowScanner(false); setShowScanner(true);}}>TRY AGAIN</button>
                      <button className="secondary-button" onClick={stopScanner}>ENTER MANUALLY</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    {/* Scanner overlay frame */}
                    <div style={{ position: "absolute", top: "15%", left: "15%", right: "15%", bottom: "15%", border: "2px solid rgba(255,255,255,0.5)", borderRadius: 10, boxShadow: "0 0 0 4000px rgba(0,0,0,0.4)" }}>
                      <div style={{ position: "absolute", top: -2, left: -2, width: 20, height: 20, borderTop: "4px solid #fff", borderLeft: "4px solid #fff" }} />
                      <div style={{ position: "absolute", top: -2, right: -2, width: 20, height: 20, borderTop: "4px solid #fff", borderRight: "4px solid #fff" }} />
                      <div style={{ position: "absolute", bottom: -2, left: -2, width: 20, height: 20, borderBottom: "4px solid #fff", borderLeft: "4px solid #fff" }} />
                      <div style={{ position: "absolute", bottom: -2, right: -2, width: 20, height: 20, borderBottom: "4px solid #fff", borderRight: "4px solid #fff" }} />
                    </div>
                  </>
                )}
                <canvas ref={canvasRef} style={{ display: "none" }} />
              </div>
              
              <div style={{ padding: 20, textAlign: "center" }}>
                <p style={{ margin: "0 0 15px 0", color: "#666" }}>Point the camera at the participant's QR code.</p>
                <button className="secondary-button" onClick={stopScanner} style={{ width: "100%" }}>CLOSE SCANNER</button>
              </div>
            </div>
          </div>
        )}

        {/* Attendance Table */}
        <div className="admin-table-card">
          <div className="search" style={{ marginBottom: 15 }}>
            <Search size={18} />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by registration number, name, phone, registration ID..." />
          </div>

          <h3 style={{ margin: "0 0 15px 0", fontSize: "1rem" }}>RECENT ATTENDANCE</h3>

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
