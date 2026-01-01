import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Play, Pause, Music, HelpCircle, Calendar, RefreshCcw, CheckCircle, Users, Trophy, Loader2, Rocket, Clock, AlertTriangle } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

// --- Firebase Setup ---

// Jouw configuratie (deze staat goed!)
const firebaseConfig = {
  apiKey: "AIzaSyBsE1MwoImcCiMmtI6fglbRF8cs3pmmMF8",
  authDomain: "muziekspel-8e190.firebaseapp.com",
  projectId: "muziekspel-8e190",
  storageBucket: "muziekspel-8e190.firebasestorage.app",
  messagingSenderId: "574627950104",
  appId: "1:574627950104:web:e5b9965e3d342f33315d6d"
};

// Initialiseer de services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// We gebruiken hier de projectId als ID voor de opslagpaden
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
  const [authError, setAuthError] = useState(null); // Nieuw: error state
  
  // --- Game State ---
  const [connections, setConnections] = useState([]); 
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);
  const [status, setStatus] = useState('lobby'); // 'lobby', 'playing', 'finished'
  
  // --- Multiplayer State ---
  const [leaderboard, setLeaderboard] = useState([]);
  const [activePlayers, setActivePlayers] = useState([]);
  const [activeTab, setActiveTab] = useState('game'); 

  // --- Refs ---
  const containerRef = useRef(null);
  const itemRefs = useRef({});
  const setItemRef = (id, el) => { itemRefs.current[id] = el; };

  // --- Initialization ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check of we al ingelogd zijn, anders anoniem inloggen
        // We vangen eventuele errors nu netjes op
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
        setAuthError(null); // Reset error als inloggen lukt
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Real-time Listeners ---
  useEffect(() => {
    if (!user) return;
    
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'music_game_state');
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allData = [];
      snapshot.forEach((doc) => {
        allData.push({ id: doc.id, ...doc.data() });
      });

      // Filter 1: Finished Games (Leaderboard)
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

      // Filter 2: Active Players
      const playing = allData.filter(d => d.status === 'playing');
      setActivePlayers(playing);

    }, (error) => {
      console.error("Firestore Error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // --- Progress Sync Logic ---
  useEffect(() => {
    if (!user || !hasJoined || status === 'finished') return;

    const progressPercent = Math.round((connections.filter(c => c.year && c.trackId).length / GAME_DATA.length) * 100);
    
    const updateProgress = async () => {
       try {
         await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'music_game_state', user.uid), {
           progress: progressPercent
         });
       } catch (e) {
         // Ignore update errors
       }
    };
    updateProgress();
  }, [connections, user, hasJoined, status]);

  // --- Game Actions ---
  const joinGame = async () => {
    if (!teamName || !user) return;
    setHasJoined(true);
    setStatus('playing');
    
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'music_game_state', user.uid), {
        teamName: teamName,
        userId: user.uid,
        score: 0,
        progress: 0,
        status: 'playing',
        joinedAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Error joining", e);
    }
  };

  const handleQuestionClick = (qId) => {
    if (status === 'finished') return;
    setSelectedQuestionId(qId);
    if (!connections.find(c => c.questionId === qId)) {
      setConnections([...connections, { questionId: qId, year: null, trackId: null }]);
    }
  };

  const handleYearClick = (year) => {
    if (!selectedQuestionId || status === 'finished') return;
    setConnections(prev => prev.map(c => 
      c.questionId === selectedQuestionId ? { ...c, year: year } : c
    ));
  };

  const handleTrackClick = (trackId) => {
    if (!selectedQuestionId || status === 'finished') return;
    setConnections(prev => prev.map(c => 
      c.questionId === selectedQuestionId ? { ...c, trackId: trackId } : c
    ));
  };

  const isGameComplete = () => {
    if (connections.length < GAME_DATA.length) return false;
    return connections.every(c => c.year !== null && c.trackId !== null);
  };

  const submitScore = async () => {
    if (!user || status === 'finished') return;
    if (!isGameComplete()) return; 
    
    let baseScore = 0;
    connections.forEach(conn => {
      const question = GAME_DATA.find(q => q.id === conn.questionId);
      if (question.correctYear === conn.year) baseScore++;
      if (question.correctTrackId === conn.trackId) baseScore++;
    });
    
    setStatus('finished');
    setActiveTab('scores'); 

    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'music_game_state', user.uid), {
        score: baseScore,
        status: 'finished',
        progress: 100,
        timestamp: serverTimestamp()
      });
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
              isCorrect: status === 'finished' ? (GAME_DATA.find(q => q.id === conn.questionId).correctYear === conn.year) : null
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
              isCorrect: status === 'finished' ? (GAME_DATA.find(q => q.id === conn.questionId).correctTrackId === conn.trackId) : null
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
  }, [connections, status, activeTab, hasJoined]);


  // --- Render ---

  // ERROR SCHERM: Als Auth niet werkt
  if (authError) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="bg-red-900/20 border border-red-500/50 p-8 rounded-2xl shadow-2xl max-w-md w-full">
           <div className="flex items-center gap-3 text-red-500 mb-4">
             <AlertTriangle size={32} />
             <h2 className="text-xl font-bold">Configuratie Fout</h2>
           </div>
           <p className="text-slate-300 mb-4">
             De app kan niet verbinden met Firebase Authentication. Dit betekent meestal dat je de "Anonymous" (Anoniem) inlogmethode nog niet hebt aangezet.
           </p>
           <div className="bg-slate-950 p-4 rounded text-xs font-mono text-red-300 mb-4 overflow-auto">
             {authError}
           </div>
           <ul className="text-sm text-slate-400 list-disc list-inside space-y-1">
             <li>Ga naar Firebase Console &gt; Build &gt; Authentication</li>
             <li>Klik op tabblad 'Sign-in method'</li>
             <li>Zet 'Anonymous' op Enabled</li>
           </ul>
           <button onClick={() => window.location.reload()} className="mt-6 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg">
             Ik heb het gefixt, probeer opnieuw
           </button>
        </div>
      </div>
    );
  }

  // LOBBY SCHERM
  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full border border-slate-700">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-500 mb-6 text-center">
            Muziek Connectie
          </h1>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Team Naam</label>
              <input 
                type="text" 
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-pink-500 outline-none"
                placeholder="Bijv. De Winnies"
              />
            </div>
            <button 
              onClick={joinGame}
              disabled={!teamName || !user}
              className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50 flex justify-center"
            >
              {!user ? <Loader2 className="animate-spin" /> : 'Start Spel'}
            </button>
            {!user && <p className="text-xs text-center text-slate-500">Verbinden met database...</p>}
          </div>
        </div>
      </div>
    );
  }

  const canSubmit = isGameComplete();
  const currentScore = connections.reduce((acc, conn) => {
      // Local score calculation for display after finish
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
          
          {status === 'playing' && (
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
          {status === 'finished' && (
            <div className="text-green-400 font-bold text-xl">
              Jouw Score: {currentScore}
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
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-yellow-500">
                  <Trophy /> Ranglijst
                </h3>
                <div className="space-y-3">
                  {leaderboard.map((entry, idx) => {
                     // Calculate Total Score (Base + Bonus)
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

            {/* Active Players Section */}
             <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl opacity-80">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-400">
                  <Loader2 className="animate-spin" /> Onderweg
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activePlayers.map((player) => (
                    <div key={player.id} className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex justify-between items-center">
                       <span className="font-medium text-slate-300">{player.teamName}</span>
                       <div className="flex items-center gap-2">
                         <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                           <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${player.progress || 0}%` }}></div>
                         </div>
                         <span className="text-xs text-slate-500 w-8 text-right">{player.progress || 0}%</span>
                       </div>
                    </div>
                  ))}
                  {activePlayers.length === 0 && (
                    <p className="text-slate-500 text-center py-2 italic col-span-full">Iedereen is gefinisht!</p>
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
                    disabled={!selectedQuestionId || status === 'finished'}
                    className={`
                      p-4 rounded-lg text-center transition-all border-2
                      ${selectedQuestionId && status !== 'finished' ? 'cursor-pointer active:scale-95' : ''}
                      ${status === 'finished' 
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
                        ${selectedQuestionId && status !== 'finished' ? 'cursor-pointer hover:border-pink-500' : ''}
                        ${connectedTo && status !== 'finished' ? 'border-slate-500' : 'border-slate-700'}
                      `}
                    >
                        <div className="flex flex-col items-center gap-2">
                           <button className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-pink-500">
                             <Play size={16} fill="currentColor" />
                           </button>
                           <span className="font-bold text-sm text-slate-300 block">{track.label}</span>
                           {status === 'finished' && <span className="text-xs text-green-400 animate-pulse">{track.title}</span>}
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

    </div>
  );
}