"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Search, Loader2, QrCode, Camera, XCircle, Settings, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";

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
  name: string;
  department: string;
  year: string;
  phone: string;
  registrationId: string;
  date: string;
  day: number;
  session: string;
  sessionId: string;
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
};

export default function AttendancePortal() {
  const [adminKey, setAdminKey] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginInput, setLoginInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Configuration State
  const [daysConfig, setDaysConfig] = useState<DayConfig[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [query, setQuery] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [markLoading, setMarkLoading] = useState(false);
  
  // Scanning/Manual entry state
  const [scanInput, setScanInput] = useState("");

  // Scanner UI State
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [cameraLoading, setCameraLoading] = useState(false);
  const [decodedValue, setDecodedValue] = useState("");
  
  // Camera Selection
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  
  // Scanned Participant Validation State
  const [scannedParticipant, setScannedParticipant] = useState<ScannedParticipant | null>(null);
  const [participantLookupLoading, setParticipantLookupLoading] = useState(false);
  const [participantLookupError, setParticipantLookupError] = useState("");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("admin-key");
    if (saved) { setAdminKey(saved); setIsLoggedIn(true); }
  }, []);

  const loadData = useCallback(async (key: string) => {
    setLoading(true);
    try {
      // Load Configuration
      const confRes = await fetch("/api/admin/attendance/settings", { headers: { "x-admin-key": key } });
      if (confRes.status === 401) { handleLogout(); return; }
      const confData = await confRes.json();
      if (confData.config && confData.config.days.length > 0) {
         setDaysConfig(confData.config.days);
         // Select first session by default if not set
         if (!selectedSessionId) {
            setSelectedSessionId(confData.config.days[0].sessions[0].id);
         }
      }
      
      // Load Attendance Records
      const res = await fetch("/api/admin/attendance", { headers: { "x-admin-key": key } });
      const data = await res.json();
      setRecords(data.attendance ?? []);
    } catch {
      setActionMsg("err:Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [selectedSessionId]);

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
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    setShowScanner(false);
  }, []);

  useEffect(() => {
    return () => { stopScanner(); };
  }, [stopScanner]);

  useEffect(() => {
    if (showScanner) {
      startScanner(selectedCameraId);
    }
  }, [showScanner, selectedCameraId]);

  const startScanner = async (deviceId?: string) => {
    setCameraLoading(true);
    setScannerError("");
    setDecodedValue("");
    
    try {
      const codeReader = new BrowserMultiFormatReader();
      
      if (cameras.length === 0) {
        const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();
        setCameras(videoInputDevices);
        if (!deviceId && videoInputDevices.length > 0) {
           // Try to find a back camera
           const backCamera = videoInputDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
           setSelectedCameraId(backCamera ? backCamera.deviceId : videoInputDevices[0].deviceId);
           // return so the effect triggers again with selectedCameraId
           return;
        }
      }
      
      if (!videoRef.current) return;
      
      controlsRef.current = await codeReader.decodeFromVideoDevice(deviceId || undefined, videoRef.current, (result, error) => {
        if (result) {
          handleQRFound(result.getText());
        }
      });
      setCameraLoading(false);
    } catch (err: any) {
      console.error("Camera error:", err);
      setScannerError("CAMERA NOT AVAILABLE. Please allow camera access to scan the participant QR code.");
      setCameraLoading(false);
    }
  };

  const handleQRFound = (data: string) => {
    stopScanner();
    const cleanData = data.trim();
    setDecodedValue(cleanData);
    lookupParticipant(cleanData);
  };

  const lookupParticipant = async (decodedVal: string) => {
    setParticipantLookupLoading(true);
    setScannedParticipant(null);
    setParticipantLookupError("");
    setActionMsg("");
    setScanInput("");
    
    try {
      const res = await fetch("/api/admin/attendance/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ decodedValue: decodedVal })
      });
      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 404) {
          setParticipantLookupError(`ID CARD DETECTED BUT PARTICIPANT NOT FOUND\nDecoded identifier: ${decodedVal}\nWe couldn't match this ID card to a registered participant.`);
        } else if (res.status === 400 && data.participant) {
          setParticipantLookupError(`REGISTRATION NOT CONFIRMED\nName: ${data.participant.name}\nRegister Number: ${data.participant.registerNo}\nStatus: ${data.participant.registrationStatus}\nThis participant cannot be marked present.`);
        } else {
          setParticipantLookupError(`ERROR: ${data.message}`);
        }
      } else {
        const p = data.participant;
        // Check if already marked for current session
        const already = records.find(r => r.registerNo.toLowerCase() === p.registerNo.toLowerCase() && r.sessionId === selectedSessionId);
        if (already) {
           const sessionName = getSessionName(selectedSessionId);
           setParticipantLookupError(`ALREADY MARKED\nName: ${p.name}\nRegister Number: ${p.registerNo}\nSession: ${sessionName}\nMarked at: ${new Date(already.markedAt).toLocaleTimeString()}\nDo not create another record.`);
        } else {
           setScanInput(p.registerNo); // Set the actual register number
           setScannedParticipant(p);
        }
      }
    } catch (e) {
      setParticipantLookupError("Network error during resolution.");
    } finally {
      setParticipantLookupLoading(false);
    }
  };

  const getSessionName = (id: string) => {
    for (const d of daysConfig) {
      for (const s of d.sessions) {
        if (s.id === id) return `Day ${d.day} · ${s.name}`;
      }
    }
    return "Unknown Session";
  };
  
  const getSessionDate = (id: string) => {
    for (const d of daysConfig) {
      for (const s of d.sessions) {
        if (s.id === id) return d.date;
      }
    }
    return new Date().toISOString().split('T')[0];
  };

  async function handleMarkAttendance(e?: React.FormEvent) {
    if (e) e.preventDefault();
    
    // If not validated yet but we have manual input
    if (!scannedParticipant && scanInput.trim() && !participantLookupError) {
      await lookupParticipant(scanInput.trim());
      return;
    }
    
    if (scannedParticipant && selectedSessionId) {
      setMarkLoading(true);
      
      // Find actual session name
      let sName = "Unknown";
      for (const d of daysConfig) {
        for (const s of d.sessions) {
          if (s.id === selectedSessionId) sName = s.name;
        }
      }

      try {
        const res = await fetch("/api/admin/attendance/mark", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
          body: JSON.stringify({
            registerNumber: scannedParticipant.registerNo,
            sessionId: selectedSessionId,
            session: sName,
            date: getSessionDate(selectedSessionId),
            method: "QR"
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setActionMsg(`err:${data.message}`);
        } else {
          setActionMsg(`ok:ATTENDANCE MARKED - ${scannedParticipant.name}`);
          setScannedParticipant(null); 
          loadData(adminKey);
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

  const sessionRecords = records.filter(r => r.sessionId === selectedSessionId);
  const filtered = sessionRecords.filter((r) =>
    [r.registerNo, r.name, r.phone, r.registrationId].some(
      (v) => v?.toLowerCase().includes(query.toLowerCase())
    )
  );
  
  // Sort by latest first
  filtered.sort((a,b) => new Date(b.markedAt).getTime() - new Date(a.markedAt).getTime());

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
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <Link href="/admin/attendance/report" className="secondary-button" style={{ display: "flex", alignItems: "center", gap: 6 }}><FileSpreadsheet size={16}/> Report</Link>
          <Link href="/admin/attendance/settings" className="secondary-button" style={{ display: "flex", alignItems: "center", gap: 6 }}><Settings size={16}/> Config</Link>
          <button className="secondary-button" onClick={handleLogout}>Logout</button>
        </div>
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
          <form onSubmit={(e) => { e.preventDefault(); if (scanInput) lookupParticipant(scanInput.trim()); }} style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#555" }}>ATTENDANCE SESSION</label>
              <select 
                value={selectedSessionId} 
                onChange={(e) => setSelectedSessionId(e.target.value)}
                style={{ padding: "10px", borderRadius: 4, border: "1px solid #ddd", fontSize: 16, background: "#f8f9fa", fontWeight: "bold" }}
              >
                {daysConfig.length === 0 && <option value="">Loading sessions...</option>}
                {daysConfig.map(d => (
                  <optgroup key={`day-${d.day}`} label={`Day ${d.day} (${d.date})`}>
                    {d.sessions.map(s => (
                      <option key={s.id} value={s.id}>{`Day ${d.day} · ${s.name} (${s.startTime} - ${s.endTime})`}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            
            <button type="button" className="primary-button" onClick={() => setShowScanner(true)} style={{ background: "var(--primary)", padding: "10px 20px" }} disabled={!selectedSessionId}>
              <Camera size={18} /> SCAN ID CARD
            </button>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 200 }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#555" }}>MANUAL REGISTER NUMBER</label>
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
            
            <button type="submit" className="secondary-button" disabled={participantLookupLoading || !scanInput.trim()}>
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
               <p key={i} style={{ margin: "5px 0", color: "#742a2a", wordBreak: "break-all" }}>{line}</p>
             ))}
             <div style={{ display: "flex", gap: 10, marginTop: 15 }}>
               <button className="primary-button" onClick={() => setShowScanner(true)}><Camera size={16}/> TRY AGAIN</button>
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
            
            {decodedValue && decodedValue !== scannedParticipant.registerNo && (
               <div style={{ marginBottom: 15, padding: 10, background: "#e6f4ea", borderRadius: 4, fontSize: "0.85rem", color: "#14532d" }}>
                 <strong>Decoded Code:</strong> {decodedValue} <br/>
                 <strong>Resolved to:</strong> {scannedParticipant.registerNo}
               </div>
            )}
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              <div><small style={{color:"#166534"}}>Name</small><div style={{fontWeight:"bold", color:"#14532d"}}>{scannedParticipant.name}</div></div>
              <div><small style={{color:"#166534"}}>Register Number</small><div style={{fontWeight:"bold", color:"#14532d"}}>{scannedParticipant.registerNo}</div></div>
              <div><small style={{color:"#166534"}}>Department</small><div style={{fontWeight:"bold", color:"#14532d"}}>{scannedParticipant.department}</div></div>
              <div><small style={{color:"#166534"}}>Year</small><div style={{fontWeight:"bold", color:"#14532d"}}>{scannedParticipant.year}</div></div>
              <div><small style={{color:"#166534"}}>Current Session</small><div style={{fontWeight:"bold", color:"#14532d"}}>{getSessionName(selectedSessionId)}</div></div>
            </div>
            <button className="primary-button" onClick={handleMarkAttendance} disabled={markLoading} style={{ width: "100%", padding: 15, fontSize: "1.1rem" }}>
              {markLoading ? <Loader2 size={20} className="spin-icon" /> : <CheckCircle2 size={20} />}
              MARK PRESENT
            </button>
          </div>
        )}

        {/* Scanner Modal */}
        {showScanner && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: "white", width: "100%", maxWidth: 500, borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "15px 20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>SCAN ID CARD</h3>
                <button onClick={stopScanner} style={{ background: "none", border: "none", cursor: "pointer", color: "#888" }}><XCircle size={24} /></button>
              </div>
              
              <div style={{ position: "relative", width: "100%", background: "#000", aspectRatio: "1/1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {cameraLoading && <Loader2 size={40} className="spin-icon" style={{ color: "white", position: "absolute", zIndex: 2 }} />}
                {scannerError ? (
                  <div style={{ padding: 20, color: "white", textAlign: "center", zIndex: 2 }}>
                    <XCircle size={40} style={{ color: "#fc8181", marginBottom: 10 }} />
                    <p>{scannerError}</p>
                    <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
                      <button className="primary-button" onClick={() => startScanner()}>TRY AGAIN</button>
                      <button className="secondary-button" onClick={stopScanner}>ENTER MANUALLY</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    {/* Scanner overlay frame */}
                    <div style={{ position: "absolute", top: "20%", left: "10%", right: "10%", bottom: "20%", border: "2px solid rgba(255,255,255,0.6)", borderRadius: 8, boxShadow: "0 0 0 4000px rgba(0,0,0,0.5)" }}>
                      <div style={{ position: "absolute", top: -2, left: -2, width: 20, height: 20, borderTop: "4px solid #fff", borderLeft: "4px solid #fff" }} />
                      <div style={{ position: "absolute", top: -2, right: -2, width: 20, height: 20, borderTop: "4px solid #fff", borderRight: "4px solid #fff" }} />
                      <div style={{ position: "absolute", bottom: -2, left: -2, width: 20, height: 20, borderBottom: "4px solid #fff", borderLeft: "4px solid #fff" }} />
                      <div style={{ position: "absolute", bottom: -2, right: -2, width: 20, height: 20, borderBottom: "4px solid #fff", borderRight: "4px solid #fff" }} />
                      
                      <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 2, background: "rgba(255, 0, 0, 0.4)", boxShadow: "0 0 4px red" }} />
                    </div>
                  </>
                )}
              </div>
              
              <div style={{ padding: 20 }}>
                <p style={{ margin: "0 0 15px 0", color: "#666", textAlign: "center", fontSize: "0.9rem" }}>Point the camera at the QR code or barcode on the student's ID card.</p>
                
                {cameras.length > 1 && (
                  <div style={{ marginBottom: 15 }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: "bold", display: "block", marginBottom: 4 }}>Camera</label>
                    <select 
                      value={selectedCameraId}
                      onChange={(e) => setSelectedCameraId(e.target.value)}
                      style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
                    >
                      {cameras.map(c => (
                        <option key={c.deviceId} value={c.deviceId}>{c.label || `Camera ${c.deviceId.substring(0, 5)}`}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                <button className="secondary-button" onClick={stopScanner} style={{ width: "100%" }}>CLOSE</button>
              </div>
            </div>
          </div>
        )}

        {/* Attendance Summary and Table */}
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
          <div style={{ flex: "1 1 200px", background: "white", padding: 20, borderRadius: 8, textAlign: "center", border: "1px solid #eaeaea" }}>
            <h4 style={{ margin: 0, color: "#888", fontSize: "0.85rem" }}>PRESENT (CURRENT SESSION)</h4>
            <div style={{ fontSize: "2.5rem", fontWeight: "bold", color: "var(--primary)" }}>{sessionRecords.length}</div>
          </div>
        </div>

        <div className="admin-table-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15, flexWrap: "wrap", gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: "1rem" }}>RECENTLY MARKED</h3>
            <div className="search" style={{ margin: 0 }}>
              <Search size={18} />
              <input value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search session..." />
            </div>
          </div>

          {loading ? (
            <div className="admin-loading"><Loader2 size={32} className="spin-icon" /> Loading...</div>
          ) : filtered.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Register No.</th>
                    <th>Name</th>
                    <th>Dept.</th>
                    <th>Status</th>
                    <th>Method</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((record) => (
                    <tr key={record._id}>
                      <td style={{ whiteSpace: "nowrap" }}>{new Date(record.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td style={{ fontWeight: "bold", color: "var(--primary)" }}>{record.registerNo}</td>
                      <td>{record.name}</td>
                      <td>{record.department}</td>
                      <td>
                        <span className="status-pill pill-paid">
                          ✓ PRESENT
                        </span>
                      </td>
                      <td><small>{record.method}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-loading">No attendance records found for this session.</div>
          )}
        </div>
      </div>
    </main>
  );
}
