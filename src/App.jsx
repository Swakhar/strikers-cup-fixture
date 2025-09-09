import React, { useEffect, useMemo, useRef, useState } from "react";
import logoUrl from "./assets/logo.jpeg";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

const defaultTeams = Array.from({ length: 9 }, (_, i) => `Team ${i + 1}`);
const palette = ["#ef4444","#f97316","#f59e0b","#84cc16","#22c55e","#14b8a6","#0ea5e9","#6366f1","#a855f7"];

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
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 2.3);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.6, ctx.currentTime + 0.15);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start();
      oscRef.current = osc; gainRef.current = gain;
    } catch {}
  };
  const stop = () => {
    const ctx = ctxRef.current;
    if (!ctx || !gainRef.current || !oscRef.current) return;
    try {
      const now = ctx.currentTime;
      gainRef.current.gain.cancelScheduledValues(now);
      gainRef.current.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      oscRef.current.stop(now + 0.3);
    } catch {}
    gainRef.current = null; oscRef.current = null;
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
    for (let i = 0; i < segs; i++) {
      const start = i * arc - Math.PI / 2;
      const end = start + arc;
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.arc(center.x, center.y, radius - 6 * dpr, start, end);
      ctx.closePath();
      ctx.fillStyle = palette[i % palette.length];
      ctx.fill();
      ctx.strokeStyle = "#0b2a55";
      ctx.lineWidth = 6 * dpr;
      ctx.stroke();

      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate((start + end) / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.font = `${16 * dpr}px system-ui, Arial`;
      ctx.fillText(remaining[i], radius - 20 * dpr, 8 * dpr);
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
  const [inputs,setInputs]     = useState(saved?.inputs    || defaultTeams);
  const [teams,setTeams]       = useState(saved?.teams     || defaultTeams);
  const [remaining,setRemaining] = useState(saved?.remaining || defaultTeams);
  const [assigned,setAssigned] = useState(saved?.assigned  || []);

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

  // ---- PDF export (unchanged)
  const STARTS = ["08:00 AM","09:45 AM","11:30 AM","01:15 PM","03:00 PM","04:45 PM"];
  const DATE_GROUPS = "20.09.2025"; const DATE_KO="21.09.2025";
  const buildRows = (T)=>[
    ["1", `${T[0]||""} vs ${T[1]||""}`, "Field 1", STARTS[0], DATE_GROUPS],
    ["2", `${T[1]||""} vs ${T[2]||""}`, "Field 2", STARTS[3], DATE_GROUPS],
    ["3", `${T[0]||""} vs ${T[2]||""}`, "Field 1", STARTS[4], DATE_GROUPS],
  ];
  const fillTable = (id, rows)=>{
    const tbody = document.querySelector(`#${id} tbody`);
    tbody.innerHTML = rows.map(r=>`<tr>${r.map(c=>`<td>${c||""}</td>`).join("")}</tr>`).join("");
  };
  async function generatePdf(){
    fillTable("tableA", buildRows(GA));
    fillTable("tableB", buildRows(GB));
    fillTable("tableC", buildRows(GC));
    fillTable("tableD", [
      ["1","2A vs 2B","Field 1","08:00 AM",DATE_GROUPS],
      ["2","2B vs 2C","Field 2","01:15 PM",DATE_GROUPS],
      ["3","2A vs 2C","Field 1","03:00 PM",DATE_GROUPS],
    ]);
    fillTable("tableK", [
      ["1","Semi Final 1: Winner A vs Winner C","Field 1","08:00 AM",DATE_KO],
      ["2","Semi Final 2: Winner B vs Winner D","Field 2","01:15 PM",DATE_KO],
      ["3","Final: Winner SF1 vs Winner SF2","Field 1","03:00 PM",DATE_KO],
    ]);
    const fixtureEl = document.getElementById("fixture");
    fixtureEl.style.display = "block";
    await new Promise(r=>setTimeout(r,0));
    const canvas = await html2canvas(fixtureEl,{scale:2,backgroundColor:"#fff"});
    const img = canvas.toDataURL("image/png");
    const pdf = new jsPDF({unit:"pt", format:"a4"});
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
    const iw = pw - 40, ih = (canvas.height * iw) / canvas.width;
    let y = 20;
    if (ih <= ph - 40) {
      pdf.addImage(img,"PNG",20,y,iw,ih);
    } else {
      // basic pagination
      pdf.addImage(img,"PNG",20,y,iw,ih);
      // (Most fixtures fit one page; extend here if yours exceeds one)
    }
    pdf.save("Strikers_Cup_2025_Fixture.pdf");
    fixtureEl.style.display = "none";
  }

  return (
    <>
      <header><h1>Strikers Cup 2025 — Draw Wheel</h1></header>

      <div className="wrap">
        {/* LEFT: Groups */}
        <div className="groups">
          {["A","B","C"].map((g,gi)=>(
            <div key={g} className="group" id={`G${g}`}>
              <h3>Group {g}</h3>
              {[0,1,2].map((s)=>{
                const idx = gi + s*3;
                const name = assigned[idx] || "";
                return <div key={s} className="slot">{s+1}. <span>{name}</span></div>
              })}
            </div>
          ))}
        </div>

        {/* MIDDLE: Wheel */}
        <div className="middle">
          <div className="wheelShell" ref={shellRef}>
            <div className="pointer" title="Selection Pointer" />
            <canvas id="wheel" ref={canvasRef}></canvas>
            <div className="centerLogo"><img src={logoUrl} alt="logo" /></div>
          </div>
          <div className="btnRow">
            <button className="btn" onClick={onSpin} disabled={remaining.length===0}>Spin</button>
            <button className="btn" style={{background:"#6b7b97"}} onClick={reset}>Reset</button>
            <button className="btn" onClick={generatePdf} disabled={!full}>Download Fixture PDF</button>
          </div>
          <div className="small">Order: <b>A1 → B1 → C1 → A2 → B2 → C2 → A3 → B3 → C3</b></div>
          <div className="btnRow" style={{marginTop:6}}>
            <button className="btn" style={{background:"#8b1b1b"}} onClick={clearSaved}>Clear Saved State</button>
          </div>
        </div>

        {/* RIGHT: Editor */}
        <div className="editor">
          <h3>Team Names</h3>
          <div className="teamGrid">
            {Array.from({length:9}).map((_,i)=>(
              <input key={i} value={inputs[i] ?? `Team ${i+1}`} onChange={e=>{
                const copy=[...inputs]; copy[i]=e.target.value; setInputs(copy);
              }} />
            ))}
          </div>
          <div className="btnRow" style={{marginTop:10}}>
            <button className="btn" onClick={apply}>Apply Names to Wheel</button>
            <button className="btn" style={{background:"#1c6b3d"}} onClick={()=>{
              const arr=[...inputs];
              for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]] }
              setInputs(arr);
            }}>Shuffle Names</button>
          </div>
          <p className="small">Names & draw state auto-save to your browser. Reload to continue where you left off.</p>
        </div>
      </div>

      {/* Hidden Fixture for PDF */}
      <div className="fixture" id="fixture">
        <div className="title">Strikers Cup 2025 — Tournament Fixture</div>

        <div className="section">Group A</div>
        <table id="tableA"><thead><tr><th>Match</th><th>Fixture</th><th>Ground</th><th>Time</th><th>Date</th></tr></thead><tbody></tbody></table>

        <div className="section">Group B</div>
        <table id="tableB"><thead><tr><th>Match</th><th>Fixture</th><th>Ground</th><th>Time</th><th>Date</th></tr></thead><tbody></tbody></table>

        <div className="section">Group C</div>
        <table id="tableC"><thead><tr><th>Match</th><th>Fixture</th><th>Ground</th><th>Time</th><th>Date</th></tr></thead><tbody></tbody></table>

        <div className="section">Group D (2nd Place Round Robin)</div>
        <table id="tableD"><thead><tr><th>Match</th><th>Fixture</th><th>Ground</th><th>Time</th><th>Date</th></tr></thead><tbody></tbody></table>

        <div className="section">Knockout Stage</div>
        <table id="tableK"><thead><tr><th>Match</th><th>Fixture</th><th>Ground</th><th>Time</th><th>Date</th></tr></thead><tbody></tbody></table>
      </div>
    </>
  );
}
