import React, { useState, useRef, useEffect, useLayoutEffect, Component } from 'react';
import { Play, Pause, Music, HelpCircle, Calendar, RefreshCcw, CheckCircle, Users, Trophy, Loader2, Rocket, Clock, AlertTriangle, Lock, Trash2, PlayCircle } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, updateDoc, onSnapshot, serverTimestamp, getDocs, deleteDoc } from 'firebase/firestore';

// --- Error Boundary ---
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  componentDidCatch(error, errorInfo) { 
    this.setState({ error });
    console.error("Crash:", error, errorInfo); 
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-red-500 p-8 flex flex-col items-center justify-center text-center">
          <AlertTriangle size={64} className="mb-4" />
          <h1 className="text-xl font-bold">Er ging iets mis!</h1>
          <button onClick={() => window.location.reload()} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded">Herladen</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyBsE1MwoImcCiMmtI6fglbRF8cs3pmmMF8",
  authDomain: "muziekspel-8e190.firebaseapp.com",
  projectId: "muziekspel-8e190",
  storageBucket: "muziekspel-8e190.firebasestorage.app",
  messagingSenderId: "574627950104",
  appId: "1:574627950104:web:e5b9965e3d342f33315d6d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "muziekspel-8e190"; 

// --- Data ---
const GAME_DATA = [
  { id: 'q1', question: "Eerste bruidegom kwam oplopen", correctYear: '2018', correctTrackId: 't3' },
  { id: 'q2', question: "Wie kotste er in de taxi?", correctYear: '2015', correctTrackId: 't1' },
  { id: 'q3', question: "Huisfeest waar de politie kwam", correctYear: '2022', correctTrackId: 't2' },
  { id: 'q4', question: "Roadtrip naar Frankrijk", correctYear: '2019', correctTrackId: 't4' }
];
const YEARS = ['2015', '2018', '2019', '2022']; 
const TRACKS = [
  { id: 't1', label: 'Track A', title: 'Party Rock Anthem', src: '#' },
  { id: 't2', label: 'Track B', title: 'Police - Roxanne', src: '#' },
  { id: 't3', label: 'Track C', title: 'Wedding March Remix', src: '#' },
  { id: 't4', label: 'Track D', title: 'Alors on Danse', src: '#' },
];

function GameContent() {
  const [user, setUser] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [isReady, setIsReady] = useState(false); 
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [globalStatus, setGlobalStatus] = useState('lobby'); 
  const [connections, setConnections] = useState([]); 
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);
  const [localStatus, setLocalStatus] = useState('waiting'); 
  
  const [leaderboard, setLeaderboard] = useState([]);
  const [lobbyPlayers, setLobbyPlayers] = useState([]);
  const [activeTab, setActiveTab] = useState('game'); 

  const containerRef = useRef(null);
  const itemRefs = useRef({});
  const setItemRef = (id, el) => { itemRefs.current[id] = el; };

  // Init
  useEffect(() => {
    signInAnonymously(auth).catch(e => console.error(e));
    const unsub = onAuthStateChanged(auth, u => u && setUser(u));
    return () => unsub();
  }, []);

  // Global State
  useEffect(() => {
     const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'global_game_control', 'main'), (snap) => {
        if (snap.exists()) {
           const data = snap.data();
           setGlobalStatus(data.status); 
           if (data.status === 'playing' && localStatus === 'waiting' && hasJoined) setLocalStatus('playing');
           if (data.status === 'lobby' && localStatus !== 'waiting') {
              setLocalStatus('waiting');
              setConnections([]);
              setIsReady(false);
           }
        } else {
           setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'global_game_control', 'main'), { status: 'lobby' });
        }
     });
     return () => unsub();
  }, [localStatus, hasJoined]);

  // Leaderboard
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'music_game_state'), (snap) => {
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setLobbyPlayers(data);
      
      const finished = data.filter(d => d.status === 'finished').sort((a, b) => b.score - a.score);
      const fastestId = finished.length > 0 ? finished.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0))[0].id : null;
      
      setLeaderboard(finished.map(e => ({ ...e, isFastest: e.id === fastestId })).sort((a, b) => b.score - a.score));
    });
    return () => unsub();
  }, [user]);

  // Actions
  const joinLobby = () => {
    if (!teamName || !user) return;
    setHasJoined(true);
    setLocalStatus('waiting');
    setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'music_game_state', user.uid), {
      teamName, userId: user.uid, score: 0, status: 'lobby', isReady: false, joinedAt: serverTimestamp()
    });
  };

  const adminLogin = () => {
    if (prompt("Wachtwoord:") === "admin") {
      setIsAdmin(true); setHasJoined(true); setLocalStatus('waiting'); setTeamName("Spelleider");
    }
  };

  const handleQClick = (id) => {
    if (localStatus !== 'playing') return;
    setSelectedQuestionId(id);
    if (!connections.find(c => c.questionId === id)) setConnections([...connections, { questionId: id, year: null, trackId: null }]);
  };

  const updateConn = (key, val) => {
    if (!selectedQuestionId || localStatus !== 'playing') return;
    setConnections(prev => prev.map(c => c.questionId === selectedQuestionId ? { ...c, [key]: val } : c));
  };

  const submitScore = () => {
    if (!user || localStatus === 'finished') return;
    let score = 0;
    connections.forEach(c => {
      const q = GAME_DATA.find(x => x.id === c.questionId);
      if (q.correctYear === c.year) score++;
      if (q.correctTrackId === c.trackId) score++;
    });
    setLocalStatus('finished'); setActiveTab('scores');
    setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'music_game_state', user.uid), {
      score, status: 'finished', timestamp: serverTimestamp(), teamName: teamName || "Spelleider", userId: user.uid
    }, { merge: true });
  };

  const resetGame = async () => {
    if(!confirm("Alles resetten?")) return;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'global_game_control', 'main'), { status: 'lobby' });
    const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'music_game_state'));
    snap.forEach(d => deleteDoc(d.ref));
  };

  const startGame = () => {
    setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'global_game_control', 'main'), { status: 'playing', startedAt: serverTimestamp() });
  };

  // Lines
  const [lines, setLines] = useState([]);
  const colors = { 'q1': '#EF4444', 'q2': '#3B82F6', 'q3': '#10B981', 'q4': '#F59E0B' };

  useLayoutEffect(() => {
    const calcLines = () => {
      if (!containerRef.current) return;
      const root = containerRef.current.getBoundingClientRect();
      const newLines = [];
      connections.forEach(c => {
        const qEl = itemRefs.current[`q-${c.questionId}`];
        if (!qEl) return;
        const qBox = qEl.getBoundingClientRect();
        
        const addLine = (targetId, isTrack) => {
           const tEl = itemRefs.current[targetId];
           if(!tEl) return;
           const tBox = tEl.getBoundingClientRect();
           newLines.push({
             id: `${c.questionId}-${targetId}`,
             x1: qBox.left + qBox.width/2 - root.left,
             y1: isTrack ? qBox.bottom - root.top : qBox.top - root.top,
             x2: tBox.left + tBox.width/2 - root.left,
             y2: isTrack ? tBox.top - root.top : tBox.bottom - root.top,
             color: colors[c.questionId],
             correct: localStatus === 'finished' ? (GAME_DATA.find(x=>x.id===c.questionId)[isTrack ? 'correctTrackId' : 'correctYear'] === (isTrack ? c.trackId : c.year)) : null
           });
        };
        if(c.year) addLine(`y-${c.year}`, false);
        if(c.trackId) addLine(`t-${c.trackId}`, true);
      });
      setLines(newLines);
    };
    calcLines();
    window.addEventListener('resize', calcLines);
    const t = setTimeout(calcLines, 500); 
    return () => { window.removeEventListener('resize', calcLines); clearTimeout(t); };
  }, [connections, localStatus, activeTab]); 

  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 relative">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full border border-slate-700">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent text-center mb-6">Muziek Connectie</h1>
          <div className="space-y-4">
            <input type="text" value={teamName} onChange={e => setTeamName(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white" placeholder="Team Naam" />
            <button onClick={joinLobby} disabled={!teamName} className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:opacity-90 text-white font-bold py-3 rounded-lg disabled:opacity-50">Ga naar Lobby</button>
          </div>
        </div>
        <button onClick={adminLogin} className="absolute bottom-4 right-4 text-slate-600 p-2"><Lock size={16}/></button>
      </div>
    );
  }

  if (localStatus === 'waiting') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 p-4 pb-24">
        <div className="max-w-2xl mx-auto mt-10">
           <h2 className="text-3xl font-bold text-center mb-8">Wachtruimte</h2>
           <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl mb-8">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Users className="text-pink-500"/> Teams ({lobbyPlayers.length})</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                 {lobbyPlayers.map(p => (
                    <div key={p.id} className="flex justify-between bg-slate-900 p-3 rounded-lg border border-slate-800">
                       <span>{p.teamName}</span>
                       {p.isReady ? <span className="text-green-400 flex items-center gap-1"><CheckCircle size={14}/> Klaar</span> : <span className="text-slate-500 text-sm">...</span>}
                    </div>
                 ))}
              </div>
           </div>
           <button onClick={() => { setIsReady(!isReady); setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'music_game_state', user.uid), { isReady: !isReady }, { merge: true }); }} className={`w-full py-4 rounded-xl font-bold text-lg ${isReady ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300'}`}>{isReady ? 'Je bent klaar!' : 'Klik als je klaar bent!'}</button>
           <p className="text-center text-slate-500 text-sm mt-4 animate-pulse">Wachten op start...</p>
        </div>
        {isAdmin && (
           <div className="fixed bottom-4 left-4 right-4 bg-slate-800 border-2 border-purple-500 p-4 rounded-xl flex gap-2 justify-center z-50">
              <button onClick={startGame} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"><PlayCircle size={18}/> Start</button>
              <button onClick={resetGame} className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"><Trash2 size={18}/> Reset</button>
           </div>
        )}
      </div>
    );
  }

  const isFull = connections.length >= GAME_DATA.length && connections.every(c => c.year && c.trackId);
  const score = connections.reduce((acc, c) => {
     const q = GAME_DATA.find(x => x.id === c.questionId);
     if(!q) return acc;
     return acc + (q.correctYear === c.year ? 1 : 0) + (q.correctTrackId === c.trackId ? 1 : 0);
  }, 0);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-24 font-sans">
      <header className="sticky top-0 z-40 bg-slate-900/90 border-b border-slate-700 p-4 flex justify-between items-center shadow-lg">
         <div><div className="text-xs text-slate-400">TEAM: {teamName}</div><h2 className="font-bold">Muziek Connectie</h2></div>
         {localStatus === 'playing' && (
            <button onClick={submitScore} disabled={!isFull} className={`px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 ${isFull ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-500'}`}><CheckCircle size={16}/> Klaar</button>
         )}
         {localStatus === 'finished' && <div className="text-green-400 font-bold text-xl">Score: {score}</div>}
      </header>

      <main className="max-w-5xl mx-auto p-4">
         {activeTab === 'scores' && (
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-yellow-500 flex gap-2"><Trophy/> Uitslag</h3>
               </div>
               <div className="space-y-3">
                  {leaderboard.map((p, i) => (
                     <div key={p.id} className={`flex justify-between p-4 rounded border ${p.teamName === teamName ? 'bg-purple-900/30 border-purple-500' : 'bg-slate-900 border-slate-800'}`}>
                        <div className="flex gap-4 items-center"><span className="font-mono font-bold text-xl w-8 text-center">{i+1}</span><div><span className="font-bold block">{p.teamName}</span>{p.isFastest && <span className="text-xs text-yellow-400 flex gap-1"><Rocket size={12}/> Snelste</span>}</div></div>
                        <div className="text-right"><span className="text-2xl font-bold text-purple-400 block">{p.score + (p.isFastest?1:0)}</span>{p.timestamp && <span className="text-xs text-slate-500 flex justify-end gap-1"><Clock size={10}/>{new Date(p.timestamp.seconds*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>}</div>
                     </div>
                  ))}
               </div>
            </div>
         )}

         {activeTab === 'game' && (
            <div ref={containerRef} className="relative min-h-[80vh]">
               <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-10 overflow-visible">
                  {lines.map(l => <line key={l.id} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.correct===false?'#ef4444':(l.correct===true?'#22c55e':l.color)} strokeWidth={3} strokeDasharray={l.correct===false?"5,5":"0"} className="transition-all duration-300 opacity-80"/>)}
               </svg>
               <div className="flex flex-col md:grid md:grid-rows-[auto_1fr_auto] gap-8 md:gap-16">
                  {/* Years */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 z-20 order-1">
                     {YEARS.map(y => (
                        <button key={y} ref={el=>setItemRef(`y-${y}`, el)} onClick={()=>updateConn('year', y)} disabled={!selectedQuestionId || localStatus==='finished'} className={`p-4 rounded-lg text-center border-2 transition-all ${selectedQuestionId && localStatus!=='finished' ? 'active:scale-95' : ''} ${localStatus==='finished'?'bg-slate-800 border-slate-600 text-slate-400':'bg-slate-800 border-indigo-500/30 text-indigo-300'}`}><span className="text-xl font-bold">{y}</span></button>
                     ))}
                  </div>
                  {/* Questions */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 z-20 order-2">
                     {GAME_DATA.map(q => {
                        const sel = selectedQuestionId === q.id;
                        const col = colors[q.id];
                        return (
                           <button key={q.id} ref={el=>setItemRef(`q-${q.id}`, el)} onClick={()=>handleQClick(q.id)} style={{borderColor: sel?col:'transparent', backgroundColor: sel?'rgba(30,41,59,1)':'rgba(30,41,59,0.6)'}} className={`min-h-[120px] p-4 rounded-xl text-center border-2 transition-all flex md:flex-col items-center justify-between md:justify-center gap-4 relative shadow-lg ${sel?'ring-2 ring-offset-2 ring-offset-slate-900 z-30':'border-slate-600'}`}>
                              <div className="w-8 h-8 rounded-full flex shrink-0 items-center justify-center text-white font-bold" style={{backgroundColor: col}}>?</div>
                              <div className="flex-grow flex flex-col items-center w-full">
                                 <p className="text-sm font-medium text-slate-200">{q.question}</p>
                              </div>
                              <div className="flex flex-col md:flex-row gap-1">
                                 <div className={`w-2 h-2 rounded-full ${connections.find(c=>c.questionId===q.id)?.year?'bg-green-400':'bg-slate-600'}`}></div>
                                 <div className={`w-2 h-2 rounded-full ${connections.find(c=>c.questionId===q.id)?.trackId?'bg-green-400':'bg-slate-600'}`}></div>
                              </div>
                           </button>
                        );
                     })}
                  </div>
                  {/* Tracks */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 z-20 order-3">
                     {TRACKS.map(t => (
                        <div key={t.id} ref={el=>setItemRef(`t-${t.id}`, el)} onClick={()=>updateConn('trackId', t.id)} className={`p-3 rounded-lg border-2 bg-slate-800 text-center transition-all ${selectedQuestionId && localStatus!=='finished'?'cursor-pointer hover:border-pink-500':''} ${connections.find(c=>c.trackId===t.id)&&localStatus!=='finished'?'border-slate-500':'border-slate-700'}`}>
                           <div className="flex flex-col items-center gap-2">
                              <button className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-pink-500"><Play size={16} fill="currentColor"/></button>
                              <span className="font-bold text-sm text-slate-300 block">{t.label}</span>
                              {localStatus === 'finished' && <span className="text-xs text-green-400 animate-pulse">{t.title}</span>}
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
         )}
      </main>

      <nav className="fixed bottom-0 left-0 w-full bg-slate-900 border-t border-slate-800 p-2 flex justify-around md:hidden z-50 safe-area-bottom">
         <button onClick={()=>setActiveTab('game')} className={`p-2 flex flex-col items-center ${activeTab==='game'?'text-pink-500':'text-slate-500'}`}><HelpCircle size={20}/><span className="text-xs">Game</span></button>
         <button onClick={()=>setActiveTab('scores')} className={`p-2 flex flex-col items-center ${activeTab==='scores'?'text-pink-500':'text-slate-500'}`}><Trophy size={20}/><span className="text-xs">Scorebord</span></button>
      </nav>
      
      {isAdmin && (
         <div className="fixed bottom-4 left-4 right-4 bg-slate-800 border-2 border-purple-500 p-4 rounded-xl flex gap-2 justify-center z-50 shadow-2xl animate-slide-up">
            <button onClick={startGame} className="bg-green-600 text-white px-4 py-2 rounded font-bold flex gap-2"><PlayCircle size={18}/> Start</button>
            <button onClick={resetGame} className="bg-red-600 text-white px-4 py-2 rounded font-bold flex gap-2"><Trash2 size={18}/> Reset</button>
         </div>
      )}
    </div>
  );
}

export default function App() { return <ErrorBoundary><GameContent /></ErrorBoundary>; }