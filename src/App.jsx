import React, { useEffect, useMemo, useRef, useState } from "react";
import logoUrl from "./assets/logo.jpeg";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

const defaultTeams = Array.from({ length: 9 }, (_, i) => `Team ${i + 1}`);
const palette = ["#3b82f6","#06b6d4","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#f97316","#84cc16"];

function useSpinSound() {
  const ctxRef = useRef(null);
  const gainRef = useRef(null);
  const oscRef = useRef(null);
  
  const start = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = ctxRef.current || new AudioCtx();
      ctxRef.current = ctx;
      
      // Create multiple oscillators for a richer sound
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      // Main tone - spinning wheel sound
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(220, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 2.5);
      
      // Sub tone for richness
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(110, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 2.5);
      
      // Filter for professional sound
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(800, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.3);
      
      // Volume envelope
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 2.0);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);
      
      // Connect audio nodes
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      
      osc1.start();
      osc2.start();
      
      oscRef.current = [osc1, osc2];
      gainRef.current = gain;
    } catch {}
  };
  
  const stop = () => {
    const ctx = ctxRef.current;
    if (!ctx || !gainRef.current || !oscRef.current) return;
    try {
      const now = ctx.currentTime;
      gainRef.current.gain.cancelScheduledValues(now);
      gainRef.current.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      oscRef.current.forEach(osc => osc.stop(now + 0.3));
    } catch {}
    gainRef.current = null;
    oscRef.current = null;
  };
  
  return { start, stop };
}

function useWheel(remaining) {
  const shellRef = useRef(null);
  const canvasRef = useRef(null);
  const angleRef = useRef(0);
  const spinningRef = useRef(false);
  const [redrawTick, setRedrawTick] = useState(0);

  // Responsive canvas size (DPR-aware)
  useEffect(() => {
    const resize = () => {
      const shell = shellRef.current;
      const canvas = canvasRef.current;
      if (!shell || !canvas) return;
      const cssSize = shell.clientWidth;              // pixel width of container
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = cssSize + "px";
      canvas.style.height = cssSize + "px";
      canvas.width = Math.round(cssSize * dpr);
      canvas.height = Math.round(cssSize * dpr);
      setRedrawTick((n) => n + 1);                    // trigger redraw
    };
    resize();
    let ro;
    if ("ResizeObserver" in window) {
      ro = new ResizeObserver(resize);
      ro.observe(shellRef.current);
    } else {
      window.addEventListener("resize", resize);
    }
    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", resize);
    };
  }, []);

  // draw segments at current size
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1,0,0,1,0,0);                    // reset transform
    const radius = Math.min(canvas.width, canvas.height) / 2;
    const center = { x: radius, y: radius };
    const segs = remaining.length;
    const arc = (Math.PI * 2) / Math.max(1, segs);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw outer shadow/border
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius - 2 * dpr, 0, Math.PI * 2);
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 4 * dpr;
    ctx.stroke();

    for (let i = 0; i < segs; i++) {
      const start = i * arc - Math.PI / 2;
      const end = start + arc;
      
      // Main segment
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.arc(center.x, center.y, radius - 8 * dpr, start, end);
      ctx.closePath();
      ctx.fillStyle = palette[i % palette.length];
      ctx.fill();
      
      // Segment border
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3 * dpr;
      ctx.stroke();

      // Text with better positioning
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate((start + end) / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.max(14, 18 * dpr)}px Inter, system-ui, Arial`;
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 2 * dpr;
      ctx.fillText(remaining[i], radius - 25 * dpr, 6 * dpr);
      ctx.restore();
    }
  }, [remaining, redrawTick]);

  const spin = () =>
    new Promise((resolve) => {
      if (spinningRef.current || remaining.length === 0) return resolve();
      spinningRef.current = true;
      let a = angleRef.current;
      let speed = 0.35 + Math.random() * 0.15;
      const friction = 0.985;
      const step = () => {
        a += speed;
        speed *= friction;
        angleRef.current = a;
        canvasRef.current.style.transform = `rotate(${a}rad)`;
        if (speed > 0.002) requestAnimationFrame(step);
        else { spinningRef.current = false; resolve(); }
      };
      requestAnimationFrame(step);
    });

  const settleIndex = () => {
    const segs = remaining.length;
    const arc = (Math.PI * 2) / Math.max(1, segs);
    let a = (angleRef.current % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    let idx =
      Math.floor(((Math.PI * 2) - (a % (Math.PI * 2))) / arc - 0.0001) %
      Math.max(1, segs);
    if (idx < 0) idx += segs;
    return idx;
  };

  const resetRotation = () => {
    angleRef.current = 0;
    if (canvasRef.current) canvasRef.current.style.transform = "rotate(0rad)";
    setRedrawTick((n) => n + 1);
  };

  return { shellRef, canvasRef, spin, settleIndex, resetRotation };
}

const STORAGE_KEY = "scw_state_v1";
const saveState = (s) => localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
const loadState = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); }
  catch { return null; }
};
const clearState = () => localStorage.removeItem(STORAGE_KEY);

export default function App(){
  const saved = loadState();
  const [inputs,setInputs] = useState(saved?.inputs || defaultTeams);
  const [teams,setTeams] = useState(saved?.teams || defaultTeams);
  const [remaining,setRemaining] = useState(saved?.remaining || defaultTeams);
  const [assigned,setAssigned] = useState(saved?.assigned || []);

  const { start:startSound, stop:stopSound } = useSpinSound();
  const { shellRef, canvasRef, spin, settleIndex, resetRotation } = useWheel(remaining);

  useEffect(()=>{ saveState({inputs,teams,remaining,assigned}); },[inputs,teams,remaining,assigned]);

  const GA = useMemo(()=>[assigned[0],assigned[3],assigned[6]],[assigned]);
  const GB = useMemo(()=>[assigned[1],assigned[4],assigned[7]],[assigned]);
  const GC = useMemo(()=>[assigned[2],assigned[5],assigned[8]],[assigned]);

  const onSpin = async () => {
    if (remaining.length===0) return;
    startSound();
    await spin();
    stopSound();
    const idx = settleIndex();
    const name = remaining[idx];
    setTimeout(()=>{
      setRemaining(prev => {
        const next=[...prev]; next.splice(idx,1); return next;
      });
      setAssigned(a=>[...a,name]);
    }, 1000); // appear 1s AFTER spin stops
  };

  const apply = ()=>{
    const clean = inputs.map((v,i)=>v.trim()||`Team ${i+1}`);
    setTeams(clean); setAssigned([]); setRemaining(clean); resetRotation();
  };
  const reset = ()=>{ setAssigned([]); setRemaining(teams); resetRotation(); };
  const clearSaved = ()=> clearState();
  const full = assigned.length>=9;

  const STARTS = ["09:00 AM","10:45 AM","12:30 PM","14:15 PM","16:00 PM"];
  const DATE_GROUPS = "20.09.2025"; const DATE_KO="21.09.2025";
  const buildRowsGroupA = (T)=>[
    ["1", `${T[0]||""} vs ${T[1]||""}`, "Field 1", STARTS[0], DATE_GROUPS],
    ["4", `${T[1]||""} vs ${T[2]||""}`, "Field 2", STARTS[1], DATE_GROUPS],
    ["7", `${T[0]||""} vs ${T[2]||""}`, "Field 1", STARTS[3], DATE_GROUPS],
  ];
  const buildRowsGroupB = (T)=>[
    ["2", `${T[0]||""} vs ${T[1]||""}`, "Field 2", STARTS[0], DATE_GROUPS],
    ["5", `${T[1]||""} vs ${T[2]||""}`, "Field 1", STARTS[2], DATE_GROUPS],
    ["8", `${T[0]||""} vs ${T[2]||""}`, "Field 2", STARTS[3], DATE_GROUPS],
  ];
  const buildRowsGroupC = (T)=>[
    ["3", `${T[0]||""} vs ${T[1]||""}`, "Field 1", STARTS[1], DATE_GROUPS],
    ["6", `${T[1]||""} vs ${T[2]||""}`, "Field 2", STARTS[2], DATE_GROUPS],
    ["9", `${T[0]||""} vs ${T[2]||""}`, "Field 2", STARTS[4], DATE_GROUPS],
  ];
  const fillTable = (id, rows)=>{
    const tbody = document.querySelector(`#${id} tbody`);
    tbody.innerHTML = rows.map(r=>`<tr>${r.map(c=>`<td>${c||""}</td>`).join("")}</tr>`).join("");
  };
  
  async function generatePdf(){
    fillTable("tableA", buildRowsGroupA(GA));
    fillTable("tableB", buildRowsGroupB(GB));
    fillTable("tableC", buildRowsGroupC(GC));
    fillTable("tableD", [
      ["10","2A vs 2B","Field 1","16:15 PM",DATE_GROUPS],
      ["11","2B vs 2C","Field 1","09:00 AM",DATE_KO],
      ["12","2A vs 2C","Field 1","10:45 AM",DATE_KO],
    ]);
    fillTable("tableK", [
      ["13","Semi Final 1: Winner A vs Winner C","Field 1","12:00 PM",DATE_KO],
      ["14","Semi Final 2: Winner B vs Winner D","Field 1","13:45 PM",DATE_KO],
      ["15","Final: Winner SF1 vs Winner SF2","Field 1","16:00 PM",DATE_KO],
    ]);
    
    const fixtureEl = document.getElementById("fixture");
    fixtureEl.style.display = "block";
    await new Promise(r=>setTimeout(r,100));
    
    // Capture with higher quality but smaller scale for better PDF fit
    const canvas = await html2canvas(fixtureEl, {
      scale: 1.5,
      backgroundColor: "#fff",
      useCORS: true,
      logging: false
    });
    
    const img = canvas.toDataURL("image/png", 0.95);
    const pdf = new jsPDF({unit:"pt", format:"a4"});
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 30;
    const contentWidth = pageWidth - (margin * 2);
    const contentHeight = pageHeight - (margin * 2);
    
    // Calculate scaled dimensions
    const imgAspectRatio = canvas.width / canvas.height;
    let imgWidth = contentWidth;
    let imgHeight = contentWidth / imgAspectRatio;
    
    // If image is too tall for one page, fit to page height
    if (imgHeight > contentHeight) {
      imgHeight = contentHeight;
      imgWidth = contentHeight * imgAspectRatio;
    }
    
    // Center the image
    const x = (pageWidth - imgWidth) / 2;
    const y = margin;
    
    pdf.addImage(img, "PNG", x, y, imgWidth, imgHeight);
    pdf.save("Strikers_Cup_2025_Fixture.pdf");
    fixtureEl.style.display = "none";
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo-section">
            <img src={logoUrl} alt="Strikers Cup Logo" className="header-logo" />
            <div>
              <h1 className="title">Strikers Cup 2025</h1>
              <p className="subtitle">Tournament Draw & Fixture Generator</p>
            </div>
          </div>
          <div className="status-badge">
            <span className="status-text">{assigned.length}/9 Teams Assigned</span>
            <div className="progress-bar">
              <div className="progress-fill" style={{width: `${(assigned.length/9)*100}%`}}></div>
            </div>
          </div>
        </div>
      </header>

      <main className="main-content">
        {/* Groups Section */}
        <section className="groups-section">
          <h2 className="section-title">Group Assignments</h2>
          <div className="groups-grid">
            {["A","B","C"].map((g,gi)=>(
              <div key={g} className="group-card">
                <div className="group-header">
                  <h3 className="group-title">Group {g}</h3>
                  <span className="group-count">{[0,1,2].filter(s => assigned[gi + s*3]).length}/3</span>
                </div>
                <div className="group-slots">
                  {[0,1,2].map((s)=>{
                    const idx = gi + s*3;
                    const name = assigned[idx] || "";
                    return (
                      <div key={s} className={`team-slot ${name ? 'filled' : 'empty'}`}>
                        <span className="slot-number">{s+1}</span>
                        <span className="team-name">{name || "Waiting..."}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Wheel Section */}
        <section className="wheel-section">
          <div className="wheel-container">
            <div className="wheel-wrapper" ref={shellRef}>
              <div className="wheel-pointer" />
              <canvas className="wheel-canvas" ref={canvasRef}></canvas>
              <div className="wheel-center">
                <img src={logoUrl} alt="logo" className="center-logo" />
              </div>
            </div>
            
            <div className="wheel-controls">
              <button 
                className="btn btn-primary btn-large" 
                onClick={onSpin} 
                disabled={remaining.length===0}
              >
                <svg className="btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {remaining.length > 0 ? `Spin (${remaining.length} left)` : 'All Teams Assigned'}
              </button>
              
              <div className="control-row">
                <button className="btn btn-secondary" onClick={reset}>
                  <svg className="btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reset Draw
                </button>
                <button className="btn btn-success" onClick={generatePdf} disabled={!full}>
                  <svg className="btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download PDF
                </button>
              </div>
            </div>

            <div className="draw-info">
              <p className="draw-order">
                <strong>Draw Order:</strong> A1 → B1 → C1 → A2 → B2 → C2 → A3 → B3 → C3
              </p>
            </div>
          </div>
        </section>

        {/* Team Editor Section */}
        <section className="editor-section">
          <div className="editor-card">
            <h2 className="section-title">Team Configuration</h2>
            
            <div className="team-inputs">
              {Array.from({length:9}).map((_,i)=>(
                <div key={i} className="input-group">
                  <label className="input-label">Team {i+1}</label>
                  <input 
                    className="team-input" 
                    value={inputs[i] ?? `Team ${i+1}`} 
                    onChange={e=>{
                      const copy=[...inputs]; copy[i]=e.target.value; setInputs(copy);
                    }}
                    placeholder={`Team ${i+1}`}
                  />
                </div>
              ))}
            </div>
            
            <div className="editor-controls">
              <button className="btn btn-primary" onClick={apply}>
                <svg className="btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Apply Changes
              </button>
              <button className="btn btn-secondary" onClick={()=>{
                const arr=[...inputs];
                for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]] }
                setInputs(arr);
              }}>
                <svg className="btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                Shuffle Names
              </button>
            </div>

            <div className="storage-info">
              <p className="info-text">
                <svg className="info-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Your progress is automatically saved locally
              </p>
              <button className="btn btn-danger btn-small" onClick={clearSaved}>
                Clear Saved Data
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Hidden Fixture for PDF */}
      <div className="fixture" id="fixture">
        <div className="fixture-header">
          <img src={logoUrl} alt="Strikers Cup Logo" className="fixture-logo" />
          <div>
            <h1 className="fixture-title">Strikers Cup 2025</h1>
            <p className="fixture-subtitle">Official Tournament Fixture</p>
          </div>
        </div>

        <div className="fixture-section">
          <h2>Group Stage - Group A</h2>
          <table id="tableA" className="fixture-table">
            <thead>
              <tr><th>Match</th><th>Fixture</th><th>Ground</th><th>Time</th><th>Date</th></tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>

        <div className="fixture-section">
          <h2>Group Stage - Group B</h2>
          <table id="tableB" className="fixture-table">
            <thead>
              <tr><th>Match</th><th>Fixture</th><th>Ground</th><th>Time</th><th>Date</th></tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>

        <div className="fixture-section">
          <h2>Group Stage - Group C</h2>
          <table id="tableC" className="fixture-table">
            <thead>
              <tr><th>Match</th><th>Fixture</th><th>Ground</th><th>Time</th><th>Date</th></tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>

        <div className="fixture-section">
          <h2>Group D - 2nd Place Round Robin</h2>
          <table id="tableD" className="fixture-table">
            <thead>
              <tr><th>Match</th><th>Fixture</th><th>Ground</th><th>Time</th><th>Date</th></tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>

        <div className="fixture-section">
          <h2>Knockout Stage</h2>
          <table id="tableK" className="fixture-table">
            <thead>
              <tr><th>Match</th><th>Fixture</th><th>Ground</th><th>Time</th><th>Date</th></tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
