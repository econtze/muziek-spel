import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Play, Pause, Music, HelpCircle, Calendar, RefreshCcw, CheckCircle, Users, Trophy, Loader2, Rocket, Clock, AlertTriangle, Lock, Trash2, PlayCircle } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, updateDoc, onSnapshot, serverTimestamp, getDocs, deleteDoc } from 'firebase/firestore';

// --- Firebase Setup ---

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

// --- Game Constants ---
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

export default function App() {
  // --- Auth & User State ---
  const [user, setUser] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [isReady, setIsReady] = useState(false); 
  const [authError, setAuthError] = useState(null);
  
  // --- Admin State ---
  const [isAdmin, setIsAdmin] = useState(false);
  
  // --- Game State ---
  const [globalStatus, setGlobalStatus] = useState('lobby'); // 'lobby' of 'playing'
  const [connections, setConnections] = useState([]); 
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);
  const [localStatus, setLocalStatus] = useState('waiting'); // 'waiting' (in lobby), 'playing', 'finished'
  
  // --- Multiplayer State ---
  const [leaderboard, setLeaderboard] = useState([]);
  const [lobbyPlayers, setLobbyPlayers] = useState([]);
  const [activeTab, setActiveTab] = useState('game'); 

  // --- Refs ---
  const containerRef = useRef(null);
  const itemRefs = useRef({});
  const setItemRef = (id, el) => { itemRefs.current[id] = el; };

  // --- Initialization ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Firebase Auth Error:", err);
        setAuthError(err.message);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setAuthError(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Global State Listener ---
  useEffect(() => {
     const globalDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'global_game_control', 'main');
     
     const unsubscribe = onSnapshot(globalDocRef, (docSnap) => {
        if (docSnap.exists()) {
           const data = docSnap.data();
           setGlobalStatus(data.status); 
           
           if (data.status === 'playing' && localStatus === 'waiting' && hasJoined) {
              setLocalStatus('playing');
           }
           if (data.status === 'lobby' && localStatus !== 'waiting') {
              setLocalStatus('waiting');
              setConnections([]);
              setIsReady(false);
           }
        } else {
           setDoc(globalDocRef, { status: 'lobby' });
        }
     });
     return () => unsubscribe();
  }, [localStatus, hasJoined]);


  // --- Players & Scores Listener ---
  useEffect(() => {
    if (!user) return;
    
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'music_game_state');
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allData = [];
      snapshot.forEach((doc) => {
        allData.push({ id: doc.id, ...doc.data() });
      });

      setLobbyPlayers(allData);

      const finished = allData.filter(d => d.status === 'finished');
      finished.sort((a, b) => {
         if (b.score !== a.score) return b.score - a.score;
         const timeA = a.timestamp?.seconds || 0;
         const timeB = b.timestamp?.seconds || 0;
         return timeA - timeB;
      });

      let fastestId = null;
      if (finished.length > 0) {
        const sortedByTime = [...finished].sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
        fastestId = sortedByTime[0].id;
      }

      const finalLeaderboard = finished.map(entry => ({
        ...entry,
        isFastest: entry.id === fastestId
      }));

      setLeaderboard(finalLeaderboard);

    }, (error) => {
      console.error("Firestore Error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // --- Actions ---

  const joinLobby = async () => {
    if (!teamName || !user) return;
    setHasJoined(true);
    setLocalStatus('waiting');
    
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'music_game_state', user.uid), {
        teamName: teamName,
        userId: user.uid,
        score: 0,
        progress: 0,
        status: 'lobby',
        isReady: false,
        joinedAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Error joining", e);
    }
  };

  const toggleReady = async () => {
     if (!user) return;
     const newReadyState = !isReady;
     setIsReady(newReadyState);
     // Gebruik setDoc met merge ipv updateDoc, voor het geval de admin meespeelt zonder DB entry
     await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'music_game_state', user.uid), {
        isReady: newReadyState
     }, { merge: true });
  };

  // --- Admin Actions ---

  const handleAdminLogin = () => {
     const password = prompt("Voer admin wachtwoord in:");
     if (password === "edkroket") { 
        setIsAdmin(true);
        // Direct doorgaan naar lobby, ook zonder naam
        setHasJoined(true);
        setLocalStatus('waiting');
        if (!teamName) setTeamName("Spelleider"); // Fallback naam voor UI
     } else {
        alert("Fout wachtwoord");
     }
  };

  const startGlobalGame = async () => {
     await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'global_game_control', 'main'), {
        status: 'playing',
        startedAt: serverTimestamp()
     });
  };

  const resetGameData = async () => {
     if(!confirm("LET OP: Dit wist ALLE spelers en scores en zet het spel terug naar de lobby. Weet je het zeker?")) return;
     
     // 1. Zet status op lobby
     await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'global_game_control', 'main'), {
        status: 'lobby'
     });

     // 2. Verwijder alle spelers uit de DB
     try {
        const querySnapshot = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'music_game_state'));
        const deletePromises = querySnapshot.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletePromises);
        alert("Spel is gereset! Iedereen moet opnieuw inloggen.");
     } catch (e) {
        console.error("Fout bij resetten:", e);
        alert("Er ging iets mis bij het resetten.");
     }
  };

  // --- Game Logic Actions ---
  const handleQuestionClick = (qId) => {
    if (localStatus !== 'playing') return;
    setSelectedQuestionId(qId);
    if (!connections.find(c => c.questionId === qId)) {
      setConnections([...connections, { questionId: qId, year: null, trackId: null }]);
    }
  };

  const handleYearClick = (year) => {
    if (!selectedQuestionId || localStatus !== 'playing') return;
    setConnections(prev => prev.map(c => 
      c.questionId === selectedQuestionId ? { ...c, year: year } : c
    ));
  };

  const handleTrackClick = (trackId) => {
    if (!selectedQuestionId || localStatus !== 'playing') return;
    setConnections(prev => prev.map(c => 
      c.questionId === selectedQuestionId ? { ...c, trackId: trackId } : c
    ));
  };

  const isGameComplete = () => {
    if (connections.length < GAME_DATA.length) return false;
    return connections.every(c => c.year !== null && c.trackId !== null);
  };

  const submitScore = async () => {
    if (!user || localStatus === 'finished') return;
    if (!isGameComplete()) return; 
    
    let baseScore = 0;
    connections.forEach(conn => {
      const question = GAME_DATA.find(q => q.id === conn.questionId);
      if (question.correctYear === conn.year) baseScore++;
      if (question.correctTrackId === conn.trackId) baseScore++;
    });
    
    setLocalStatus('finished');
    setActiveTab('scores'); 

    try {
      // Gebruik setDoc met merge voor robuustheid (voor het geval admin meespeelt)
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'music_game_state', user.uid), {
        score: baseScore,
        status: 'finished',
        progress: 100,
        timestamp: serverTimestamp(),
        // Zorg dat teamnaam ook wordt opgeslagen als die nog niet bestond
        teamName: teamName || "Spelleider", 
        userId: user.uid
      }, { merge: true });
    } catch (e) {
      console.error("Error submitting score", e);
    }
  };

  // --- SVG Lines ---
  const [lines, setLines] = useState([]);
  const getColorForId = (id) => {
    const colors = { 'q1': '#EF4444', 'q2': '#3B82F6', 'q3': '#10B981', 'q4': '#F59E0B' };
    return colors[id] || '#6B7280';
  };

  useLayoutEffect(() => {
    const updateLines = () => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newLines = [];

      connections.forEach(conn => {
        const qEl = itemRefs.current[`q-${conn.questionId}`];
        if (!qEl) return;
        const qRect = qEl.getBoundingClientRect();

        if (conn.year) {
          const yEl = itemRefs.current[`y-${conn.year}`];
          if (yEl) {
            const yRect = yEl.getBoundingClientRect();
            newLines.push({
              id: `line-${conn.questionId}-year`,
              x1: qRect.left + qRect.width / 2 - containerRect.left,
              y1: qRect.top - containerRect.top, 
              x2: yRect.left + yRect.width / 2 - containerRect.left,
              y2: yRect.bottom - containerRect.top,
              color: getColorForId(conn.questionId),
              isCorrect: localStatus === 'finished' ? (GAME_DATA.find(q => q.id === conn.questionId).correctYear === conn.year) : null
            });
          }
        }
        if (conn.trackId) {
          const tEl = itemRefs.current[`t-${conn.trackId}`];
          if (tEl) {
            const tRect = tEl.getBoundingClientRect();
            newLines.push({
              id: `line-${conn.questionId}-track`,
              x1: qRect.left + qRect.width / 2 - containerRect.left,
              y1: qRect.bottom - containerRect.top,
              x2: tRect.left + tRect.width / 2 - containerRect.left,
              y2: tRect.top - containerRect.top,
              color: getColorForId(conn.questionId),
              isCorrect: localStatus === 'finished' ? (GAME_DATA.find(q => q.id === conn.questionId).correctTrackId === conn.trackId) : null
            });
          }
        }
      });
      setLines(newLines);
    };
    updateLines();
    window.addEventListener('resize', updateLines);
    const t = setTimeout(updateLines, 500);
    return () => { window.removeEventListener('resize', updateLines); clearTimeout(t); };
  }, [connections, localStatus, activeTab, hasJoined]);


  // --- RENDER ---

  // ERROR SCHERM
  if (authError) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="bg-red-900/20 border border-red-500/50 p-8 rounded-2xl shadow-2xl max-w-md w-full">
           <h2 className="text-xl font-bold text-red-500 mb-2">Configuratie Fout</h2>
           <p className="text-slate-300 text-sm">Zet 'Anonymous' auth aan in Firebase Console.</p>
        </div>
      </div>
    );
  }

  // LOGIN SCHERM
  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 relative">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full border border-slate-700">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-500 mb-6 text-center">
            Muziek Connectie
          </h1>
          <div className="space-y-4">
            <input 
              type="text" 
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-pink-500 outline-none"
              placeholder="Team Naam"
            />
            <button 
              onClick={joinLobby}
              disabled={!teamName || !user}
              className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50"
            >
              Ga naar Lobby
            </button>
          </div>
        </div>
        
        {/* Admin Login Button */}
        <button 
          onClick={handleAdminLogin}
          className="absolute bottom-4 right-4 text-slate-600 hover:text-slate-400 p-2"
        >
          <Lock size={16} />
        </button>
      </div>
    );
  }

  // LOBBY SCHERM
  if (localStatus === 'waiting') {
     return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-4 font-sans pb-24">
           <div className="max-w-2xl mx-auto mt-10">
              <header className="text-center mb-10">
                 <h2 className="text-3xl font-bold text-white mb-2">Wachtruimte</h2>
                 <p className="text-slate-400">Wacht tot iedereen er is...</p>
              </header>

              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl mb-8">
                 <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Users className="text-pink-500"/> Aanwezige Teams ({lobbyPlayers.length})
                 </h3>
                 <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                    {lobbyPlayers.map(p => (
                       <div key={p.id} className="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-slate-800">
                          <span className="font-medium text-slate-200">{p.teamName}</span>
                          {p.isReady ? (
                             <span className="flex items-center gap-1 text-green-400 text-sm font-bold bg-green-900/20 px-2 py-1 rounded">
                                <CheckCircle size={14}/> Klaar
                             </span>
                          ) : (
                             <span className="text-slate-500 text-sm italic">Wachten...</span>
                          )}
                       </div>
                    ))}
                 </div>
              </div>

              <div className="flex flex-col gap-4">
                 <button 
                    onClick={toggleReady}
                    className={`
                       w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2
                       ${isReady 
                          ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/30' 
                          : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}
                    `}
                 >
                    {isReady ? 'Je bent klaar! (Klik om te annuleren)' : 'Klik hier als je klaar bent!'}
                 </button>
                 
                 <p className="text-center text-slate-500 text-sm mt-4 animate-pulse">
                    Wachten op de spelleider om te starten...
                 </p>
              </div>
           </div>
           
           {/* Admin Panel Inline */}
           {isAdmin && (
              <div className="fixed bottom-4 left-4 right-4 bg-slate-800 border-2 border-purple-500 p-4 rounded-xl shadow-2xl z-50 flex flex-col sm:flex-row justify-between items-center gap-4 animate-slide-up">
                 <div className="flex items-center gap-2">
                    <Lock className="text-purple-500" size={20} />
                    <span className="font-bold text-white">Admin Paneel</span>
                 </div>
                 <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                       onClick={startGlobalGame}
                       className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold"
                    >
                       <PlayCircle size={18} /> Start Game
                    </button>
                    <button 
                       onClick={resetGameData}
                       className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold"
                    >
                       <Trash2 size={18} /> Reset Alles
                    </button>
                 </div>
              </div>
           )}
        </div>
     );
  }

  // GAME SCHERM
  const canSubmit = isGameComplete();
  const currentScore = connections.reduce((acc, conn) => {
      const q = GAME_DATA.find(x => x.id === conn.questionId);
      if(!q) return acc;
      let s = 0;
      if(q.correctYear === conn.year) s++;
      if(q.correctTrackId === conn.trackId) s++;
      return acc + s;
  }, 0);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-24"> 
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-700 p-4 shadow-lg">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div>
            <div className="text-xs text-slate-400 font-mono">TEAM: {teamName}</div>
            <h2 className="text-lg font-bold text-white">Muziek Connectie</h2>
          </div>
          
          {localStatus === 'playing' && (
            <button 
              onClick={submitScore}
              disabled={!canSubmit}
              className={`
                px-4 py-2 rounded-full font-bold text-sm shadow-lg flex items-center gap-2 transition-all
                ${canSubmit 
                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-900/20' 
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'}
              `}
            >
              <CheckCircle size={16} />
              <span className="hidden sm:inline">Check & Finish</span>
              <span className="sm:hidden">Finish</span>
            </button>
          )}
          {localStatus === 'finished' && (
            <div className="text-green-400 font-bold text-xl">
              Score: {currentScore}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto p-4">
        
        {/* SCORES TAB */}
        {activeTab === 'scores' && (
          <div className="animate-fade-in space-y-8">
             
             {/* Finished Section */}
             <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl">
                <div className="flex justify-between items-start mb-6">
                   <h3 className="text-xl font-bold flex items-center gap-2 text-yellow-500">
                     <Trophy /> Ranglijst
                   </h3>
                </div>

                <div className="space-y-3">
                  {leaderboard.map((entry, idx) => {
                     const totalScore = entry.score + (entry.isFastest ? 1 : 0);
                     return (
                      <div key={entry.id} className={`relative flex justify-between items-center p-4 rounded-lg border ${entry.teamName === teamName ? 'bg-purple-900/30 border-purple-500' : 'bg-slate-900 border-slate-800'}`}>
                         <div className="flex items-center gap-4">
                            <span className={`font-mono font-bold text-xl w-8 h-8 flex items-center justify-center rounded-full ${idx === 0 ? 'bg-yellow-500 text-slate-900' : 'text-slate-500'}`}>
                              {idx + 1}
                            </span>
                            <div>
                               <span className="font-bold text-lg block">{entry.teamName}</span>
                               {entry.isFastest && (
                                 <span className="text-xs text-yellow-400 flex items-center gap-1 font-mono uppercase tracking-wider">
                                   <Rocket size={12} /> Snelste (+1 punt)
                                 </span>
                               )}
                            </div>
                         </div>
                         <div className="text-right">
                           <span className="text-2xl font-bold text-purple-400 block">{totalScore} pnt</span>
                           {entry.timestamp && (
                             <span className="text-xs text-slate-500 flex items-center justify-end gap-1">
                               <Clock size={10} />
                               {new Date(entry.timestamp.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                             </span>
                           )}
                         </div>
                      </div>
                     );
                  })}
                  {leaderboard.length === 0 && (
                    <p className="text-slate-500 text-center py-4 italic">Nog geen teams klaar...</p>
                  )}
                </div>
             </div>
          </div>
        )}

        {/* GAME TAB */}
        {activeTab === 'game' && (
          <div ref={containerRef} className="relative min-h-[80vh]">
            
            {/* SVG Overlay */}
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-10 overflow-visible">
              {lines.map((line) => (
                <line
                  key={line.id}
                  x1={line.x1} y1={line.y1}
                  x2={line.x2} y2={line.y2}
                  stroke={line.isCorrect === false ? '#ef4444' : (line.isCorrect === true ? '#22c55e' : line.color)}
                  strokeWidth={line.isCorrect !== null ? 4 : 3}
                  strokeDasharray={line.isCorrect === false ? "5,5" : "0"}
                  className="transition-all duration-300 ease-in-out opacity-80"
                />
              ))}
            </svg>

            {/* Layout Grid */}
            <div className="flex flex-col md:grid md:grid-rows-[auto_1fr_auto] gap-8 md:gap-16">
              
              {/* Row 1: Years */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 z-20 order-1 md:order-1">
                {YEARS.map(year => (
                  <button
                    key={year}
                    ref={el => setItemRef(`y-${year}`, el)}
                    onClick={() => handleYearClick(year)}
                    disabled={!selectedQuestionId || localStatus === 'finished'}
                    className={`
                      p-4 rounded-lg text-center transition-all border-2
                      ${selectedQuestionId && localStatus !== 'finished' ? 'cursor-pointer active:scale-95' : ''}
                      ${localStatus === 'finished' 
                        ? 'bg-slate-800 border-slate-600 text-slate-400' 
                        : 'bg-slate-800 border-indigo-500/30 text-indigo-300'}
                    `}
                  >
                    <span className="text-xl font-bold">{year}</span>
                  </button>
                ))}
              </div>

              {/* Row 2: Questions */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 z-20 order-2 md:order-2">
                {GAME_DATA.map(q => {
                   const isSelected = selectedQuestionId === q.id;
                   const myColor = getColorForId(q.id);
                   const isFullyConnected = connections.find(c => c.questionId === q.id && c.year && c.trackId);
                   
                   return (
                    <button
                      key={q.id}
                      ref={el => setItemRef(`q-${q.id}`, el)}
                      onClick={() => handleQuestionClick(q.id)}
                      style={{
                         borderColor: isSelected ? myColor : 'transparent',
                         backgroundColor: isSelected ? 'rgba(30, 41, 59, 1)' : 'rgba(30, 41, 59, 0.6)'
                      }}
                      className={`
                        min-h-[80px] md:min-h-[120px] p-4 rounded-xl text-center border-2 transition-all
                        flex md:flex-col items-center justify-between md:justify-center gap-4 relative shadow-lg
                        ${isSelected ? 'ring-2 ring-offset-2 ring-offset-slate-900 z-30' : 'border-slate-600'}
                      `}
                    >
                      <div className="w-8 h-8 rounded-full flex shrink-0 items-center justify-center text-white font-bold" style={{ backgroundColor: myColor }}>?</div>
                      <p className="text-sm font-medium text-slate-200 text-left md:text-center flex-grow">{q.question}</p>
                      
                      {/* Progress Dots */}
                      <div className="flex flex-col md:flex-row gap-1">
                         <div className={`w-2 h-2 rounded-full transition-colors ${connections.find(c => c.questionId === q.id)?.year ? 'bg-green-400' : 'bg-slate-600'}`}></div>
                         <div className={`w-2 h-2 rounded-full transition-colors ${connections.find(c => c.questionId === q.id)?.trackId ? 'bg-green-400' : 'bg-slate-600'}`}></div>
                      </div>
                    </button>
                   );
                })}
              </div>

              {/* Row 3: Tracks */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 z-20 order-3 md:order-3">
                {TRACKS.map(track => {
                  const connectedTo = connections.find(c => c.trackId === track.id);
                  return (
                    <div
                      key={track.id}
                      ref={el => setItemRef(`t-${track.id}`, el)}
                      onClick={() => handleTrackClick(track.id)}
                      className={`
                        p-3 rounded-lg border-2 bg-slate-800 transition-all text-center
                        ${selectedQuestionId && localStatus !== 'finished' ? 'cursor-pointer hover:border-pink-500' : ''}
                        ${connectedTo && localStatus !== 'finished' ? 'border-slate-500' : 'border-slate-700'}
                      `}
                    >
                        <div className="flex flex-col items-center gap-2">
                           <button className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-pink-500">
                             <Play size={16} fill="currentColor" />
                           </button>
                           <span className="font-bold text-sm text-slate-300 block">{track.label}</span>
                           {localStatus === 'finished' && <span className="text-xs text-green-400 animate-pulse">{track.title}</span>}
                        </div>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        )}
      </main>

      {/* Bottom Nav Mobile */}
      <nav className="fixed bottom-0 left-0 w-full bg-slate-900 border-t border-slate-800 p-2 flex justify-around md:hidden z-50 safe-area-bottom">
         <button onClick={() => setActiveTab('game')} className={`p-2 flex flex-col items-center ${activeTab === 'game' ? 'text-pink-500' : 'text-slate-500'}`}>
            <HelpCircle size={20} />
            <span className="text-xs">Game</span>
         </button>
         <button onClick={() => setActiveTab('scores')} className={`p-2 flex flex-col items-center ${activeTab === 'scores' ? 'text-pink-500' : 'text-slate-500'}`}>
            <Trophy size={20} />
            <span className="text-xs">Scorebord</span>
         </button>
      </nav>

      {/* Admin Panel Overlay */}
      {isAdmin && (
         <div className="fixed bottom-4 left-4 right-4 bg-slate-800 border-2 border-purple-500 p-4 rounded-xl shadow-2xl z-50 flex flex-col sm:flex-row justify-between items-center gap-4 animate-slide-up">
            <div className="flex items-center gap-2">
               <Lock className="text-purple-500" size={20} />
               <span className="font-bold text-white">Admin Paneel</span>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
               <button 
                  onClick={startGlobalGame}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold"
               >
                  <PlayCircle size={18} /> Start Game
               </button>
               <button 
                  onClick={resetGameData}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold"
               >
                  <Trash2 size={18} /> Reset Alles
               </button>
            </div>
         </div>
      )}

    </div>
  );
}