import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import useDarkMode from "./hooks/useDarkMode";
import Modal from "./components/Modal";

/**
 * NeuroNudge – Blue & White Brain Trainer (single-file React)
 * -----------------------------------------------------------
 * ✔ Blue & white theme (+ dark mode)
 * ✔ 5 mini-exercises: Memory Match, Stroop, 2-Back, Math Blitz, Path Finder
 * ✔ 15-min/day goal tracker + 7-day bars + streak
 * ✔ LocalStorage persistence (privacy-friendly)
 * ✔ Optional sound feedback (toggle in header)
 * ✔ Tiny runtime tests for helpers (see console)
 *
 * Drop this file into any React app and render <NeuroNudge/>.
 */
 // put constants here
const EMOJI = ["🐬","🧠","🎯","🧩","🔷","📘","💎","🌊"];
const LEVELS = [
  { key: "l1", label: "Level 1", seconds: 40 },
  { key: "l2", label: "Level 2", seconds: 30 },
];
const COLORS = [
  { name: "RED", css: "text-red-600" },
  { name: "BLUE", css: "text-blue-700" },
  { name: "GREEN", css: "text-green-600" },
  { name: "YELLOW", css: "text-yellow-500" },
];

// ---------------- Utils ----------------
const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
export function formatMMSS(totalSeconds) {
  const total = Number.isFinite(totalSeconds) && totalSeconds >= 0 ? Math.floor(totalSeconds) : 0;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${pad(m)}:${pad(s)}`;
}

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const loadJSON = (k, fb) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; } };
const saveJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => { const a = arr.slice(); for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; };

// ---------------- Tiny runtime tests (dev) ----------------
(function runDevTests(){
  const A=(c,m)=>{ if(!c) console.error("[NeuroNudge test failed]",m); };
  A(formatMMSS(0)==="00:00","formatMMSS 0");
  A(formatMMSS(5)==="00:05","formatMMSS 5");
  A(formatMMSS(65)==="01:05","formatMMSS 65");
  A(formatMMSS(-3)==="00:00","formatMMSS clamps negative");
  const r=randInt(5,5); A(r===5,"randInt bound");
  const arr=[1,2,3,4], sh=shuffle(arr); A(sh.length===4 && arr.every(x=>sh.includes(x)),"shuffle integrity");
})();

// ---------------- Sound (Web Audio) ----------------
function useBeeps(){
  const ctxRef=useRef(null);
  const ensure=()=>{ if(!ctxRef.current){ const AC=(typeof window!=='undefined')&&(window.AudioContext||window.webkitAudioContext); if(AC) ctxRef.current=new AC(); } if(ctxRef.current&&ctxRef.current.state==='suspended') ctxRef.current.resume(); return ctxRef.current; };
  const tone=(f=440,d=0.12,t='sine',vol=0.08)=>{ const ctx=ensure(); if(!ctx) return; const o=ctx.createOscillator(); const g=ctx.createGain(); o.type=t; o.frequency.value=f; g.gain.value=vol; o.connect(g); g.connect(ctx.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+d); o.stop(ctx.currentTime+d); };
  return { resume:ensure, click:()=>tone(520,0.05,'triangle',0.05), success:()=>{tone(660,0.08,'sine',0.08); setTimeout(()=>tone(880,0.12,'sine',0.08),90);}, fail:()=>tone(200,0.18,'sawtooth',0.1) };
}

// ---------------- Basic UI ----------------
const Card=({className="",children,onClick})=> (
  <div
    onClick={onClick}
    className={`rounded-2xl shadow-sm border border-blue-100 bg-white dark:border-gray-800 dark:bg-gray-900 ${className}`}
  >
    {children}
  </div>
);
const Button=({children,onClick,variant='solid',className='',disabled})=>{
  const base="px-4 py-2 rounded-xl text-sm font-semibold transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed";
  const styles={ solid:"bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300", ghost:"bg-white text-blue-700 border border-blue-200 hover:bg-blue-50", subtle:"bg-blue-50 text-blue-700 hover:bg-blue-100" };
  return (<button onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]} ${className}`}>{children}</button>);
};

// ---------------- Daily Progress ----------------
const DAILY_KEY="nn_daily_seconds"; // { YYYY-MM-DD: seconds }
const META_KEY="nn_meta"; // { streak:number, lastDay:string }
function useDailyProgress(){
  const [map,setMap]=useState(()=>loadJSON(DAILY_KEY,{}));
  const [meta,setMeta]=useState(()=>loadJSON(META_KEY,{streak:0,lastDay:null}));
  useEffect(()=>saveJSON(DAILY_KEY,map),[map]);
  useEffect(()=>saveJSON(META_KEY,meta),[meta]);

  const addSeconds=(sec)=>{
    const key=todayKey();
    setMap(m=>({...m,[key]:(m[key]||0)+sec}));

    const completed=((map[key]||0)+sec)>=10*60;
    if(!meta.lastDay){
      setMeta({streak:completed?1:0,lastDay:key});
    } else {
      const last=new Date(meta.lastDay);
      const now=new Date(key);
      const diff=Math.round((now-last)/(1000*3600*24));
      if(diff===0){
        const already=(map[key]||0)>=10*60;
        if(!already && completed) setMeta({streak:meta.streak+1,lastDay:key});
      } else if(diff===1){
        setMeta({streak:completed?meta.streak+1:meta.streak,lastDay:key});
      } else if(diff>1){
        setMeta({streak:completed?1:0,lastDay:key});
      }
    }
  };

  const weekData=()=>{
    const out=[];
    const now=new Date();
    for(let i=6;i>=0;i--){
      const d=new Date(now);
      d.setDate(now.getDate()-i);
      const key=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      out.push({key,seconds:map[key]||0});
    }
    return out;
  };
  return { addSeconds, weekData, todaySeconds: map[todayKey()]||0, streak: meta.streak };
}

// ---------------- Session Timer (drift-free, no double-credit) ----------------
function useActiveTimer(isRunning){
  const [seconds, setSeconds] = useState(0);
  const startRef = useRef(null);

  useEffect(() => {
    let id;
    if (isRunning) {
      if (!startRef.current) startRef.current = Date.now();
      id = setInterval(() => {
        setSeconds(Math.floor((Date.now() - startRef.current) / 1000));
      }, 250);
    } else {
      startRef.current = null;
      setSeconds(0);
    }
    return () => { if (id) clearInterval(id); };
  }, [isRunning]);

  return seconds;
}

// ---------------- Exercises ----------------
// Memory Match
function MemoryMatch({ onEarnSeconds, sound }){
  // use top-level EMOJI
  const [deck,setDeck]=useState([]);
  const [flipped,setFlipped]=useState([]); const [matched,setMatched]=useState(new Set()); const [moves,setMoves]=useState(0); const [running,setRunning]=useState(false); const seconds=useActiveTimer(running); useEffect(()=>{onEarnSeconds(seconds)},[seconds,onEarnSeconds]);
  const [finalScore,setFinalScore]=useState(null);
  const init=()=>{ const base=shuffle(EMOJI.concat(EMOJI)); setDeck(base); setFlipped([]); setMatched(new Set()); setMoves(0); setFinalScore(null); setRunning(false); };
  useEffect(init,[]);
  const click=(i)=>{ if(finalScore!==null) return; if(!running) setRunning(true); sound?.click?.(); if(matched.has(i)||flipped.includes(i)) return; const nf=[...flipped,i]; setFlipped(nf); if(nf.length===2){ setMoves(m=>m+1); const [a,b]=nf; if(deck[a]===deck[b]){ const nm=new Set(matched); nm.add(a); nm.add(b); setMatched(nm); setFlipped([]); sound?.success?.(); } else { setTimeout(()=>{ setFlipped([]); sound?.fail?.(); },600); } } };
  const allMatched=matched.size===deck.length && deck.length>0;
  useEffect(()=>{ if(!allMatched) return; if(running) setRunning(false); const pairs=deck.length/2; const efficiency=pairs/Math.max(moves,pairs); const timeFactor=Math.max(0,1-seconds/120); const score=Math.round(1000*(0.7*efficiency+0.3*timeFactor)); setFinalScore(score); },[allMatched,running,deck.length,moves,seconds]);
  return (<div className="space-y-4"> <div className="flex items-center justify-between"> <div className="text-blue-800 font-semibold">Moves: {moves}</div> <div className="text-blue-800 font-semibold">Time: {formatMMSS(seconds)}</div> <Button variant="ghost" onClick={init}>Restart</Button> </div> <div className="grid grid-cols-4 gap-3 max-w-md"> {deck.map((emoji,i)=>{ const up=flipped.includes(i)||matched.has(i); return (<div key={i} onClick={()=>click(i)} className={`aspect-square select-none cursor-pointer rounded-2xl flex items-center justify-center text-3xl border transition ${up?"bg-blue-50 border-blue-300 text-blue-700":"bg-white border-blue-200 hover:bg-blue-50"}`}><span>{up?emoji:""}</span></div>); })} </div> {finalScore!==null && (<Card className="p-4 text-blue-900"><div className="text-lg font-semibold">All pairs found! 🎉</div><div>Moves: {moves}</div><div>Time: {formatMMSS(seconds)}</div><div className="font-semibold">Score: {finalScore}</div><div className="mt-3 flex gap-2"><Button onClick={init}>Play Again</Button></div></Card>)} </div>);
}


// Stroop (Level 1=40s, Level 2=30s) – fixed slower pacing
function Stroop({ onEarnSeconds, sound }) {
  const TOTAL = 20;
  const ISI = 150; // tiny blank gap

  // state first
  const [levelIdx, setLevelIdx] = useState(0);

  // then derive the per-level reaction window (shorter = harder)
  const RT_LIMITS = [2300, 1800]; // L1: 2.3s, L2: 1.8s (tighter than before)
  const RT_LIMIT  = RT_LIMITS[levelIdx];;

  const respTimerRef = useRef(null);
  const gapTimerRef  = useRef(null);

  const [running, setRunning]   = useState(false);
  const [timeLeft, setTimeLeft] = useState(LEVELS[levelIdx].seconds);
  const seconds = useActiveTimer(running);
  useEffect(() => onEarnSeconds(seconds), [seconds, onEarnSeconds]);

  const [trial, setTrial]     = useState(0);
  const [score, setScore]     = useState(0);
  const [current, setCurrent] = useState(null); // { word, colorIdx } or null during ISI
  const [rtStart, setRtStart] = useState(null);
  const [rts, setRts]         = useState([]);

  const clearTimers = () => {
    if (respTimerRef.current) { clearTimeout(respTimerRef.current); respTimerRef.current = null; }
    if (gapTimerRef.current)  { clearTimeout(gapTimerRef.current);  gapTimerRef.current  = null; }
  };
  useEffect(() => () => clearTimers(), []);

  // reset on level change
  useEffect(() => {
    clearTimers();
    setTimeLeft(LEVELS[levelIdx].seconds);
    setTrial(0); setScore(0); setRts([]);
    setRunning(false); setCurrent(null);
  }, [levelIdx]);

  // countdown
  useEffect(() => {
    if (!running || timeLeft <= 0 || trial >= TOTAL) return;
    const id = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(id);
  }, [running, timeLeft, trial]);
  useEffect(() => { if (timeLeft <= 0) setRunning(false); }, [timeLeft]);

  const done = trial >= TOTAL || timeLeft <= 0;

 //import { useCallback, useEffect } from "react";

// present a stimulus and arm response timeout
const present = useCallback(() => {
  const colorIdx = randInt(0, COLORS.length - 1);
  let word = choice(COLORS).name;

  if (Math.random() < 0.7) {
    while (word === COLORS[colorIdx].name) word = choice(COLORS).name; // incongruent
  } else {
    word = COLORS[colorIdx].name; // congruent
  }

  setCurrent({ word, colorIdx });
  setRtStart(performance.now());

  if (respTimerRef.current) clearTimeout(respTimerRef.current);
  respTimerRef.current = setTimeout(() => {
    sound?.fail?.();
    setCurrent(null);
    gapTimerRef.current = setTimeout(() => setTrial(t => t + 1), ISI);
  }, RT_LIMIT);
}, [sound, ISI, RT_LIMIT]);

// stable cleanup
const clearTimers = useCallback(() => {
  if (respTimerRef.current) clearTimeout(respTimerRef.current);
  if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
}, []);

// drive presentation whenever trial changes while running
useEffect(() => {
  if (!running || done) return;
  present();
  return () => clearTimers();
}, [trial, running, done, present, clearTimers]);


  // user answer
  const answer = (i) => {
    if (done || !current) return; // ignore clicks during blank
    if (respTimerRef.current) { clearTimeout(respTimerRef.current); respTimerRef.current = null; }

    const ok = i === current.colorIdx;
    const rt = performance.now() - rtStart;
    setRts(a => [...a, rt]);
    setScore(s => s + (ok ? 1 : 0));
    ok ? sound?.success?.() : sound?.fail?.();

    setCurrent(null);
    gapTimerRef.current = setTimeout(() => setTrial(t => t + 1), ISI);
  };

  const restart = () => {
    clearTimers();
    setTrial(0); setScore(0); setRts([]);
    setRunning(false);
    setTimeLeft(LEVELS[levelIdx].seconds);
    setCurrent(null);
  };

  const nextLevel = () => { if (levelIdx < LEVELS.length - 1) setLevelIdx(levelIdx + 1); };
  const avgRT = rts.length ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-blue-800 font-semibold">
          {LEVELS[levelIdx].label} • Trial {Math.min(trial + 1, TOTAL)} / {TOTAL}
        </div>
        <div className="text-blue-800 font-semibold">Score: {score}</div>
        <div className="text-blue-800 font-semibold">Time Left: {Math.max(0, timeLeft)}s</div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-blue-800/80">Mode:</span>
        {LEVELS.map((L, i) => (
          <Button key={L.key} variant={i === levelIdx ? 'solid' : 'ghost'} onClick={() => setLevelIdx(i)}>
            {L.label} ({L.seconds}s)
          </Button>
        ))}
        <Button variant="ghost" onClick={restart}>Restart</Button>
        {!running && !done && <Button onClick={() => setRunning(true)}>Start</Button>}
        {running && <Button variant="ghost" onClick={() => setRunning(false)}>Stop</Button>}
      </div>

      {!done ? (
        <div className="flex flex-col items-center gap-4">
          <div className={`text-5xl font-black tracking-wide ${current ? COLORS[current.colorIdx].css : ""}`}>
            {current ? current.word : ""}
          </div>
          <div className="flex flex-wrap gap-3">
            {COLORS.map((c, i) => (
              <Button key={i} onClick={() => answer(i)} disabled={timeLeft <= 0 || !current}>
                {c.name}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <Card className="p-4 text-blue-900">
          <div className="text-lg font-semibold">Session complete!</div>
          <div>Accuracy: {Math.round((score / Math.max(1, Math.min(trial, TOTAL))) * 100)}%</div>
          <div>Average reaction time: {avgRT} ms</div>
          <div className="mt-3 flex gap-2 flex-wrap">
            <Button variant="ghost" onClick={restart}>Restart Level</Button>
            {levelIdx < LEVELS.length - 1 && (
              <Button onClick={nextLevel}>Next Level ({LEVELS[levelIdx + 1].seconds}s)</Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}





// 2-Back — tiny version with Start/Stop and correct label
function NBack({ onEarnSeconds, sound }) {
  
  const A="ABCDEFGHJKLMNPQRSTUV";
  // Generate a 28-item stream with ~28% true 2-back matches and no immediate repeats
const makeS = () => {
  const r = Array.from({ length: 28 }, () => A[randInt(0, A.length - 1)]);
  // avoid immediate repeats (…A A…)
  for (let k = 1; k < r.length; k++) {
    while (r[k] === r[k - 1]) r[k] = A[randInt(0, A.length - 1)];
  }
  // sprinkle ~28% true 2-back matches
  for (let k = 2; k < r.length; k++) {
    if (Math.random() < 0.28) r[k] = r[k - 2];
  }
  return r;
};

  const [s,setS]=useState(()=>makeS());
  const [i,setI]=useState(0), [t,setT]=useState(60), [run,setRun]=useState(false);
  const [h,setH]=useState(0), [fa,setFA]=useState(0);

  // tick letters + countdown only when running
  useEffect(()=>{ if(run&&t>0){ const id=setInterval(()=>{ setI(x=>(x+1)%s.length); setT(x=>x-1); },1100); return()=>clearInterval(id);} },[run,t,s.length]);
  useEffect(()=>{ if(t<=0) setRun(false); },[t]);

  // action (does NOT start the game)
  const press = () => {
  if (!run || t <= 0 || i < 2) return;

  if (s[i] === s[i - 2]) {
    setH(x => x + 1);
    if (sound?.success) sound.success();
  } else {
    setFA(x => x + 1);
    if (sound?.fail) sound.fail();
  }
};

const again = () => {
  setS(makeS());
  setI(0);
  setT(60);
  setRun(false);
  setH(0);
  setFA(0);
};


  return (<div className="space-y-3">
    <div className="flex justify-between text-blue-800 font-semibold">
      <div>2-Back • {i+1}/{s.length}</div><div>Hits:{h} • False:{fa}</div><div>Time:{t}s</div>
    </div>

    {t>0? (
      <>
        <div className="flex flex-col items-center gap-3">
          <div className="text-6xl font-black text-blue-700">{s[i]||""}</div>
          <Button onClick={press}>Same as 2 back</Button>
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" onClick={()=>setRun(r=>!r)}>{run?"Stop":"Start"}</Button>
        </div>
      </>
    ) : (
      <Card className="p-4 text-blue-900">
        <div className="font-semibold">Time! Session complete.</div>
        <div>Hits: {h}</div><div>False alarms: {fa}</div>
        <div className="mt-3"><Button onClick={again}>Play Again</Button></div>
      </Card>
    )}
  </div>);
}





// Math Blitz (with levels 60/45/30s)
function MathBlitz({ onEarnSeconds, sound }){
  const LEVELS=[ {key:"easy",label:"Level 1",seconds:60}, {key:"med",label:"Level 2",seconds:45}, {key:"hard",label:"Level 3",seconds:30} ];
  const [levelIdx,setLevelIdx]=useState(0); const [running,setRunning]=useState(false); const [timeLeft,setTimeLeft]=useState(LEVELS[levelIdx].seconds); const [answer,setAnswer]=useState(""); const [score,setScore]=useState(0); const seconds=useActiveTimer(running); useEffect(()=>onEarnSeconds(seconds),[seconds,onEarnSeconds]);
  const makeQ=()=>{ const ops=["+","-","×"]; const a=randInt(7,49); const b=randInt(3,12); const op=choice(ops); const text=`${a} ${op} ${b}`; let correct=0; if(op==="+") correct=a+b; else if(op==="-") correct=a-b; else correct=a*b; return {text,correct}; };
  const [current,setCurrent]=useState(makeQ());
  useEffect(()=>{ if(!running||timeLeft<=0) return; const id=setInterval(()=>setTimeLeft(t=>t-1),1000); return ()=>clearInterval(id); },[running,timeLeft]);
  useEffect(()=>{ if(timeLeft<=0 && running) setRunning(false); },[timeLeft,running]);
  const submit=()=>{ if(timeLeft<=0) return; if(!running) setRunning(true); const val=Number(answer); if(!Number.isNaN(val) && val===current.correct){ setScore(s=>s+1); sound?.success?.(); } else { sound?.fail?.(); } setAnswer(""); setCurrent(makeQ()); };
  const reset=()=>{ setRunning(false); setTimeLeft(LEVELS[levelIdx].seconds); setScore(0); setAnswer(""); setCurrent(makeQ()); };
  const over=timeLeft<=0;
  return (<div className="space-y-4"> <div className="flex items-center justify-between"> <div className="text-blue-800 font-semibold">{LEVELS[levelIdx].label} • Time Left: {timeLeft}s</div> <div className="text-blue-800 font-semibold">Score: {score}</div> </div> <div className="flex items-center gap-2 text-sm"> <span className="text-blue-800/80">Mode:</span> {LEVELS.map((L,i)=>(<Button key={L.key} variant={i===levelIdx?'solid':'ghost'} onClick={()=>{setLevelIdx(i); setTimeLeft(L.seconds); setRunning(false); setScore(0); setAnswer(''); setCurrent(makeQ());}}>{L.label} ({L.seconds}s)</Button>))} <Button variant="ghost" onClick={reset}>Restart</Button> </div> {!over ? (<div className="flex items-center gap-3"> <div className="text-3xl font-bold text-blue-700 w-44">{current.text}</div> <input value={answer} onChange={(e)=>setAnswer(e.target.value)} onKeyDown={(e)=>e.key==='Enter'&&submit()} className="px-3 py-2 rounded-xl border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-300" type="number" placeholder="Answer" /> <Button onClick={submit}>Submit</Button> </div>) : (<Card className="p-4 text-blue-900"><div className="text-lg font-semibold">Time! Final score: {score}</div><div className="mt-3"><Button variant="ghost" onClick={reset}>Play Again</Button></div></Card>)} </div>);
}

// ------- Exercise: Path Finder (60s session, auto-advance tasks, manual start) -------
function PathFinder({ onEarnSeconds, sound }){
  const BOX_H = 260;
  const SESSION_SECONDS = 60;           // total session duration
  const MIN_TARGETS = 3, MAX_TARGETS = 6; // difficulty bounds

  // credit stopwatch for daily progress while session is running
  const [running, setRunning] = useState(false);
  const sessionSeconds = useActiveTimer(running);
  useEffect(() => onEarnSeconds(sessionSeconds), [sessionSeconds, onEarnSeconds]);

  const areaRef = useRef(null);
  const [revealMs, setRevealMs] = useState(() => loadJSON("nn_path_reveal_ms", 2000));
  useEffect(() => saveJSON("nn_path_reveal_ms", revealMs), [revealMs]);

  // session + round state
  const [phase, setPhase] = useState('idle'); // idle -> show -> input -> transition -> session_over
  const [sessionLeft, setSessionLeft] = useState(SESSION_SECONDS);
  const [targets, setTargets] = useState(MIN_TARGETS);
  const [tasksDone, setTasksDone] = useState(0);

  const [points, setPoints] = useState([]);
  const [revealIdx, setRevealIdx] = useState(-1);
  const [selIdx, setSelIdx] = useState(0);
  const [chosen, setChosen] = useState([]);

  // timers
  const revealTimerRef = useRef(null);
  const betweenTimerRef = useRef(null);
  const tickRef = useRef(null);
  const clearTimers = () => {
    if (revealTimerRef.current) { clearTimeout(revealTimerRef.current); revealTimerRef.current = null; }
    if (betweenTimerRef.current) { clearTimeout(betweenTimerRef.current); betweenTimerRef.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  };
  useEffect(() => () => clearTimers(), []);

  // generate spaced points
  const genPoints = (count = 3) => {
    const colors = [
      { name: 'RED', bg: 'bg-red-500' },
      { name: 'BLUE', bg: 'bg-blue-600' },
      { name: 'BLACK', bg: 'bg-black' },
      { name: 'WHITE', bg: 'bg-white border border-blue-300' },
      { name: 'TEAL', bg: 'bg-cyan-600' },
      { name: 'INDIGO', bg: 'bg-indigo-600' },
    ];
    const arr = [];
    const rect = areaRef.current?.getBoundingClientRect();
    const W = rect ? rect.width : 320;
    const H = rect ? rect.height : BOX_H;
    const R = 18, padBox = 28;
    const far = (x,y) => arr.every(p => (p.x-x)**2 + (p.y-y)**2 > (R*5)**2);
    for(let i=0;i<count;i++){
      let x,y,t=0; do { x=randInt(padBox, W-padBox); y=randInt(padBox, H-padBox); t++; } while(!far(x,y) && t<100);
      arr.push({ x, y, color: colors[i % colors.length] });
    }
    return arr;
  };

  // prepare a single task (sequence)
  const prepareTask = () => {
    setPoints(genPoints(targets));
    setRevealIdx(0);
    setSelIdx(0);
    setChosen([]);
    setPhase('show');
  };

  // start the whole 60s session
  const startSession = () => {
    clearTimers();
    setSessionLeft(SESSION_SECONDS);
    setTargets(MIN_TARGETS);
    setTasksDone(0);
    setRunning(true);
    setPhase('show');
    setPoints(genPoints(MIN_TARGETS));
    setRevealIdx(0); setSelIdx(0); setChosen([]);
    // session countdown ticks regardless of phase
    tickRef.current = setInterval(() => setSessionLeft(t => t-1), 1000);
  };

  // stop session when time is up
  useEffect(() => {
    if (sessionLeft <= 0 && running) {
      setRunning(false);
      setPhase('session_over');
      clearTimers();
    }
  }, [sessionLeft, running]);

  // progressive reveal (keep earlier dots visible)
  useEffect(() => {
    if (phase !== 'show' || revealIdx < 0) return;
    if (revealIdx >= points.length - 1) { setPhase('input'); return; }
    revealTimerRef.current = setTimeout(() => setRevealIdx(i => i + 1), Math.max(300, revealMs));
    return () => { if (revealTimerRef.current) clearTimeout(revealTimerRef.current); };
  }, [phase, revealIdx, points.length, revealMs]);

  // handle taps during input
  const onAreaClick = (e) => {
    if (phase !== 'input' || !running) return;
    const rect = areaRef.current.getBoundingClientRect();
    const clientX = (e.touches?.[0]?.clientX) ?? e.clientX;
    const clientY = (e.touches?.[0]?.clientY) ?? e.clientY;
    const x = clientX - rect.left, y = clientY - rect.top;
    let idx = -1, dist = 1e9;
    points.forEach((p, i) => { const d=(p.x-x)**2 + (p.y-y)**2; if(d<dist){ dist=d; idx=i; } });
    const R = 36;
    if (dist <= R*R) {
      sound?.click?.();
      if (idx === selIdx) {
        setChosen(c => [...c, idx]);
        setSelIdx(k => k + 1);
        sound?.success?.();
        if (selIdx + 1 >= points.length) {
          // task completed -> schedule next automatically
          setTasksDone(n => n + 1);
          // mild difficulty ramp: +1 target every 2 completed tasks (cap MAX_TARGETS)
          setTargets(t => Math.min(MAX_TARGETS, MIN_TARGETS + Math.floor(((tasksDone+1))/2)));
          setPhase('transition');
          betweenTimerRef.current = setTimeout(() => { prepareTask(); }, 600);
        }
      } else {
        sound?.fail?.();
      }
    }
  };

  const restart = () => { clearTimers(); setRunning(false); setPhase('idle'); setSessionLeft(SESSION_SECONDS); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-blue-800 font-semibold">
          {phase === 'session_over' ? 'Session Over' : phase === 'input' ? 'Your turn' : phase === 'show' ? 'Watch order' : 'Ready'}
          {running && ` • Task ${tasksDone + (phase==='transition'?1:0) + (phase==='input' || phase==='show' ? 1 : 0)}`}
        </div>
        <div className="text-blue-800 font-semibold">Time Left: {Math.max(0, sessionLeft)}s</div>
        <div className="flex gap-2">
          {phase === 'idle' && <Button onClick={startSession}>Start (60s)</Button>}
          {phase !== 'idle' && phase !== 'session_over' && <Button variant="ghost" onClick={restart}>Stop</Button>}
          {phase === 'session_over' && <Button onClick={startSession}>Play Again</Button>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-blue-800/80">Reveal speed: <b className="text-blue-900">{revealMs} ms</b></span>
        <input type="range" min={300} max={6000} step={100} value={revealMs}
               onChange={(e) => setRevealMs(parseInt(e.target.value, 10))} className="w-64" />
        <span className="text-blue-800/80">Targets this task: <b className="text-blue-900">{targets}</b></span>
        <span className="text-blue-800/80">Completed: <b className="text-blue-900">{tasksDone}</b></span>
      </div>

      <div
        ref={areaRef}
        onClick={onAreaClick}
        onTouchStart={onAreaClick}
        className="relative w-full rounded-2xl border border-blue-200 bg-gradient-to-b from-blue-100 to-blue-200"
        style={{ height: BOX_H }}
      >
        {/* Path lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {(phase === 'show' && revealIdx >= 1) && (
            <polyline
              fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"
              points={points.slice(0, revealIdx + 1).map(p => `${p.x},${p.y}`).join(' ')} opacity="0.9"
            />
          )}
          {(phase === 'input' && chosen.length > 0) && (
            <polyline
              fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"
              points={chosen.map(i => `${points[i].x},${points[i].y}`).join(' ')} opacity="0.9"
            />
          )}
        </svg>
        {/* Dots (keep earlier visible) */}
        {points.map((p, i) => {
          const hidden = phase === 'show' && i > revealIdx;
          if (hidden) return null;
          const glow = phase === 'show' && i === revealIdx;
          const ring = glow ? 'ring-8 ring-white/70' : 'ring-4 ring-white/40';
          const bg = p.color.name === 'RED' ? 'bg-red-500' : p.color.name === 'BLUE' ? 'bg-blue-600' : p.color.name === 'BLACK' ? 'bg-black' : p.color.bg;
          return (
            <div key={i} className={`absolute ${ring} rounded-full border-2 border-white shadow`} style={{ left: p.x - 20, top: p.y - 20, width: 40, height: 40 }}>
              <div className={`absolute inset-1 rounded-full ${bg}`} />
            </div>
          );
        })}

        {/* Idle / Overlays */}
        {phase === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center text-blue-800/70 font-semibold select-none">Press Start to begin (60s session)</div>
        )}
        {phase === 'session_over' && (
          <div className="absolute inset-0 flex items-center justify-center text-blue-800/80 text-center select-none">
            <div>
              <div className="text-2xl font-bold mb-1">Session complete! 🎉</div>
              <div>Tasks completed: <b>{tasksDone}</b></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ---------------- Progress Panel ----------------
function ProgressPanel({ todaySeconds, week, streak }){
  const goal=15*60; const pct=Math.min(100,Math.round((todaySeconds/goal)*100));
  return (<Card className="p-5"> <div className="flex items-center justify-between"> <div> <div className="text-blue-900 font-semibold">Daily Goal: 15 minutes</div> <div className="text-sm text-blue-700/80">Today: {formatMMSS(todaySeconds)} ({pct}%)</div> </div> <div className="text-right"> <div className="text-blue-900 font-semibold">Streak</div> <div className="text-2xl font-black text-blue-700">{streak}🔥</div> </div> </div> <div className="mt-4"><div className="w-full h-3 rounded-full bg-blue-100"><div className="h-3 rounded-full bg-blue-600 transition-all" style={{width:`${pct}%`}}/></div></div> <div className="mt-6"> <div className="text-sm font-semibold text-blue-900 mb-2">Last 7 days</div> <div className="grid grid-cols-7 gap-2"> {week.map((d,i)=>{ const hpct=Math.min(100,Math.round((d.seconds/goal)*100)); return (<div key={i} className="flex flex-col items-center gap-1"><div className="w-6 rounded-full bg-blue-100 overflow-hidden h-20 flex items-end"><div className="w-full bg-blue-600" style={{height:`${hpct}%`}}/></div><div className="text-[10px] text-blue-700/70">{d.key.slice(5)}</div></div>); })} </div> </div> </Card>);
}

// ---------------- App Root ----------------
const EXERCISES=[ {key:'memory',name:'Memory Match'}, {key:'stroop',name:'Stroop'}, {key:'nback',name:'2-Back'}, {key:'math',name:'Math Blitz'}, {key:'path',name:'Path Finder'} ];
export default function NeuroNudge(){
  const { addSeconds, weekData, todaySeconds, streak } = useDailyProgress();
  const [active,setActive]=useState('memory');
  const [dark, setDark] = useDarkMode();
  const [tipsOpen, setTipsOpen] = useState(false);

  const beeps=useBeeps(); const [soundOn,setSoundOn]=useState(true); const sound=useMemo(()=>({ enabled:soundOn, click:()=>soundOn&&beeps.click(), success:()=>soundOn&&beeps.success(), fail:()=>soundOn&&beeps.fail() }),[soundOn, beeps]);
  const creditBuffer=useRef(0); const flushHandle=useRef(null);
  const onEarnSeconds=(sec)=>{ const delta=sec-(creditBuffer.current||0); if(delta>0){ creditBuffer.current=sec; if(flushHandle.current) clearTimeout(flushHandle.current); flushHandle.current=setTimeout(()=>{ addSeconds(delta); creditBuffer.current=0; },1500); } };
  useEffect(()=>()=>flushHandle.current && clearTimeout(flushHandle.current),[]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/70 dark:bg-gray-800/70 border-b border-blue-100 dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-blue-600"/>
            <div>
              <div className="text-xl font-black tracking-tight text-blue-700 dark:text-blue-200">NeuroNudge</div>
              <div className="text-xs text-blue-800/70 dark:text-blue-400/70">Scientific brain training in 15 minutes/day</div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2">
            {EXERCISES.map(e=>(<Button key={e.key} variant={active===e.key?"solid":"ghost"} onClick={()=>setActive(e.key)}>{e.name}</Button>))}
            <Button variant="subtle" onClick={()=>{ setSoundOn(s=>!s); if(!soundOn) beeps.resume?.(); }}>{soundOn?"🔊":"🔇"}</Button>
            <Button variant="subtle" onClick={() => setDark(d => !d)}>{dark ? "🌙" : "☀️"}</Button>
            <Button variant="ghost" onClick={() => setTipsOpen(true)}>Tips</Button>
          </div>

          <div className="md:hidden flex items-center gap-2">
            <select value={active} onChange={(e)=>setActive(e.target.value)} className="px-3 py-2 rounded-xl border border-blue-200 bg-white">
              {EXERCISES.map(e=>(<option key={e.key} value={e.key}>{e.name}</option>))}
            </select>
            <Button variant="subtle" onClick={()=>{ setSoundOn(s=>!s); if(!soundOn) beeps.resume?.(); }}>{soundOn?"🔊":"🔇"}</Button>
            <Button variant="subtle" onClick={() => setDark(d => !d)}>{dark ? "🌙" : "☀️"}</Button>
            <Button variant="ghost" onClick={() => setTipsOpen(true)}>Tips</Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold text-blue-900 dark:text-blue-100">{EXERCISES.find(e=>e.key===active)?.name}</div>
              <div className="text-sm text-blue-700/80"/>
            </div>
            {active==='memory' && <MemoryMatch onEarnSeconds={onEarnSeconds} sound={sound}/>}
            {active==='stroop' && <Stroop onEarnSeconds={onEarnSeconds} sound={sound}/>}
            {active==='nback' && <NBack onEarnSeconds={onEarnSeconds} sound={sound}/>}
            {active==='math' && <MathBlitz onEarnSeconds={onEarnSeconds} sound={sound}/>}
            {active==='path' && <PathFinder onEarnSeconds={onEarnSeconds} sound={sound}/>}
          </Card>
        </div>

        <div className="space-y-6">
          <ProgressPanel todaySeconds={todaySeconds} week={weekData()} streak={streak}/>
          {/* Sidebar Tips teaser opens modal */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="text-blue-900 dark:text-blue-100 font-semibold">Tips</div>
              <Button variant="ghost" onClick={() => setTipsOpen(true)}>Open</Button>
            </div>
            <div className="text-sm text-blue-800/70 dark:text-blue-300/80">
              Quick pointers for best results.
            </div>
          </Card>
        </div>
      </main>

      <footer className="max-w-6xl mx-auto px-4 pb-8 text-xs text-blue-800/70 dark:text-blue-300/70">
        Built with ❤️ in React + Tailwind. All data stays in your browser.
      </footer>

      {/* Tips Modal */}
      <Modal open={tipsOpen} onClose={() => setTipsOpen(false)} title="Training Tips">
        <ul className="text-sm text-blue-800/80 dark:text-blue-200 list-disc pl-5 space-y-2">
          <li>Do 3–5 minute bursts per exercise; short sessions compound.</li>
          <li>Increase difficulty gradually (speed/accuracy).</li>
          <li>Hydrate and take a 60–90s break between rounds.</li>
        </ul>
      </Modal>
    </div>
  );
}
