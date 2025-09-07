import React, { useEffect, useMemo, useRef, useState } from "react";
import logoUrl from "./assets/logo.jpeg";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

const defaultTeams = Array.from({ length: 9 }, (_, i) => `Team ${i + 1}`);
const palette = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#0ea5e9",
  "#6366f1",
  "#a855f7",
];
const orderSlots = [
  { group: "GA", slot: 0 },
  { group: "GB", slot: 0 },
  { group: "GC", slot: 0 },
  { group: "GA", slot: 1 },
  { group: "GB", slot: 1 },
  { group: "GC", slot: 1 },
  { group: "GA", slot: 2 },
  { group: "GB", slot: 2 },
  { group: "GC", slot: 2 },
];

// ---------- simple spin "whoosh" using WebAudio (no external file needed)
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

      osc.type = "sine"; // smooth spinner sound
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 2.3);

      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.6, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      oscRef.current = osc;
      gainRef.current = gain;
    } catch (e) {
      // ignore if autoplay policy blocks it
    }
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
    gainRef.current = null;
    oscRef.current = null;
  };

  return { start, stop };
}

// ---------- wheel drawing & animation
function useWheel(remaining) {
  const canvasRef = useRef(null);
  const angleRef = useRef(0);
  const spinningRef = useRef(false);
  const [drawNonce, setDrawNonce] = useState(0); // to trigger redraw

  // draw segments
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const radius = canvas.width / 2;
    const center = { x: radius, y: radius };
    const segs = remaining.length;
    const arc = (Math.PI * 2) / Math.max(1, segs);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < segs; i++) {
      const start = i * arc - Math.PI / 2;
      const end = start + arc;
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.arc(center.x, center.y, radius - 6, start, end);
      ctx.closePath();
      ctx.fillStyle = palette[i % palette.length];
      ctx.fill();
      ctx.strokeStyle = "#0b2a55";
      ctx.lineWidth = 6;
      ctx.stroke();

      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate((start + end) / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px system-ui, Arial";
      ctx.fillText(remaining[i], radius - 20, 8);
      ctx.restore();
    }
  }, [remaining, drawNonce]);

  // spin returns a Promise resolved when animation stops
  const spin = () =>
    new Promise((resolve) => {
      if (spinningRef.current || remaining.length === 0) {
        resolve();
        return;
      }
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
        else {
          spinningRef.current = false;
          resolve();
        }
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
    setDrawNonce((n) => n + 1);
  };

  return { canvasRef, spin, settleIndex, resetRotation };
}

// ---------- persistence
const STORAGE_KEY = "scw_state_v1";
function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

export default function App() {
  const saved = loadState();
  const [inputs, setInputs] = useState(saved?.inputs || defaultTeams);
  const [teams, setTeams] = useState(saved?.teams || defaultTeams);
  const [remaining, setRemaining] = useState(saved?.remaining || defaultTeams);
  const [assigned, setAssigned] = useState(saved?.assigned || []);

  const { start: startSound, stop: stopSound } = useSpinSound();
  const { canvasRef, spin, settleIndex, resetRotation } = useWheel(remaining);

  // auto-save whenever important state changes
  useEffect(() => {
    saveState({ inputs, teams, remaining, assigned });
  }, [inputs, teams, remaining, assigned]);

  // groups (for display & fixture building)
  const GA = useMemo(
    () => [assigned[0], assigned[3], assigned[6]],
    [assigned]
  );
  const GB = useMemo(
    () => [assigned[1], assigned[4], assigned[7]],
    [assigned]
  );
  const GC = useMemo(
    () => [assigned[2], assigned[5], assigned[8]],
    [assigned]
  );

  const onSpin = async () => {
    if (remaining.length === 0) return;
    startSound();
    await spin(); // wait until spin stops
    stopSound();

    // fix: assign only AFTER spin ends + 1s delay
    const idx = settleIndex();
    const name = remaining[idx];
    setTimeout(() => {
      setRemaining((prev) => {
        const next = [...prev];
        next.splice(idx, 1);
        return next;
      });
      setAssigned((a) => [...a, name]);
    }, 1000);
  };

  const apply = () => {
    const clean = inputs.map((v, i) => v.trim() || `Team ${i + 1}`);
    setTeams(clean);
    setAssigned([]);
    setRemaining(clean);
    resetRotation();
  };

  const reset = () => {
    setAssigned([]);
    setRemaining(teams);
    resetRotation();
  };

  const clearSaved = () => {
    clearState();
    // no other change to current state; optional: you could also reset here
  };

  const full = assigned.length >= 9;

  // --------- Fixture builder (same schedule as before)
  const STARTS = ["08:00 AM", "09:45 AM", "11:30 AM", "01:15 PM", "03:00 PM", "04:45 PM"];
  const DATE_GROUPS = "20.09.2025";
  const DATE_KO = "21.09.2025";

  function buildRows(T) {
    const fields = ["Field 1", "Field 2", "Field 1", "Field 2", "Field 1", "Field 2"];
    return [
      ["1", `${T[0] || ""} vs ${T[1] || ""}`, fields[0], STARTS[0], DATE_GROUPS],
      ["2", `${T[1] || ""} vs ${T[2] || ""}`, fields[3], STARTS[3], DATE_GROUPS],
      ["3", `${T[0] || ""} vs ${T[2] || ""}`, fields[4], STARTS[4], DATE_GROUPS],
    ];
  }

  function fillTable(id, rows) {
    const tbody = document.querySelector(`#${id} tbody`);
    tbody.innerHTML = rows
      .map((r) => `<tr>${r.map((c) => `<td>${c || ""}</td>`).join("")}</tr>`)
      .join("");
  }

  async function generatePdf() {
    fillTable("tableA", [
      ["1", `${GA[0] || ""} vs ${GA[1] || ""}`, "Field 1", "09:00 AM", DATE_GROUPS],
      ["4", `${GA[1] || ""} vs ${GA[2] || ""}`, "Field 2", "10:45 AM", DATE_GROUPS],
      ["7", `${GA[0] || ""} vs ${GA[2] || ""}`, "Field 1", "14:15 PM", DATE_GROUPS],
    ]);
    fillTable("tableB", [
      ["2", `${GB[0] || ""} vs ${GB[1] || ""}`, "Field 2", "09:00 AM", DATE_GROUPS],
      ["5", `${GB[1] || ""} vs ${GB[2] || ""}`, "Field 1", "12:30 PM", DATE_GROUPS],
      ["8", `${GB[0] || ""} vs ${GB[2] || ""}`, "Field 2", "14:15 PM", DATE_GROUPS],
    ]);
    fillTable("tableC", [
      ["3", `${GC[0] || ""} vs ${GC[1] || ""}`, "Field 1", "10:45 AM", DATE_GROUPS],
      ["6", `${GC[1] || ""} vs ${GC[2] || ""}`, "Field 2", "12:30 PM", DATE_GROUPS],
      ["9", `${GC[0] || ""} vs ${GC[2] || ""}`, "Field 2", "16:00 PM", DATE_GROUPS],
    ]);
    fillTable("tableD", [
      ["10", "2A vs 2B", "Field 1", "16:15 PM", DATE_GROUPS],
      ["11", "2B vs 2C", "Field 1", "09:00 AM", DATE_KO],
      ["12", "2A vs 2C", "Field 1", "10:45 AM", DATE_KO],
    ]);
    fillTable("tableK", [
      ["13", "Semi Final 1: Winner A vs Winner C", "Field 1", "12:30 PM", DATE_KO],
      ["14", "Semi Final 2: Winner B vs Winner D", "Field 1", "14:15 PM", DATE_KO],
      ["15", "Final: Winner SF1 vs Winner SF2", "Field 1", "16:30 PM", DATE_KO],
    ]);

    const fixtureEl = document.getElementById("fixture");
    fixtureEl.style.display = "block";
    await new Promise((r) => setTimeout(r)); // let layout flush

    // render to canvas and into jsPDF
    const canvas = await html2canvas(fixtureEl, { scale: 2, backgroundColor: "#fff" });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ unit: "pt", format: "a4" }); // portrait A4
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth - 40; // 20pt margins
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let y = 20;
    if (imgHeight <= pageHeight - 40) {
      // fits on one page
      pdf.addImage(imgData, "PNG", 20, y, imgWidth, imgHeight);
    } else {
      // paginate
      let remainingHeight = imgHeight;
      let position = y;
      const pageCanvasHeight = ((pageHeight - 40) * canvas.height) / (pageWidth - 40);
      // Use built image repeatedly with y offsets
      while (remainingHeight > 0) {
        pdf.addImage(imgData, "PNG", 20, position, imgWidth, imgHeight);
        remainingHeight -= pageHeight - 40;
        if (remainingHeight > 0) {
          pdf.addPage();
          position = 20 - (imgHeight - remainingHeight - (pageHeight - 40));
        }
      }
    }

    pdf.save("Strikers_Cup_2025_Fixture.pdf");
    fixtureEl.style.display = "none";
  }

  return (
    <>
      <header>
        <h1>Strikers Cup 2025 — Draw Wheel</h1>
      </header>

      <div className="wrap">
        {/* LEFT: Groups */}
        <div className="groups">
          {["A", "B", "C"].map((g, gi) => (
            <div key={g} className="group" id={`G${g}`}>
              <h3>Group {g}</h3>
              {[0, 1, 2].map((s) => {
                const idx = gi + s * 3;
                const name = assigned[idx] || "";
                return (
                  <div key={s} className="slot">
                    {s + 1}. <span>{name}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* MIDDLE: Wheel */}
        <div className="middle">
          <div className="wheelShell">
            <div className="pointer" title="Selection Pointer" />
            <canvas id="wheel" ref={canvasRef} width="480" height="480"></canvas>
            <div className="centerLogo">
              <img src={logoUrl} alt="logo" />
            </div>
          </div>
          <div className="btnRow">
            <button className="btn" onClick={onSpin} disabled={remaining.length === 0}>
              Spin
            </button>
            <button className="btn" style={{ background: "#6b7b97" }} onClick={reset}>
              Reset
            </button>
            <button className="btn" onClick={generatePdf} disabled={!full}>
              Download Fixture PDF
            </button>
          </div>
          <div className="small">
            Order: <b>A1 → B1 → C1 → A2 → B2 → C2 → A3 → B3 → C3</b>
          </div>
          <div className="btnRow" style={{ marginTop: 6 }}>
            <button className="btn" style={{ background: "#8b1b1b" }} onClick={clearSaved}>
              Clear Saved State
            </button>
          </div>
        </div>

        {/* RIGHT: Editable Team Names */}
        <div className="editor">
          <h3>Team Names</h3>
          <div className="teamGrid">
            {inputs.map((v, i) => (
              <input
                key={i}
                value={v}
                onChange={(e) => {
                  const copy = [...inputs];
                  copy[i] = e.target.value;
                  setInputs(copy);
                }}
              />
            ))}
          </div>
          <div className="btnRow" style={{ marginTop: 10 }}>
            <button className="btn" onClick={apply}>
              Apply Names to Wheel
            </button>
            <button
              className="btn"
              style={{ background: "#1c6b3d" }}
              onClick={() => {
                const arr = [...inputs];
                for (let i = arr.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [arr[i], arr[j]] = [arr[j], arr[i]];
                }
                setInputs(arr);
              }}
            >
              Shuffle Names
            </button>
          </div>
          <p className="small">
            Names are saved automatically. Reload and you’ll resume from the last state.
          </p>
        </div>
      </div>

      {/* Hidden fixture print/PDF view */}
      <div className="fixture" id="fixture">
        <div className="title">Strikers Cup 2025 — Tournament Fixture</div>

        <div className="section">Group A</div>
        <table id="tableA">
          <thead>
            <tr>
              <th>Match</th>
              <th>Fixture</th>
              <th>Ground</th>
              <th>Time</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>

        <div className="section">Group B</div>
        <table id="tableB">
          <thead>
            <tr>
              <th>Match</th>
              <th>Fixture</th>
              <th>Ground</th>
              <th>Time</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>

        <div className="section">Group C</div>
        <table id="tableC">
          <thead>
            <tr>
              <th>Match</th>
              <th>Fixture</th>
              <th>Ground</th>
              <th>Time</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>

        <div className="section">Group D (2nd Place Round Robin)</div>
        <table id="tableD">
          <thead>
            <tr>
              <th>Match</th>
              <th>Fixture</th>
              <th>Ground</th>
              <th>Time</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>

        <div className="section">Knockout Stage</div>
        <table id="tableK">
          <thead>
            <tr>
              <th>Match</th>
              <th>Fixture</th>
              <th>Ground</th>
              <th>Time</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </>
  );
}
