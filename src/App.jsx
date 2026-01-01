import React, { useState, useEffect, Component, useRef } from 'react';
import { Play, Pause, Music, HelpCircle, Calendar, Trophy, CheckCircle, Users, Loader2, Rocket, Clock, AlertTriangle, Lock, Trash2, PlayCircle, BarChart3, X, Eye, Plus, Minus, Undo2, PauseCircle, LogOut, Sparkles } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
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
        <div className="min-h-screen w-full bg-indigo-950 text-red-400 p-8 flex flex-col items-center justify-center text-center">
          <AlertTriangle size={64} className="mb-4 animate-bounce" />
          <h1 className="text-2xl font-bold mb-2">Oeps, er ging iets mis!</h1>
          <p className="text-indigo-200 mb-6">De app struikelde even over een nootje.</p>
          <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="bg-pink-500 hover:bg-pink-600 text-white px-6 py-3 rounded-full font-bold shadow-lg transition-transform hover:scale-105">Herstel & Herlaad</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Helper: Shuffle Array ---
const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// --- Firebase Config ---
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

// --- Game Data ---
const GAME_DATA = [
  { id: 'q1', question: "Welk nummer stond op nummer 1 toen de oudste van ons werd geboren en in welk jaar was dit?", correctYear: '1995', correctTrackId: 't1' },
  { id: 'q2', question: "Welk nummer stond op nummer 1 toen de jongste van ons werd geboren en in welk jaar was dit?", correctYear: '2003', correctTrackId: 't2' },
  { id: 'q3', question: "Welk nummer is typerend voor de wintersport in Solden en in welk jaar was dit?", correctYear: '2023', correctTrackId: 't3' },
  { id: 'q4', question: "Welke iconische solo is gezongen op de avond van 4-11-.... en in welk jaar was dit?", correctYear: '2012', correctTrackId: 't4' },
  { id: 'q5', question: "Welke muzikale compositie stond centraal in een door een deel van ons gespeelde decembervoorstelling en in welk jaar was dit?", correctYear: '2024', correctTrackId: 't5' },
  { id: 'q6', question: "Op welk nummer kwam de eerste bruidegom van onze vriendengroep oplopen en in welk jaar was dit?", correctYear: '2024', correctTrackId: 't6' },
  { id: 'q7', question: "Wie trad er op de laatste editie van WWW en in welk jaar was dit?", correctYear: '2025', correctTrackId: 't7' },
  { id: 'q8', question: "Welk nummer was ongelovelijk populair tijdens onze vakantie in Malta en in welk jaar was dit?", correctYear: '2016', correctTrackId: 't8' },
];

// Jaartallen
const YEARS = ['1995', '2003', '2012', '2016', '2023', '2024', '2024', '2025']; 

// Tracks
const TRACKS = [
  { id: 't1', label: 'Track 1', title: 'Het is een nacht - Guus Meeuwis', src: '/audio/track1.mp3' },
  { id: 't2', label: 'Track 2', title: 'Feel - Robbin Williams', src: '/audio/track2.mp3' },
  { id: 't3', label: 'Track 3', title: 'Meisjes met ijsjes - Discodip', src: '/audio/track3.mp3' },
  { id: 't4', label: 'Track 4', title: 'Looking too closely - Fink', src: '/audio/track4.mp3' },
  { id: 't5', label: 'Track 5', title: 'Canto ostinato - Simeon ten Holt', src: '/audio/track5.mp3' },
  { id: 't6', label: 'Track 6', title: 'Love Story - Taylor swift', src: '/audio/track6.mp3' },
  { id: 't7', label: 'Track 7', title: 'Bek Vol Beschuit - Barfbag', src: '/audio/track7.mp3' },
  { id: 't8', label: 'Track 8', title: "Will Griggg's On Fire - DJ Kicken", src: '/audio/track8.mp3' },
];

// --- Sub Components ---

const SelectionModal = ({ isOpen, title, items, onSelect, onClose, type, connections, currentQuestionId }) => {
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [isOpen]);

  const handleLocalPlay = async (e, item) => {
    e.stopPropagation(); 
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    
    if (playingId === item.id) {
      setPlayingId(null);
      return;
    }

    try {
        const audio = new Audio(item.src);
        audio.onerror = () => {
            alert(`Kan bestand niet afspelen:\n${item.src}\n\nCheck of het bestand in 'public/audio/' staat.`);
            setPlayingId(null);
        };
        audioRef.current = audio;
        await audio.play();
        setPlayingId(item.id);
        audio.onended = () => { setPlayingId(null); audioRef.current = null; };
    } catch (err) {
        setPlayingId(null);
    }
  };

  const handleConfirmSelection = (itemId) => {
     if (audioRef.current) audioRef.current.pause();
     onSelect(itemId);
     onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-end md:items-center justify-center p-4 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 w-full max-w-md rounded-t-3xl md:rounded-3xl border border-white/10 max-h-[85vh] flex flex-col shadow-2xl ring-1 ring-white/20">
        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-indigo-900 to-purple-900 rounded-t-3xl">
          <h3 className="font-bold text-white text-xl flex items-center gap-2">
            {type === 'year' ? <Calendar className="text-cyan-400" /> : <Music className="text-pink-400" />} 
            {title}
          </h3>
          <button onClick={onClose} className="p-2 bg-black/20 hover:bg-black/40 rounded-full text-white transition-colors"><X size={20}/></button>
        </div>
        <div className="p-3 overflow-y-auto grid grid-cols-1 gap-2 bg-slate-900">
          {items.map((item, index) => {
             const itemId = item.id || item; 
             const itemLabel = item.label || item; 
             const isPlaying = playingId === itemId;
             
             const timesUsed = connections.filter(c => 
                 (type === 'year' ? c.year === itemId : c.trackId === itemId)
             ).length;
             
             const totalAvailable = items.filter(i => (i.id || i) === itemId).length;
             
             const isSelectedHere = connections.find(c => 
                c.questionId === currentQuestionId && 
                (type === 'year' ? c.year === itemId : c.trackId === itemId)
             );
             
             const isFullyBooked = timesUsed >= totalAvailable;
             const isUsedByOthers = isFullyBooked && !isSelectedHere;

             return (
              <div key={`${itemId}-${index}`} className={`flex flex-col rounded-2xl border-2 transition-all group overflow-hidden ${isSelectedHere ? 'bg-green-900/30 border-green-500' : (isUsedByOthers ? 'bg-slate-800/50 border-orange-500/30' : 'bg-slate-800 border-slate-700 hover:border-indigo-400')}`}>
                 <div className="flex items-center gap-3 p-3 min-h-[4rem]">
                   {type === 'track' && (
                       <button 
                          onClick={(e) => handleLocalPlay(e, item)}
                          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors shrink-0 ${isPlaying ? 'bg-pink-500 text-white' : 'bg-slate-900 text-pink-500 hover:bg-pink-900/30'}`}
                       >
                          {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                       </button>
                   )}

                   <button onClick={() => handleConfirmSelection(itemId)} className="flex-grow flex items-center justify-center text-center h-full">
                         <div className="flex flex-col items-center gap-1 w-full">
                            <div className="flex items-center gap-2 justify-center">
                                {type === 'year' && <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-blue-500 shrink-0"><Calendar size={16}/></div>}
                                <span className="font-bold text-lg text-slate-200 leading-tight">{itemLabel}</span>
                            </div>
                            {isSelectedHere && <span className="text-green-400 text-xs font-bold mt-1">✓ Gekozen</span>}
                         </div>
                   </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

function GameContent() {
  const [user, setUser] = useState(null);
  const [teamName, setTeamName] = useState(() => localStorage.getItem('musicGame_teamName') || '');
  const [hasJoined, setHasJoined] = useState(() => localStorage.getItem('musicGame_hasJoined') === 'true');
  const [connections, setConnections] = useState(() => JSON.parse(localStorage.getItem('musicGame_connections') || '[]'));
  const [localStatus, setLocalStatus] = useState(() => localStorage.getItem('musicGame_localStatus') || 'waiting'); 
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('musicGame_isAdmin') === 'true');

  const [isReady, setIsReady] = useState(false); 
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [viewingPlayer, setViewingPlayer] = useState(null);

  const [globalStatus, setGlobalStatus] = useState(null); 
  const [isPaused, setIsPaused] = useState(false);
  
  const [leaderboard, setLeaderboard] = useState([]);
  const [lobbyPlayers, setLobbyPlayers] = useState([]);
  
  const [showGlobalResults, setShowGlobalResults] = useState(false);

  // --- Shuffle State ---
  const [randomQuestions] = useState(() => shuffleArray(GAME_DATA));
  const [randomYears] = useState(() => shuffleArray(YEARS));
  const [randomTracks] = useState(() => shuffleArray(TRACKS));

  const [activeModal, setActiveModal] = useState(null);

  // --- Theme Color & Body Background Fix ---
  useEffect(() => {
    document.body.style.backgroundColor = '#1e1b4b'; 
    document.body.style.color = '#fff';
    document.body.style.margin = '0';
    document.body.style.minHeight = '100vh';

    let metaThemeColor = document.querySelector("meta[name='theme-color']");
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.name = 'theme-color';
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.content = '#1e1b4b'; 

    return () => {
    };
  }, []);

  // --- Storage ---
  useEffect(() => { localStorage.setItem('musicGame_teamName', teamName); }, [teamName]);
  useEffect(() => { localStorage.setItem('musicGame_hasJoined', hasJoined); }, [hasJoined]);
  useEffect(() => { localStorage.setItem('musicGame_connections', JSON.stringify(connections)); }, [connections]);
  useEffect(() => { localStorage.setItem('musicGame_localStatus', localStatus); }, [localStatus]);
  useEffect(() => { localStorage.setItem('musicGame_isAdmin', isAdmin); }, [isAdmin]);

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
           setIsPaused(data.isPaused || false);
           if (data.status === 'playing' && localStatus === 'waiting' && hasJoined) setLocalStatus('playing');
           if (data.status === 'lobby' && localStatus !== 'waiting' && localStatus !== 'login') {
              setLocalStatus('waiting'); setConnections([]); setIsReady(false); localStorage.removeItem('musicGame_connections');
           }
        } else {
           setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'global_game_control', 'main'), { status: 'lobby', isPaused: false });
        }
     });
     return () => unsub();
  }, [localStatus, hasJoined]);

  // Hard Reset
  useEffect(() => {
    if (!user || !hasJoined || isAdmin) return;
    const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'music_game_state', user.uid), (docSnap) => {
       if (!docSnap.exists()) {
          setHasJoined(false); setTeamName(''); setConnections([]); setIsReady(false); setLocalStatus('waiting'); setIsAdmin(false); localStorage.clear();
       }
    });
    return () => unsub();
  }, [user, hasJoined, isAdmin]);

  // Progress
  useEffect(() => {
    if (!user || !hasJoined || localStatus !== 'playing' || isAdmin) return;
    const completed = connections.filter(c => c.year && c.trackId).length;
    const progress = Math.round((completed / GAME_DATA.length) * 100);
    setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'music_game_state', user.uid), { progress, connections }, { merge: true });
  }, [connections, user, hasJoined, localStatus, isAdmin]);

  // Data
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'music_game_state'), (snap) => {
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setLobbyPlayers(data);
      const finished = data.filter(d => d.status === 'finished');
      finished.forEach(p => { p.totalScore = (p.score || 0) + (p.bonusPoints || 0); });
      finished.sort((a, b) => b.totalScore - a.totalScore);
      const fastestId = finished.length > 0 ? finished.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0))[0].id : null;
      setLeaderboard(finished.map(e => ({ ...e, isFastest: e.id === fastestId })).sort((a, b) => b.totalScore - a.totalScore));
    });
    return () => unsub();
  }, [user]);

   // Watch lobbyPlayers and automatically show global results when all non-admin players finished
   useEffect(() => {
      const players = lobbyPlayers.filter(p => p.teamName !== 'Spelleider');
      if (players.length > 0 && players.every(p => p.status === 'finished')) {
         setShowGlobalResults(true);
      } else {
         setShowGlobalResults(false);
      }
   }, [lobbyPlayers]);

  // Actions
  const joinLobby = () => {
    if (!teamName || !user) return;
    setHasJoined(true);
    let initialStatus = 'waiting';
    if (globalStatus === 'playing') initialStatus = 'playing';
    setLocalStatus(initialStatus);
    setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'music_game_state', user.uid), { teamName, userId: user.uid, score: 0, status: initialStatus, isReady: false, progress: 0, bonusPoints: 0, joinedAt: serverTimestamp() });
  };

  const tryAdminLogin = () => {
     if (adminPassword === "edkroket") { 
        setIsAdmin(true); setHasJoined(true); setLocalStatus('waiting'); setTeamName("Spelleider"); setShowAdminLogin(false);
     } else { alert("Fout wachtwoord"); }
  };

  const logoutAdmin = () => {
      setIsAdmin(false); setHasJoined(false); setLocalStatus('waiting'); setTeamName('');
      localStorage.removeItem('musicGame_isAdmin'); localStorage.removeItem('musicGame_hasJoined'); localStorage.removeItem('musicGame_teamName');
      setShowAdminDashboard(false);
  };

  const submitScore = () => {
    if (!user || localStatus === 'finished') return;
    let score = 0;
    connections.forEach(c => {
      const q = GAME_DATA.find(x => x.id === c.questionId);
      if (q.correctYear === c.year) score++;
      if (q.correctTrackId === c.trackId) score++;
    });
    setLocalStatus('finished'); 
    setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'music_game_state', user.uid), { score, status: 'finished', progress: 100, timestamp: serverTimestamp() }, { merge: true });
  };

  const resetGame = async () => {
    if(!confirm("LET OP: Reset alles?")) return;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'global_game_control', 'main'), { status: 'lobby', isPaused: false });
    const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'music_game_state'));
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  };

  const startGame = () => {
    setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'global_game_control', 'main'), { status: 'playing', isPaused: false, startedAt: serverTimestamp() });
  };

  const handleSelection = (questionId, type, value) => {
      setConnections(prev => {
          let newConns = [...prev];
          const index = newConns.findIndex(c => c.questionId === questionId);
          if (index >= 0) {
              newConns[index] = { ...newConns[index], [type === 'year' ? 'year' : 'trackId']: value };
          } else {
              newConns.push({ questionId, [type === 'year' ? 'year' : 'trackId']: value, [type === 'year' ? 'trackId' : 'year']: null });
          }
          return newConns.map(c => {
              if (c.questionId === questionId) return c; 
              
              if (type === 'year' && c.year === value) {
                   const limit = YEARS.filter(y => y === value).length;
                   const countInNew = newConns.filter(nc => nc.year === value).length;
                   
                   if (countInNew > limit) {
                       return { ...c, year: null };
                   }
              }
              if (type === 'track' && c.trackId === value) return { ...c, trackId: null };
              return c;
          });
      });
  };

  // --- RENDER ---

  if (!hasJoined) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-indigo-950 to-purple-950 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        
        <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl max-w-md w-full border border-white/10 z-10 animate-fade-in-up">
          <div className="flex justify-center mb-6">
             <div className="w-20 h-20 bg-gradient-to-tr from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30 transform -rotate-3">
                <Music size={40} className="text-white" />
             </div>
          </div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent text-center mb-2">Muziek Connectie</h1>
          <p className="text-slate-400 text-center mb-8 text-sm">Verbind de herinnering, het jaar & de hit!</p>
          
          <div className="space-y-4">
            <input type="text" value={teamName} onChange={e => setTeamName(e.target.value)} className="w-full bg-slate-800/50 border border-slate-600 focus:border-pink-500 rounded-xl p-4 text-white text-lg font-medium placeholder:text-slate-500 outline-none transition-all" placeholder="Verzin een Teamnaam..." />
            <button onClick={joinLobby} disabled={!teamName} className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold py-4 rounded-xl disabled:opacity-50 transition-all shadow-lg shadow-purple-900/30 transform hover:scale-[1.02]">🚀 Stap in de Lobby</button>
          </div>
        </div>
        <button onClick={() => setShowAdminLogin(true)} className="absolute bottom-6 right-6 text-slate-500 hover:text-white p-3 bg-white/5 rounded-full backdrop-blur transition-all z-20"><Lock size={18}/></button>
        {showAdminLogin && (
           <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-slate-900 p-6 rounded-2xl border border-purple-500/50 w-full max-w-sm relative shadow-2xl">
                 <button onClick={() => setShowAdminLogin(false)} className="absolute top-2 right-2 text-slate-400 hover:text-white p-2"><X size={20}/></button>
                 <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Lock className="text-purple-400"/> Admin Login</h2>
                 <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white mb-4 outline-none focus:border-purple-500" placeholder="Wachtwoord" autoFocus />
                 <button onClick={tryAdminLogin} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl shadow-lg">Inloggen</button>
              </div>
           </div>
        )}
      </div>
    );
  }

  if (isAdmin && showAdminDashboard) {
     return (
        <div className="fixed inset-0 bg-slate-950 z-[100] p-0 overflow-y-auto font-sans">
           <div className="max-w-5xl mx-auto min-h-screen flex flex-col">
              <div className="flex justify-between items-center p-4 sticky top-0 bg-slate-950/95 backdrop-blur border-b border-slate-800 z-10">
                 <h2 className="text-xl font-bold text-white flex items-center gap-2"><BarChart3 className="text-purple-500"/> Admin Dashboard</h2>
                 <div className="flex gap-2">
                    <button onClick={logoutAdmin} className="bg-red-500/10 p-2.5 rounded-xl hover:bg-red-500/20 text-red-500 border border-red-500/20 transition-all" title="Uitloggen"><LogOut size={20}/></button>
                    <button onClick={() => setShowAdminDashboard(false)} className="bg-slate-800 p-2.5 rounded-xl hover:bg-slate-700 text-white border border-slate-700 transition-all"><X size={20}/></button>
                 </div>
              </div>
              
              <div className="p-4 flex-grow">
                  <div className="grid grid-cols-2 gap-4 mb-8">
                     <button onClick={startGame} className="bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white p-6 rounded-2xl font-bold flex flex-col items-center justify-center gap-2 shadow-xl shadow-green-900/20 transform hover:scale-[1.02] transition-all">
                        <PlayCircle size={32}/> 
                        <span className="text-lg">START SPEL</span>
                     </button>
                     <button onClick={() => { const newS = !isPaused; setIsPaused(newS); updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'global_game_control', 'main'), { isPaused: newS }); }} className={`${isPaused ? 'bg-orange-500' : 'bg-slate-700'} text-white p-6 rounded-2xl font-bold flex flex-col items-center justify-center gap-2 shadow-xl transition-all`}>
                        {isPaused ? <PlayCircle size={32}/> : <PauseCircle size={32}/>}
                        <span className="text-lg">{isPaused ? "HERVAT" : "PAUZE"}</span>
                     </button>
                     <button onClick={resetGame} className="col-span-2 bg-gradient-to-br from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-red-900/20"><Trash2 size={20}/> VOLLEDIGE RESET</button>
                  </div>

                  <div className="bg-slate-900/50 rounded-2xl p-5 border border-slate-800">
                     <h3 className="text-sm uppercase tracking-wider font-bold text-slate-400 mb-4 px-1">Live Teams ({lobbyPlayers.filter(p => p.teamName !== "Spelleider").length})</h3>
                     <div className="space-y-3">
                        {lobbyPlayers.filter(p => p.teamName !== "Spelleider").map(p => (
                           <div key={p.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700/50 flex flex-col gap-3 shadow-sm">
                              <div className="flex justify-between items-center">
                                 <span className="font-bold text-white text-lg flex items-center gap-2">
                                    {p.teamName}
                                    {p.isReady && <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full border border-green-500/30">Lobby Ready</span>}
                                 </span>
                                 <div className="flex gap-2">
                                    <button onClick={() => setViewingPlayer(p)} className="p-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 border border-blue-500/20"><Eye size={18}/></button>
                                    <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'music_game_state', p.id))} className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 border border-red-500/20"><Trash2 size={18}/></button>
                                 </div>
                              </div>
                              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                                  <div className={`h-full transition-all duration-500 ${p.status === 'finished' ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${p.progress || 0}%` }}></div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
              </div>

              {viewingPlayer && (
                 <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[110] p-4 backdrop-blur-sm">
                    <div className="bg-slate-900 p-6 rounded-2xl max-w-md w-full border border-slate-700 relative shadow-2xl">
                       <button onClick={() => setViewingPlayer(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X/></button>
                       <h3 className="text-xl font-bold mb-6 text-white pr-8">Bord van {viewingPlayer.teamName}</h3>
                       <div className="space-y-3 text-sm text-slate-300 max-h-[60vh] overflow-y-auto pr-2">
                          {viewingPlayer.connections?.map((c, i) => {
                             const q = GAME_DATA.find(gx => gx.id === c.questionId);
                             const t = TRACKS.find(tx => tx.id === c.trackId);
                             return (
                                <div key={i} className="flex flex-col bg-slate-800 p-3 rounded-lg border border-slate-700/50">
                                   <span className="font-bold text-slate-400 mb-1">{q?.question}</span>
                                   <div className="flex justify-between items-center">
                                      <span className={c.year ? "text-blue-300 font-mono" : "text-slate-600"}>{c.year || '---'}</span>
                                      <span className={c.trackId ? "text-pink-300 font-medium" : "text-slate-600"}>{t?.label || '---'}</span>
                                   </div>
                                </div>
                             )
                          })}
                       </div>
                    </div>
                 </div>
              )}
           </div>
        </div>
     );
  }

  if (localStatus === 'waiting') {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-indigo-950 to-slate-950 text-slate-100 p-4 pb-24 overflow-hidden font-sans">
        <div className="max-w-xl mx-auto mt-8 animate-fade-in-down">
           <header className="text-center mb-8">
              <div className="inline-block p-3 rounded-2xl bg-slate-800/50 border border-slate-700 mb-4 shadow-xl">
                  <h1 className="text-xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-cyan-400">Muziek Connectie</h1>
              </div>
              <h2 className="text-4xl font-black text-white mb-2 tracking-tight">Wachtruimte</h2>
              <p className="text-indigo-200/60 font-medium">De show begint zo...</p>
           </header>

           <div className="bg-slate-900/60 backdrop-blur-md rounded-3xl p-6 border border-white/5 shadow-2xl mb-8">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2"><Users size={16} className="text-indigo-400"/> Teams aan boord</h3>
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                 {lobbyPlayers.filter(p => p.teamName !== "Spelleider").map(p => (
                    <div key={p.id} className="flex justify-between items-center bg-slate-800/80 p-4 rounded-xl border border-slate-700/50 shadow-sm">
                       <span className="font-bold text-white">{p.teamName}</span>
                       {p.isReady ? (
                          <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                             <CheckCircle size={14} fill="currentColor" className="text-emerald-500"/> READY
                          </span>
                       ) : (
                          <span className="text-slate-600 text-xs font-bold animate-pulse">...</span>
                       )}
                    </div>
                 ))}
                 {lobbyPlayers.length <= 1 && <div className="text-slate-600 text-center py-4 italic">Nog niemand anders hier...</div>}
              </div>
           </div>
           
           {!isAdmin && (
              <div className="space-y-4">
                 <button onClick={() => { setIsReady(!isReady); setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'music_game_state', user.uid), { isReady: !isReady }, { merge: true }); }} className={`w-full py-4 rounded-2xl font-bold text-lg transition-all transform active:scale-95 shadow-xl ${isReady ? 'bg-emerald-500 text-white hover:bg-emerald-400' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                    {isReady ? '✅ Je bent er klaar voor!' : '👋 Klik hier als je klaar bent!'}
                 </button>
                 <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
                    <Loader2 size={14} className="animate-spin"/> Wachten op spelleider
                 </div>
              </div>
           )}
        </div>
        {isAdmin && <button onClick={() => setShowAdminDashboard(true)} className="fixed bottom-6 right-6 bg-purple-600 hover:bg-purple-500 text-white p-4 rounded-2xl shadow-2xl z-50 flex items-center gap-2 font-bold animate-bounce"><BarChart3 size={24} /> <span className="hidden sm:inline">Admin</span></button>}
      </div>
    );
  }

  if (localStatus === 'finished') {
    const myScore = connections.reduce((acc, c) => {
       const q = GAME_DATA.find(x => x.id === c.questionId);
       if(!q) return acc;
       return acc + (q.correctYear === c.year ? 1 : 0) + (q.correctTrackId === c.trackId ? 1 : 0);
    }, 0);

    if (!showGlobalResults) {
        const activePlayers = lobbyPlayers.filter(p => p.teamName !== 'Spelleider');
        const finishedCount = activePlayers.filter(p => p.status === 'finished').length;

        return (
            <div className="min-h-screen w-full bg-slate-950 text-slate-100 p-4 pb-24 font-sans overflow-y-auto">
                <div className="max-w-xl mx-auto mt-10 text-center animate-fade-in">
                    <div className="mb-8">
                        <div className="inline-block p-4 rounded-full bg-green-500/20 text-green-400 mb-4 shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                            <CheckCircle size={48} />
                        </div>
                        <h2 className="text-3xl font-black text-white mb-2">Antwoorden Ingediend!</h2>
                        <p className="text-slate-400">Even geduld tot iedereen klaar is...</p>
                    </div>

                    <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl text-left">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4 flex justify-between items-center">
                            <span>Status</span>
                            <span className="text-white">{finishedCount} / {activePlayers.length}</span>
                        </h3>
                        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                            {activePlayers.map(p => (
                                <div key={p.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                                    <span className={`font-bold ${p.userId === user.uid ? 'text-purple-400' : 'text-slate-300'}`}>
                                        {p.teamName} {p.userId === user.uid && "(Jij)"}
                                    </span>
                                    {p.status === 'finished' ? (
                                        <span className="text-green-400 flex items-center gap-1 text-xs font-bold bg-green-900/20 px-2 py-1 rounded">
                                            <CheckCircle size={12} /> KLAAR
                                        </span>
                                    ) : (
                                        <span className="text-blue-400 flex items-center gap-1 text-xs font-bold bg-blue-900/20 px-2 py-1 rounded animate-pulse">
                                            <Loader2 size={12} className="animate-spin" /> BEZIG
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                {isAdmin && <button onClick={() => setShowAdminDashboard(true)} className="fixed bottom-6 right-6 bg-purple-600 hover:bg-purple-500 text-white p-4 rounded-2xl shadow-2xl z-50 flex items-center gap-2 font-bold"><BarChart3 size={24} /></button>}
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-slate-950 text-slate-100 p-4 pb-24 font-sans overflow-y-auto">
            <div className="max-w-2xl mx-auto mt-4 animate-fade-in">
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-3xl border border-slate-700 text-center mb-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500"></div>
                    <h2 className="text-xl font-bold text-slate-400 mb-2 uppercase tracking-widest">Jouw Score</h2>
                    <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 drop-shadow-lg">{myScore}</div>
                    <div className="text-slate-500 font-medium mt-2">punten behaald</div>
                </div>

                <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl">
                   <div className="flex justify-between items-center mb-6 px-2">
                      <h3 className="text-xl font-bold text-yellow-500 flex gap-2 items-center"><Trophy className="text-yellow-500 fill-yellow-500/20"/> Ranglijst</h3>
                   </div>
                   <div className="space-y-3">
                      {leaderboard.map((p, i) => (
                         <div key={p.id} className={`flex justify-between items-center p-4 rounded-2xl border transition-all ${p.teamName === teamName ? 'bg-purple-900/20 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.1)] scale-[1.02]' : 'bg-slate-800/50 border-slate-700/50'}`}>
                            <div className="flex gap-4 items-center">
                                <span className={`font-black text-xl w-8 text-center ${i===0?'text-yellow-400 text-2xl':(i===1?'text-slate-300':'text-amber-700')}`}>{i+1}</span>
                                <div>
                                    <span className="font-bold block text-white">{p.teamName}</span>
                                    {p.isFastest && <span className="text-[10px] text-yellow-400 bg-yellow-900/30 px-2 py-0.5 rounded border border-yellow-500/20 flex gap-1 items-center w-fit"><Rocket size={10}/> SNELSTE</span>}
                                </div>
                            </div>
                            <div className="text-right"><span className="text-2xl font-black text-white block">{p.totalScore + (p.isFastest?1:0)}</span></div>
                         </div>
                      ))}
                      {leaderboard.length === 0 && <p className="text-slate-500 text-center py-8">Nog niemand klaar...</p>}
                   </div>
                </div>
                
                {/* Resultaten Overzicht */}
                <div className="space-y-4 mt-8">
                  <h3 className="text-xl font-bold text-white text-center">Jouw Resultaten & Antwoorden</h3>
                  {GAME_DATA.map(q => {
                     const userConn = connections.find(c => c.questionId === q.id);
                     const userYear = userConn?.year;
                     const userTrackId = userConn?.trackId;
                     const userTrack = TRACKS.find(t => t.id === userTrackId);

                     const correctTrack = TRACKS.find(t => t.id === q.correctTrackId);
                     
                     const isYearCorrect = userYear === q.correctYear;
                     const isTrackCorrect = userTrackId === q.correctTrackId;

                     return (
                       <div key={q.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-md">
                         <p className="text-slate-300 font-bold mb-3 text-sm">{q.question}</p>
                         
                         <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                            <div className={`p-2 rounded bg-slate-900 border ${isYearCorrect ? "border-green-500/50 text-green-300" : "border-red-500/50 text-red-300"}`}>
                               <span className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Jouw Jaar</span>
                               {userYear || "-"} 
                               {!isYearCorrect && <span className="block text-green-400 text-xs mt-1">Correct: {q.correctYear}</span>}
                            </div>

                            <div className={`p-2 rounded bg-slate-900 border ${isTrackCorrect ? "border-green-500/50 text-green-300" : "border-red-500/50 text-red-300"}`}>
                               <span className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Jouw Track</span>
                               {userTrack ? userTrack.label : "-"}
                               {!isTrackCorrect && <span className="block text-green-400 text-xs mt-1">Correct: {correctTrack.label}</span>}
                            </div>
                         </div>
                         
                         <div className="pt-2 border-t border-slate-700/50 text-center">
                            <span className="text-purple-400 text-xs uppercase font-bold mr-2">De Track Was:</span> 
                            <span className="text-white font-medium italic">{correctTrack.title}</span>
                         </div>
                       </div>
                     )
                  })}
                </div>

            </div>
            {isAdmin && <button onClick={() => setShowAdminDashboard(true)} className="fixed bottom-6 right-6 bg-purple-600 hover:bg-purple-500 text-white p-4 rounded-2xl shadow-2xl z-50 flex items-center gap-2 font-bold"><BarChart3 size={24} /></button>}
        </div>
    );
  }

  const isFull = connections.length >= GAME_DATA.length && connections.every(c => c.year && c.trackId);

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 font-sans pb-32">
      {isPaused && (
         <div className="fixed inset-0 bg-black/80 z-[60] flex flex-col items-center justify-center p-8 text-center backdrop-blur-md animate-fade-in">
            <PauseCircle size={80} className="text-orange-500 mb-4 animate-bounce"/>
            <h2 className="text-4xl font-black text-white mb-2 tracking-tight">PAUZE</h2>
            <p className="text-slate-400">Even wachten op de spelleider...</p>
         </div>
      )}

      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-white/5 p-4 flex justify-between items-center shadow-lg h-20">
         <div>
             <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-0.5">Jouw Team</div>
             <div className="text-sm font-bold text-white bg-slate-800 px-3 py-1 rounded-full border border-slate-700">{teamName}</div>
         </div>
         <div className="flex gap-2 items-center">
             {isAdmin && <button onClick={() => setShowAdminDashboard(true)} className="bg-purple-600 text-white p-2.5 rounded-xl hover:bg-purple-500 shadow-lg shadow-purple-900/20"><BarChart3 size={20}/></button>}
             <button onClick={submitScore} disabled={!isFull || isPaused} className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg ${isFull ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-green-900/30 transform hover:scale-105' : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'}`}>
                <CheckCircle size={18}/> Klaar!
             </button>
         </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 animate-fade-in">
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {randomQuestions.map((q) => {
               const myConn = connections.find(c => c.questionId === q.id);
               const selectedYear = myConn?.year;
               const selectedTrackId = myConn?.trackId;
               const selectedTrack = TRACKS.find(t => t.id === selectedTrackId);
               
               const isComplete = selectedYear && selectedTrackId;

               return (
                  <div key={q.id} className={`bg-slate-900 rounded-3xl p-5 border-2 transition-all flex flex-col gap-4 shadow-xl relative overflow-hidden group ${isComplete ? 'border-green-500/50 shadow-green-900/10' : 'border-slate-800 hover:border-slate-700'}`}>
                     <div className={`absolute inset-0 bg-gradient-to-br ${isComplete ? 'from-green-500/5 to-emerald-500/5' : 'from-indigo-500/5 to-purple-500/5'} opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                     
                     <div className="flex items-start gap-4 relative z-10">
                        <div className={`w-10 h-10 rounded-xl flex shrink-0 items-center justify-center font-black text-lg shadow-inner ${isComplete ? 'bg-green-500 text-green-950' : 'bg-slate-800 text-slate-500'}`}>{q.id.replace('q','')}</div>
                        <p className="font-bold text-slate-200 text-base pt-1 leading-snug">{q.question}</p>
                     </div>
                     
                     <div className="grid grid-cols-2 gap-3 mt-auto relative z-10">
                        <button 
                           onClick={() => setActiveModal({ type: 'year', questionId: q.id })}
                           disabled={isPaused}
                           className={`p-3 rounded-2xl border-2 text-sm font-bold flex flex-col items-center justify-center gap-2 transition-all min-h-[8rem] h-auto shadow-sm
                              ${selectedYear 
                                 ? 'bg-blue-950 border-blue-500/50 text-blue-200 shadow-[inset_0_0_20px_rgba(59,130,246,0.1)]' 
                                 : 'bg-slate-950 border-slate-800 text-slate-600 hover:border-slate-700 hover:bg-slate-900'}`}
                        >
                           <div className="flex flex-col items-center justify-center leading-none">
                              <Calendar size={20} className={selectedYear ? "text-blue-400" : "opacity-30"} />
                              <span className="truncate w-full text-center mt-2">{selectedYear || "Kies Jaar"}</span>
                           </div>
                        </button>

                        <button 
                           onClick={() => setActiveModal({ type: 'track', questionId: q.id })}
                           disabled={isPaused}
                           className={`p-3 rounded-2xl border-2 text-sm font-bold flex flex-col items-center justify-center gap-2 transition-all min-h-[8rem] h-auto shadow-sm
                              ${selectedTrackId 
                                 ? 'bg-pink-950 border-pink-500/50 text-pink-200 shadow-[inset_0_0_20px_rgba(236,72,153,0.1)]' 
                                 : 'bg-slate-950 border-slate-800 text-slate-600 hover:border-slate-700 hover:bg-slate-900'}`}
                        >
                           <div className="flex flex-col items-center justify-center leading-none">
                              <Music size={20} className={selectedTrackId ? "text-pink-400" : "opacity-30"} />
                              <span className="w-full text-center text-xs px-1 whitespace-normal leading-tight mt-2">{selectedTrack ? selectedTrack.label : "Kies Track"}</span>
                           </div>
                        </button>
                     </div>
                  </div>
               )
            })}
         </div>
      </main>

      <SelectionModal 
         isOpen={!!activeModal}
         title={activeModal?.type === 'year' ? "Kies een Jaar" : "Kies een Nummer"}
         type={activeModal?.type}
         items={activeModal?.type === 'year' ? randomYears : randomTracks}
         onSelect={(val) => handleSelection(activeModal.questionId, activeModal.type, val)}
         onClose={() => setActiveModal(null)}
         connections={connections}
         currentQuestionId={activeModal?.questionId}
      />

    </div>
  );
}

export default function App() { return <ErrorBoundary><GameContent /></ErrorBoundary>; }