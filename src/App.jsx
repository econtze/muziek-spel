import React, { useState, useEffect, Component, useRef } from 'react';
import { Play, Pause, Music, HelpCircle, Calendar, Trophy, CheckCircle, Users, Loader2, Rocket, Clock, AlertTriangle, Lock, Trash2, PlayCircle, BarChart3, X, Eye, Plus, Minus, Undo2, PauseCircle, LogOut, Sparkles, Disc, Mic2, ArrowRight } from 'lucide-react';
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
  { id: 'q4', question: "Welke iconische solo is gezongen op de avond van 4-11-.... en in welk jaar was dit?", correctYear: '2014', correctTrackId: 't4' },
  { id: 'q5', question: "Welke muzikale compositie stond centraal in een door een deel van ons gespeelde decembervoorstelling en in welk jaar was dit?", correctYear: '2012', correctTrackId: 't5' },
  { id: 'q6', question: "Op welk nummer kwam de eerste bruidegom van onze vriendengroep oplopen en in welk jaar was dit?", correctYear: '2024', correctTrackId: 't6' },
  { id: 'q7', question: "Wie trad er op de laatste editie van WWW en in welk jaar was dit?", correctYear: '2025', correctTrackId: 't7' },
  { id: 'q8', question: "Welk nummer was ongelovelijk populair tijdens onze vakantie in Malta en in welk jaar was dit?", correctYear: '2016', correctTrackId: 't8' },
];

const YEARS = ['1995', '2003', '2012', '2014', '2016', '2023', '2024', '2025']; 

// Tracks
const TRACKS = [
  { id: 't1', label: 'Track 1', title: 'Het is een nacht', artist: 'Guus Meeuwis', releaseYear: '1995', src: '/audio/track1.mp3' },
  { id: 't2', label: 'Track 2', title: 'Feel', artist: 'Robbin Williams', releaseYear: '2002', src: '/audio/track2.mp3' },
  { id: 't3', label: 'Track 3', title: 'Meisjes met ijsjes', artist: 'Discodip', releaseYear: '2023', src: '/audio/track3.mp3' },
  { id: 't4', label: 'Track 4', title: 'Looking too closely', artist: 'Fink', releaseYear: '2014', src: '/audio/track4.mp3' },
  { id: 't5', label: 'Track 5', title: 'Canto ostinato', artist: 'Simeon ten Holt', releaseYear: '1976', src: '/audio/track5.mp3' },
  { id: 't6', label: 'Track 6', title: 'Love Story', artist: 'Taylor Swift', releaseYear: '2008', src: '/audio/track6.mp3' },
  { id: 't7', label: 'Track 7', title: 'Bek Vol Beschuit', artist: 'Barfbag', releaseYear: '2025', src: '/audio/track7.mp3' },
  { id: 't8', label: 'Track 8', title: "Will Griggg's On Fire", artist: 'DJ Kicken', releaseYear: '2016', src: '/audio/track8.mp3' },
];

const RELEASE_YEARS = TRACKS.map(t => t.releaseYear).sort();

// --- Sub Components ---

const Round2Card = ({ t, connectionsR2, setActiveModal, handleArtistInput, handleTitleInput }) => {
    const myConn = connectionsR2.find(c => c.trackId === t.id);
    const selectedYear = myConn?.year;
    const titleInput = myConn?.titleName || "";
    const artistInput = myConn?.artistName || "";
    
    const isComplete = selectedYear && titleInput.length > 1 && artistInput.length > 1;
    
    const [playing, setPlaying] = useState(false);
    const audioRef = useRef(null);

    useEffect(() => {
        return () => { if (audioRef.current) audioRef.current.pause(); };
    }, []);

    const toggleAudio = () => {
        if (!audioRef.current) {
             audioRef.current = new Audio(t.src);
             audioRef.current.onended = () => setPlaying(false);
             audioRef.current.onerror = () => {
                console.error("Fout bij afspelen", t.src);
                setPlaying(false);
             };
        }
        
        if (playing) { 
            audioRef.current.pause(); 
        } else { 
            document.querySelectorAll('audio').forEach(el => el !== audioRef.current && el.pause());
            audioRef.current.play().catch(e => { console.error("Play error:", e); setPlaying(false); }); 
        }
        setPlaying(!playing);
    };

    return (
        <div className={`bg-slate-900 rounded-2xl p-5 border-2 flex flex-col gap-4 ${isComplete ? 'border-green-500/50' : 'border-slate-800'}`}>
            <div className="flex items-center gap-4 mb-2">
                <button onClick={toggleAudio} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-95 ${playing ? 'bg-pink-500 text-white animate-pulse' : 'bg-slate-800 text-pink-500 hover:bg-slate-700'}`}>
                    {playing ? <Pause size={20} fill="currentColor"/> : <Play size={20} fill="currentColor"/>}
                </button>
                <span className="font-bold text-lg text-slate-200">{t.label}</span>
            </div>
            
            <div className="flex flex-col gap-2">
               <button onClick={() => setActiveModal({ type: 'year', id: t.id, round: 2 })} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-blue-300 font-bold text-sm min-h-[3rem] flex items-center justify-center gap-2 hover:bg-slate-900 transition-colors"><Calendar size={14}/> {selectedYear || "Kies Release Jaar"}</button>
               
               {/* Titel Input Veld */}
               <div className="relative">
                  <div className="absolute left-3 top-3.5 text-yellow-400"><Disc size={14}/></div>
                  <input 
                    type="text" 
                    value={titleInput}
                    onChange={(e) => handleTitleInput(t.id, e.target.value)}
                    placeholder="Typ Titel..."
                    className="w-full bg-slate-950 p-3 pl-9 rounded-xl border border-slate-800 text-yellow-300 font-bold text-sm focus:outline-none focus:border-yellow-500 text-center"
                  />
               </div>
               
               {/* Artiest Input Veld */}
               <div className="relative">
                  <div className="absolute left-3 top-3.5 text-purple-400"><Mic2 size={14}/></div>
                  <input 
                    type="text" 
                    value={artistInput}
                    onChange={(e) => handleArtistInput(t.id, e.target.value)}
                    placeholder="Typ Artiest..."
                    className="w-full bg-slate-950 p-3 pl-9 rounded-xl border border-slate-800 text-purple-300 font-bold text-sm focus:outline-none focus:border-purple-500 text-center"
                  />
               </div>
            </div>
        </div>
    );
};

const SelectionModal = ({ isOpen, title, items, onSelect, onClose, type, connections, currentId, mode }) => {
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    return () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } };
  }, [isOpen]);

  const handleLocalPlay = async (e, item) => {
    e.stopPropagation(); 
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (playingId === item.id) { setPlayingId(null); return; }

    try {
        const audio = new Audio(item.src);
        audio.onerror = () => { console.error("Audio fout:", item.src); setPlayingId(null); };
        audioRef.current = audio;
        await audio.play();
        setPlayingId(item.id);
        audio.onended = () => { setPlayingId(null); audioRef.current = null; };
    } catch (err) { setPlayingId(null); }
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
             
             let isSelectedHere = false;
             let isUsedByOthers = false;

             if (mode === 'round1') {
                 const timesUsed = connections.filter(c => (type === 'year' ? c.year === itemId : c.trackId === itemId)).length;
                 const totalAvailable = items.filter(i => (i.id || i) === itemId).length;
                 isSelectedHere = connections.find(c => c.questionId === currentId && (type === 'year' ? c.year === itemId : c.trackId === itemId));
                 isUsedByOthers = timesUsed >= totalAvailable && !isSelectedHere;
             } else {
                 // In Round 2 only YEAR is selected via modal
                 if (type === 'year') {
                    const timesUsed = connections.filter(c => c.year === itemId).length;
                    const totalAvailable = items.filter(i => i === itemId).length;
                    isSelectedHere = connections.find(c => c.trackId === currentId && c.year === itemId);
                    isUsedByOthers = timesUsed >= totalAvailable && !isSelectedHere;
                 }
             }

             return (
              <div key={`${itemId}-${index}`} className={`flex flex-col rounded-2xl border-2 transition-all group overflow-hidden ${isSelectedHere ? 'bg-green-900/30 border-green-500' : (isUsedByOthers ? 'bg-slate-800/50 border-orange-500/30' : 'bg-slate-800 border-slate-700 hover:border-indigo-400')}`}>
                 <div className="flex items-center gap-3 p-3 min-h-[4rem]">
                   {type === 'track' && (
                       <button onClick={(e) => handleLocalPlay(e, item)} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors shrink-0 ${isPlaying ? 'bg-pink-500 text-white' : 'bg-slate-900 text-pink-500 hover:bg-pink-900/30'}`}>
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
  const [connectionsR1, setConnectionsR1] = useState(() => JSON.parse(localStorage.getItem('musicGame_connectionsR1') || '[]'));
  const [connectionsR2, setConnectionsR2] = useState(() => JSON.parse(localStorage.getItem('musicGame_connectionsR2') || '[]'));
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
  const [randomReleaseYears] = useState(() => shuffleArray(RELEASE_YEARS));

  const [activeModal, setActiveModal] = useState(null);

  // --- Theme ---
  useEffect(() => {
    document.body.style.backgroundColor = '#1e1b4b'; 
    document.body.style.color = '#fff';
    let meta = document.querySelector("meta[name='theme-color']");
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
    meta.content = '#1e1b4b'; 
  }, []);

  // --- Storage ---
  useEffect(() => { localStorage.setItem('musicGame_teamName', teamName); }, [teamName]);
  useEffect(() => { localStorage.setItem('musicGame_hasJoined', hasJoined); }, [hasJoined]);
  useEffect(() => { localStorage.setItem('musicGame_connectionsR1', JSON.stringify(connectionsR1)); }, [connectionsR1]);
  useEffect(() => { localStorage.setItem('musicGame_connectionsR2', JSON.stringify(connectionsR2)); }, [connectionsR2]);
  useEffect(() => { localStorage.setItem('musicGame_localStatus', localStatus); }, [localStatus]);
  useEffect(() => { localStorage.setItem('musicGame_isAdmin', isAdmin); }, [isAdmin]);

  // Init
  useEffect(() => {
    signInAnonymously(auth).catch(e => console.error(e));
    const unsub = onAuthStateChanged(auth, u => u && setUser(u));
    return () => unsub();
  }, []);

  // Global State Sync
  useEffect(() => {
     const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'global_game_control', 'main'), (snap) => {
        if (snap.exists()) {
           const data = snap.data();
           setGlobalStatus(data.status);
           setIsPaused(data.isPaused || false);
           
           if (data.status === 'lobby') {
               if (localStatus !== 'waiting' && localStatus !== 'login') resetLocalState();
           } else if (data.status === 'round1') {
               if (localStatus === 'waiting' && hasJoined) setLocalStatus('round1_playing');
           } else if (data.status === 'results_r1') {
               if (localStatus !== 'results_r1' && hasJoined) setLocalStatus('results_r1');
           } else if (data.status === 'round2') {
               if ((localStatus === 'results_r1' || localStatus === 'round1_finished') && hasJoined) {
                   setLocalStatus('round2_playing');
               }
           } else if (data.status === 'results_r2') {
               if (localStatus !== 'results_r2' && hasJoined) setLocalStatus('results_r2');
           } else if (data.status === 'finished') {
               if (localStatus !== 'game_over') setLocalStatus('game_over');
           }
        } else {
           setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'global_game_control', 'main'), { status: 'lobby', isPaused: false });
        }
     });
     return () => unsub();
  }, [localStatus, hasJoined]);

  // Hard Reset Listener
  useEffect(() => {
    if (!user || !hasJoined || isAdmin) return;
    const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'music_game_state', user.uid), (docSnap) => {
       if (!docSnap.exists()) {
           resetLocalState();
       }
    });
    return () => unsub();
  }, [user, hasJoined, isAdmin]);

  const resetLocalState = () => {
      setHasJoined(false); setTeamName(''); 
      setConnectionsR1([]); setConnectionsR2([]); 
      setIsReady(false); setLocalStatus('waiting'); 
      setIsAdmin(false); localStorage.clear();
  };

  // Progress Sync
  useEffect(() => {
    if (!user || !hasJoined || isAdmin) return;
    
    let progress = 0;
    if (localStatus === 'round1_playing') {
        const c = connectionsR1.filter(c => c.year && c.trackId).length;
        progress = Math.round((c / GAME_DATA.length) * 50);
    } else if (localStatus === 'round1_finished' || localStatus === 'results_r1') {
        progress = 50;
    } else if (localStatus === 'round2_playing') {
        const c = connectionsR2.filter(c => c.year && c.titleName && c.artistName).length;
        progress = 50 + Math.round((c / TRACKS.length) * 50);
    } else if (localStatus === 'round2_finished' || localStatus === 'results_r2' || localStatus === 'game_over') {
        progress = 100;
    }
    setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'music_game_state', user.uid), { 
        progress, connectionsR1, connectionsR2, currentStage: localStatus
    }, { merge: true });
  }, [connectionsR1, connectionsR2, user, hasJoined, localStatus, isAdmin]);

  // Data Listener
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'music_game_state'), (snap) => {
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setLobbyPlayers(data);
      
      const finished = data.filter(d => d.status === 'game_finished' || d.currentStage === 'game_over');
      finished.forEach(p => { 
          // R1 Score
          let r1 = 0;
          if (p.connectionsR1) {
              r1 = p.connectionsR1.reduce((acc, c) => {
                  const q = GAME_DATA.find(x => x.id === c.questionId);
                  if(!q) return acc;
                  return acc + (q.correctYear === c.year ? 1 : 0) + (q.correctTrackId === c.trackId ? 1 : 0);
              }, 0);
          }
          // R2 Score
          let r2 = 0;
          if (p.connectionsR2) {
              r2 = p.connectionsR2.reduce((acc, c) => {
                  const t = TRACKS.find(x => x.id === c.trackId);
                  if(!t) return acc;
                  
                  const artistOk = t.artist.trim().toLowerCase() === (c.artistName || "").trim().toLowerCase();
                  const titleOk = t.title.trim().toLowerCase() === (c.titleName || "").trim().toLowerCase();

                  return acc + 
                         (t.releaseYear === c.year ? 1 : 0) + 
                         (titleOk ? 1 : 0) + 
                         (artistOk ? 1 : 0);
              }, 0);
          }
          p.scoreR1 = r1;
          p.scoreR2 = r2;
          p.totalScore = r1 + r2 + (p.bonusPoints || 0);
      });
      setLeaderboard(finished.sort((a, b) => b.totalScore - a.totalScore));
    });
    return () => unsub();
  }, [user]);

   // Watch Global Results
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
    if (globalStatus === 'round1') initialStatus = 'round1_playing';
    if (globalStatus === 'round2') initialStatus = 'round2_playing';
    setLocalStatus(initialStatus);
    setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'music_game_state', user.uid), { teamName, userId: user.uid, score: 0, status: initialStatus, isReady: false, progress: 0, bonusPoints: 0, joinedAt: serverTimestamp() });
  };

  const tryAdminLogin = () => {
     if (adminPassword === "edkroket") { 
        setIsAdmin(true); setHasJoined(true); setLocalStatus('waiting'); setTeamName("Spelleider"); setShowAdminLogin(false);
     } else { alert("Fout wachtwoord"); }
  };

  const logoutAdmin = () => resetLocalState();

  const leaveGame = async () => {
    if(!confirm("Weet je het zeker?")) return;
    if(user) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'music_game_state', user.uid));
    resetLocalState();
    window.location.reload();
  };

  const submitRound1 = () => {
    setLocalStatus('round1_finished');
    setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'music_game_state', user.uid), { connectionsR1, currentStage: 'round1_finished' }, { merge: true });
  };

  const submitRound2 = () => {
    setLocalStatus('round2_finished');
    setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'music_game_state', user.uid), { connectionsR2, currentStage: 'round2_finished', status: 'game_finished' }, { merge: true });
  };

  // Admin Actions
  const startRound1 = () => setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'global_game_control', 'main'), { status: 'round1' });
  const showResultsR1 = () => setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'global_game_control', 'main'), { status: 'results_r1' });
  const startRound2 = () => setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'global_game_control', 'main'), { status: 'round2' });
  const showResultsR2 = () => setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'global_game_control', 'main'), { status: 'results_r2' });
  const showFinalScores = () => setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'global_game_control', 'main'), { status: 'finished' });
  const resetAll = async () => {
    if(!confirm("LET OP: Alles wissen?")) return;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'global_game_control', 'main'), { status: 'lobby' });
    const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'music_game_state'));
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  };

  // Selection Logic
  const handleSelection = (id, type, value, round) => {
      const setter = round === 1 ? setConnectionsR1 : setConnectionsR2;
      setter(prev => {
          let newConns = [...prev];
          const idField = round === 1 ? 'questionId' : 'trackId';
          let valField = '';
          if (type === 'year') valField = 'year';
          else if (type === 'track') valField = 'trackId';
          
          const index = newConns.findIndex(c => c[idField] === id);
          if (index >= 0) {
              newConns[index] = { ...newConns[index], [valField]: value };
          } else {
              newConns.push({ [idField]: id, [valField]: value });
          }

          return newConns.map(c => {
              if (c[idField] === id) return c;
              if (type === 'year' && c.year === value) {
                   const sourceList = round === 1 ? YEARS : RELEASE_YEARS;
                   const limit = sourceList.filter(y => y === value).length;
                   const countInNew = newConns.filter(nc => nc.year === value).length;
                   if (countInNew > limit) return { ...c, year: null };
              }
              if (type === 'track' && c[valField] === value) return { ...c, [valField]: null };
              return c;
          });
      });
  };

  const handleArtistInput = (trackId, artistName) => {
      setConnectionsR2(prev => {
          let newConns = [...prev];
          const index = newConns.findIndex(c => c.trackId === trackId);
          if (index >= 0) {
              newConns[index] = { ...newConns[index], artistName };
          } else {
              newConns.push({ trackId, artistName });
          }
          return newConns;
      });
  };

  const handleTitleInput = (trackId, titleName) => {
      setConnectionsR2(prev => {
          let newConns = [...prev];
          const index = newConns.findIndex(c => c.trackId === trackId);
          if (index >= 0) {
              newConns[index] = { ...newConns[index], titleName };
          } else {
              newConns.push({ trackId, titleName });
          }
          return newConns;
      });
  };

  // --- RENDER ---

  if (!hasJoined) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-indigo-950 to-purple-950 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl max-w-md w-full border border-white/10 z-10">
          <h1 className="text-3xl font-black bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent text-center mb-6">Muziek Connectie</h1>
          <div className="space-y-4">
            <input type="text" value={teamName} onChange={e => setTeamName(e.target.value)} className="w-full bg-slate-800/50 border border-slate-600 focus:border-pink-500 rounded-xl p-4 text-white" placeholder="Team Naam" />
            <button onClick={joinLobby} disabled={!teamName} className="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold py-4 rounded-xl disabled:opacity-50">🚀 Stap in</button>
          </div>
        </div>
        <button onClick={() => setShowAdminLogin(true)} className="absolute bottom-6 right-6 text-slate-500 p-3"><Lock size={18}/></button>
        {showAdminLogin && (
           <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
              <div className="bg-slate-900 p-6 rounded-2xl w-full max-w-sm">
                 <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} className="w-full bg-slate-800 p-3 text-white mb-4 rounded" placeholder="Wachtwoord" />
                 <button onClick={tryAdminLogin} className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl">Inloggen</button>
                 <button onClick={() => setShowAdminLogin(false)} className="mt-2 text-slate-400 w-full text-center">Annuleren</button>
              </div>
           </div>
        )}
      </div>
    );
  }

  const Header = ({ title }) => (
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-white/5 p-4 flex justify-between items-center shadow-lg h-20">
         <div><div className="text-[10px] uppercase text-slate-500 font-bold">Team {teamName}</div><div className="text-sm font-bold text-white">{title}</div></div>
         <button onClick={leaveGame} className="text-slate-500 hover:text-red-400 p-2"><LogOut size={20}/></button>
      </header>
  );

  if (isAdmin && showAdminDashboard) {
      return (
        <div className="fixed inset-0 bg-slate-950 z-[100] p-4 overflow-y-auto">
           <div className="max-w-4xl mx-auto flex flex-col gap-6">
              <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                 <h2 className="text-xl font-bold text-white flex gap-2"><BarChart3/> Admin</h2>
                 <div className="flex gap-2">
                    <button onClick={logoutAdmin} className="bg-red-500/10 p-2 text-red-500 rounded"><LogOut/></button>
                    <button onClick={() => setShowAdminDashboard(false)}><X size={24} className="text-white"/></button>
                 </div>
              </div>
              
              <div className="grid grid-cols-1 gap-2">
                 <div className="grid grid-cols-2 gap-2">
                    <button onClick={startRound1} className="bg-blue-600 text-white p-4 rounded-xl font-bold">1. Start R1</button>
                    <button onClick={showResultsR1} className="bg-blue-500/50 text-white p-4 rounded-xl font-bold">Uitslag R1</button>
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                    <button onClick={startRound2} className="bg-purple-600 text-white p-4 rounded-xl font-bold">2. Start R2</button>
                    <button onClick={showResultsR2} className="bg-purple-500/50 text-white p-4 rounded-xl font-bold">Uitslag R2</button>
                 </div>
                 <button onClick={showFinalScores} className="bg-green-600 text-white p-4 rounded-xl font-bold">3. Eindstand</button>
                 <button onClick={resetAll} className="bg-red-900/50 text-red-200 p-4 rounded-xl font-bold border border-red-500/20 mt-4">⚠️ HARDE RESET</button>
              </div>

              <div className="bg-slate-900 p-4 rounded-xl">
                 <h3 className="text-slate-400 mb-2">Spelers Status</h3>
                 {lobbyPlayers.filter(p => p.teamName !== "Spelleider").map(p => (
                    <div key={p.id} className="flex justify-between p-2 border-b border-slate-800">
                       <span className="text-white">{p.teamName}</span>
                       <span className="text-slate-400 text-sm">
                           {p.currentStage?.replace('round1_', 'R1 ').replace('round2_', 'R2 ').replace('finished', 'Klaar')} ({p.progress}%)
                       </span>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      );
  }

  if (localStatus === 'waiting') {
    return (
      <div className="min-h-screen w-full bg-slate-950 text-slate-100 p-4">
        <Header title="Lobby" />
        <div className="max-w-xl mx-auto mt-10 text-center">
            <h2 className="text-3xl font-bold mb-4">Wachtruimte</h2>
            <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
                <h3 className="text-slate-500 uppercase text-xs font-bold mb-4">Teams</h3>
                {lobbyPlayers.filter(p => p.teamName !== "Spelleider").map(p => (
                    <div key={p.id} className="py-2 border-b border-slate-800 text-white">{p.teamName}</div>
                ))}
            </div>
            {isAdmin && <button onClick={() => setShowAdminDashboard(true)} className="fixed bottom-6 right-6 bg-purple-600 text-white p-4 rounded-full shadow-xl"><BarChart3 /></button>}
        </div>
      </div>
    );
  }

  // --- ROUND 1 ---
  if (localStatus === 'round1_playing') {
      const isFull = connectionsR1.length >= GAME_DATA.length && connectionsR1.every(c => c.year && c.trackId);
      return (
        <div className="min-h-screen w-full bg-slate-950 text-slate-100 pb-32">
          <Header title="Ronde 1: Vragen" />
          <main className="max-w-6xl mx-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
             {randomQuestions.map((q) => {
                 const myConn = connectionsR1.find(c => c.questionId === q.id);
                 const selectedYear = myConn?.year;
                 const selectedTrackId = myConn?.trackId;
                 const selectedTrack = TRACKS.find(t => t.id === selectedTrackId);
                 const isComplete = selectedYear && selectedTrackId;
                 
                 return (
                    <div key={q.id} className={`bg-slate-900 rounded-2xl p-5 border-2 flex flex-col gap-4 ${isComplete ? 'border-green-500/50' : 'border-slate-800'}`}>
                        <p className="font-bold text-slate-200">{q.question}</p>
                        <div className="grid grid-cols-2 gap-3 mt-auto">
                           <button onClick={() => setActiveModal({ type: 'year', id: q.id, round: 1 })} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-blue-300 font-bold min-h-[4rem]">{selectedYear || "Jaar?"}</button>
                           <button onClick={() => setActiveModal({ type: 'track', id: q.id, round: 1 })} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-pink-300 font-bold min-h-[4rem]">{selectedTrack ? selectedTrack.label : "Track?"}</button>
                        </div>
                    </div>
                 );
             })}
          </main>
          <div className="fixed bottom-6 left-0 right-0 flex justify-center">
             <button onClick={submitRound1} disabled={!isFull} className={`px-8 py-4 rounded-full font-bold shadow-xl ${isFull ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-500'}`}>Klaar met Ronde 1</button>
          </div>
          <SelectionModal isOpen={!!activeModal} title={activeModal?.type === 'year' ? "Kies Jaar" : "Kies Track"} type={activeModal?.type} items={activeModal?.type === 'year' ? randomYears : randomTracks} onSelect={(val) => handleSelection(activeModal.id, activeModal.type, val, 1)} onClose={() => setActiveModal(null)} connections={connectionsR1} currentId={activeModal?.id} mode="round1" />
          {isAdmin && <button onClick={() => setShowAdminDashboard(true)} className="fixed bottom-6 right-6 bg-purple-600 text-white p-4 rounded-full shadow-xl"><BarChart3 /></button>}
        </div>
      );
  }

  // --- RESULTS R1 ---
  if (localStatus === 'round1_finished' || localStatus === 'results_r1') {
      const isWaiting = localStatus === 'round1_finished';
      const myScore = connectionsR1.reduce((acc, c) => {
          const q = GAME_DATA.find(x => x.id === c.questionId);
          if(!q) return acc;
          return acc + (q.correctYear === c.year ? 1 : 0) + (q.correctTrackId === c.trackId ? 1 : 0);
      }, 0);

      const r1Leaderboard = [...leaderboard].sort((a,b) => b.scoreR1 - a.scoreR1);

      return (
        <div className="min-h-screen w-full bg-slate-950 text-slate-100 p-4 pb-24 font-sans overflow-y-auto">
            <div className="max-w-3xl mx-auto mt-8">
                {isWaiting ? (
                   <div className="text-center py-10">
                      <CheckCircle size={64} className="text-green-500 mx-auto mb-4"/>
                      <h2 className="text-2xl font-bold">Ronde 1 Ingediend!</h2>
                      <p className="text-slate-400">Wachten op de uitslag...</p>
                   </div>
                ) : (
                   <div className="animate-fade-in">
                      <div className="bg-gradient-to-br from-blue-900 to-indigo-900 p-8 rounded-3xl border border-blue-700 text-center mb-6 shadow-2xl relative overflow-hidden">
                          <h2 className="text-xl font-bold text-blue-200 mb-2 uppercase tracking-widest">Uitslag Ronde 1</h2>
                          <div className="text-5xl font-black text-white">{myScore} <span className="text-lg font-normal text-blue-300">/ 16</span></div>
                          <div className="text-blue-300 font-medium mt-1">punten</div>
                      </div>

                      <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl mb-8">
                          <h3 className="text-xl font-bold text-yellow-500 mb-4 flex gap-2"><Trophy/> Ranglijst R1</h3>
                          <div className="space-y-3">
                             {r1Leaderboard.map((p, i) => (
                                <div key={p.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                                   <div className="flex gap-3"><span className="font-bold text-slate-500 w-6">{i+1}</span> <span className="text-white font-bold">{p.teamName}</span></div>
                                   <span className="font-black text-yellow-500">{p.scoreR1}</span>
                                </div>
                             ))}
                          </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-lg font-bold text-slate-400 text-center">De Juiste Antwoorden</h3>
                        {GAME_DATA.map((q, i) => {
                            const conn = connectionsR1.find(c => c.questionId === q.id) || {};
                            const yearOk = conn.year === q.correctYear;
                            const trackOk = conn.trackId === q.correctTrackId;
                            // const correctTrack = TRACKS.find(t => t.id === q.correctTrackId); // HIER WEGGEHAALD OM SPOILER TE VOORKOMEN
                            const myTrack = TRACKS.find(t => t.id === conn.trackId);
                            
                            return (
                                <div key={q.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                    <div className="text-slate-400 text-xs mb-1">Vraag {i + 1}</div>
                                    <div className="font-bold text-white mb-3 text-sm">{q.question}</div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className={`p-2 rounded ${yearOk ? 'bg-green-900/30 text-green-300 border border-green-500/30' : 'bg-red-900/30 text-red-300 border border-red-500/30'}`}>
                                            <div className="opacity-70 uppercase text-[10px]">Jouw Jaar</div>
                                            <div className="font-bold text-base">{conn.year || '-'}</div>
                                            {!yearOk && <div className="mt-1 pt-1 border-t border-white/10 text-slate-400">Correct: {q.correctYear}</div>}
                                        </div>
                                        <div className={`p-2 rounded ${trackOk ? 'bg-green-900/30 text-green-300 border border-green-500/30' : 'bg-red-900/30 text-red-300 border border-red-500/30'}`}>
                                            <div className="opacity-70 uppercase text-[10px]">Jouw Track</div>
                                            <div className="font-bold">{myTrack ? myTrack.label : '-'}</div>
                                            {/* Correcte Track ID wordt hier getoond, maar NIET de titel */}
                                            {!trackOk && <div className="mt-1 pt-1 border-t border-white/10 text-slate-400">Correct: Track {q.correctTrackId.replace('t','')}</div>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                      </div>
                   </div>
                )}
            </div>
            {isAdmin && <button onClick={() => setShowAdminDashboard(true)} className="fixed bottom-6 right-6 bg-purple-600 text-white p-4 rounded-full shadow-xl"><BarChart3 /></button>}
        </div>
      );
  }

  // --- ROUND 2 ---
  if (localStatus === 'round2_playing') {
      const isFull = connectionsR2.length >= TRACKS.length && connectionsR2.every(c => c.year && c.titleName && c.titleName.trim().length > 0 && c.artistName && c.artistName.trim().length > 0);
      return (
        <div className="min-h-screen w-full bg-slate-950 text-slate-100 pb-32">
          <Header title="Ronde 2: Tracks" />
          <main className="max-w-6xl mx-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
             {randomTracks.map((t) => (
                <Round2Card key={t.id} t={t} connectionsR2={connectionsR2} setActiveModal={setActiveModal} handleArtistInput={handleArtistInput} handleTitleInput={handleTitleInput} allTracks={TRACKS} />
             ))}
          </main>
          <div className="fixed bottom-6 left-0 right-0 flex justify-center">
             <button onClick={submitRound2} disabled={!isFull} className={`px-8 py-4 rounded-full font-bold shadow-xl ${isFull ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-500'}`}>Klaar met Ronde 2</button>
          </div>
          
          <SelectionModal 
            isOpen={!!activeModal} 
            title={activeModal?.type === 'year' ? "Kies Jaar" : "Kies Titel"} 
            type={activeModal?.type} 
            items={activeModal?.type === 'year' ? randomReleaseYears : []} // Only Release Years use modal in R2
            onSelect={(val) => handleSelection(activeModal.id, activeModal.type, val, 2)} 
            onClose={() => setActiveModal(null)} 
            connections={connectionsR2} 
            currentId={activeModal?.id} 
            mode="round2" 
          />
          
          {isAdmin && <button onClick={() => setShowAdminDashboard(true)} className="fixed bottom-6 right-6 bg-purple-600 text-white p-4 rounded-full shadow-xl"><BarChart3 /></button>}
        </div>
      );
  }

  // --- RESULTS R2 / FINAL ---
  if (localStatus === 'round2_finished' || localStatus === 'results_r2' || localStatus === 'game_over') {
    const isWaiting = localStatus === 'round2_finished';
    const isFinal = localStatus === 'game_over';
    
    const myR2Score = connectionsR2.reduce((acc, c) => {
       const t = TRACKS.find(x => x.id === c.trackId);
       if(!t) return acc;
       const artistOk = t.artist.trim().toLowerCase() === (c.artistName || "").trim().toLowerCase();
       const titleOk = t.title.trim().toLowerCase() === (c.titleName || "").trim().toLowerCase();
       return acc + (t.releaseYear === c.year ? 1 : 0) + (titleOk ? 1 : 0) + (artistOk ? 1 : 0);
    }, 0);
    
    const currentLeaderboard = [...leaderboard].sort((a,b) => isFinal ? (b.totalScore - a.totalScore) : (b.scoreR2 - a.scoreR2));

    return (
        <div className="min-h-screen w-full bg-slate-950 text-slate-100 p-4 pb-24 font-sans overflow-y-auto">
            <div className="max-w-3xl mx-auto mt-8">
                {isWaiting ? (
                   <div className="text-center py-10">
                      <CheckCircle size={64} className="text-green-500 mx-auto mb-4"/>
                      <h2 className="text-2xl font-bold">Ronde 2 Ingediend!</h2>
                      <p className="text-slate-400">Wachten op de uitslag...</p>
                   </div>
                ) : (
                   <div className="animate-fade-in">
                      {isFinal ? (
                          <div className="bg-gradient-to-br from-yellow-600 to-orange-700 p-8 rounded-3xl border border-yellow-500 text-center mb-6 shadow-2xl relative overflow-hidden">
                              <h2 className="text-xl font-bold text-yellow-100 mb-2 uppercase tracking-widest">Eindstand</h2>
                              <div className="text-6xl font-black text-white">{user && lobbyPlayers.find(p=>p.userId===user.uid)?.totalScore} <span className="text-lg font-normal text-yellow-200">punten</span></div>
                          </div>
                      ) : (
                          <div className="bg-gradient-to-br from-purple-900 to-pink-900 p-8 rounded-3xl border border-purple-700 text-center mb-6 shadow-2xl">
                              <h2 className="text-xl font-bold text-purple-200 mb-2 uppercase tracking-widest">Uitslag Ronde 2</h2>
                              <div className="text-5xl font-black text-white">{myR2Score} <span className="text-lg font-normal text-purple-300">/ 24</span></div>
                          </div>
                      )}

                      <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl mb-8">
                          <h3 className="text-xl font-bold text-yellow-500 mb-4 flex gap-2"><Trophy/> {isFinal ? "Eindklassement" : "Ranglijst R2"}</h3>
                          <div className="space-y-3">
                             {currentLeaderboard.map((p, i) => (
                                <div key={p.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                                   <div className="flex gap-3"><span className="font-bold text-slate-500 w-6">{i+1}</span> <span className="text-white font-bold">{p.teamName}</span></div>
                                   <span className="font-black text-yellow-500">{isFinal ? p.totalScore : p.scoreR2}</span>
                                </div>
                             ))}
                          </div>
                      </div>

                      {!isFinal && (
                          <div className="space-y-4">
                            <h3 className="text-lg font-bold text-slate-400 text-center">Antwoorden Ronde 2</h3>
                            {TRACKS.map((t, i) => {
                                const conn = connectionsR2.find(c => c.trackId === t.id) || {};
                                const yearOk = conn.year === t.releaseYear;
                                const titleOk = t.title.trim().toLowerCase() === (conn.titleName || "").trim().toLowerCase();
                                const artistOk = t.artist.trim().toLowerCase() === (conn.artistName || "").trim().toLowerCase();
                                
                                return (
                                    <div key={t.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                        <div className="font-bold text-white mb-3 text-sm flex items-center gap-2"><Music size={14} className="text-pink-500"/> {t.label}</div>
                                        <div className="grid grid-cols-3 gap-2 text-xs">
                                            <div className={`p-2 rounded ${yearOk ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
                                                <div className="opacity-70 uppercase text-[9px]">Jaar</div>
                                                <div className="font-bold">{conn.year || '-'}</div>
                                                {!yearOk && <div className="text-[9px] mt-1 text-slate-400">({t.releaseYear})</div>}
                                            </div>
                                            <div className={`p-2 rounded ${titleOk ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
                                                <div className="opacity-70 uppercase text-[9px]">Titel</div>
                                                <div className="font-bold truncate">{conn.titleName || '-'}</div>
                                                {!titleOk && <div className="text-[9px] mt-1 text-slate-400 truncate">({t.title})</div>}
                                            </div>
                                            <div className={`p-2 rounded ${artistOk ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
                                                <div className="opacity-70 uppercase text-[9px]">Artiest</div>
                                                <div className="font-bold truncate">{conn.artistName || '-'}</div>
                                                {!artistOk && <div className="text-[9px] mt-1 text-slate-400 truncate">({t.artist})</div>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                          </div>
                      )}
                   </div>
                )}
            </div>
            {isAdmin && <button onClick={() => setShowAdminDashboard(true)} className="fixed bottom-6 right-6 bg-purple-600 text-white p-4 rounded-full shadow-xl"><BarChart3 /></button>}
        </div>
     );
  }

  return <div>Loading...</div>;
}

export default function App() { return <ErrorBoundary><GameContent /></ErrorBoundary>; }