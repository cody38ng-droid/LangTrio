import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Mic, 
  PenTool, 
  Headphones, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  Trophy, 
  TrendingUp,
  ArrowLeft,
  Play,
  Languages,
  GraduationCap,
  Loader2,
  Volume2,
  VolumeX,
  Bot,
  Palette,
  Gamepad2,
  Zap,
  Medal,
  Users,
  RefreshCcw,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Toaster } from '@/components/ui/sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import Markdown from 'react-markdown';
import { toast } from 'sonner';

import { Language, Level, ModuleType, Question, UserProgress, Module, SRSItem } from './types';
import { PLACEMENT_QUESTIONS, MODULES } from './data';
import { BADGE_DEFINITIONS } from './constants/badges';
import { DUMMY_LEADERBOARDS } from './constants/leaderboards';
import { determineLevel, evaluateWriting, evaluateSpeaking, chatWithAI, analyzeProgress, DetailedFeedback } from './services/gemini';
import { updateSRSItem, createInitialSRSItem } from './lib/srs';
import { ProgressDashboard } from './components/ProgressDashboard';
import { AIFeedback } from './components/AIFeedback';
import { BreakGame } from './components/BreakGame';
import { ChineseRubyText } from './components/ChineseRubyText';
import { auth, db, googleProvider } from './lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  doc, 
  setDoc, 
  getDoc,
  arrayUnion,
  increment
} from 'firebase/firestore';

const checkBadgeEligibility = (progress: UserProgress, lastModule: Module, lastScore: number): string[] => {
  const earned: string[] = [...(progress.earnedBadges || [])];

  // 1. First Module
  if (progress.completedModules.length >= 1 && !earned.includes('first_module')) {
    earned.push('first_module');
  }

  // 2. Perfect Score
  if (lastScore === 100 && !earned.includes('perfect_score')) {
    earned.push('perfect_score');
  }

  // 3. Section specific
  if (lastModule?.type === 'Speaking' && !earned.includes('speaking_ninja')) {
    earned.push('speaking_ninja');
  }
  if (lastModule?.type === 'Writing' && !earned.includes('writing_expert')) {
    earned.push('writing_expert');
  }

  // 4. Streak Master
  const hasStreak5 = Object.values(progress.sectionStreaks || {}).some(s => s >= 5);
  if (hasStreak5 && !earned.includes('streak_master')) {
    earned.push('streak_master');
  }

  // 5. Vocab Master
  const vocabCount = progress.completedModules.filter(id => {
    const m = MODULES.find(mod => mod.id === id);
    return m?.type === 'Vocabulary';
  }).length;
  if (vocabCount >= 5 && !earned.includes('vocab_master')) {
    earned.push('vocab_master');
  }

  return earned;
};

export default function App() {
  const [language, setLanguage] = useState<Language | null>(null);
  const [showGeneralDashboard, setShowGeneralDashboard] = useState(false);
  const [progress, setProgress] = useState<Record<Language, UserProgress | null>>({
    English: null,
    Malay: null,
    Chinese: null
  });

  const [leaderboardOpen, setLeaderboardOpen] = useState<{ open: boolean; lang: Language | null }>({ open: false, lang: null });
  const [leaderboardTab, setLeaderboardTab] = useState<'weekly' | 'alltime'>('alltime');
  
  const [globalStats, setGlobalStats] = useState({
    streak: 0,
    lastCheckIn: '',
    unlockedBackgrounds: ['default']
  });
  
  const [isTesting, setIsTesting] = useState(false);
  const [currentModule, setCurrentModule] = useState<Module | null>(null);
  const [testStep, setTestStep] = useState(0);
  const [testAnswers, setTestAnswers] = useState<{ question: string; answer: string; isCorrect: boolean }[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [bgMusicEnabled, setBgMusicEnabled] = useState(false);
  const [selectedBg, setSelectedBg] = useState('default');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [liveLeaderboard, setLiveLeaderboard] = useState<any[]>([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [showBreakGame, setShowBreakGame] = useState(false);
  const [breakTimeRemaining, setBreakTimeRemaining] = useState(300); // 5 minutes total break time
  const breakTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (showBreakGame && breakTimeRemaining > 0) {
      breakTimerRef.current = setInterval(() => {
        setBreakTimeRemaining(prev => {
          if (prev <= 1) {
            if (breakTimerRef.current) clearInterval(breakTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    }
    return () => {
      if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    };
  }, [showBreakGame, breakTimeRemaining === 0]);
  const [aiChatMessages, setAIChatMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([]);
  const [aiInput, setAIInput] = useState('');
  const [isAITyping, setIsAITyping] = useState(false);
  const [showProgressDashboard, setShowProgressDashboard] = useState(false);
  const [isAnalyzingProgress, setIsAnalyzingProgress] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<Record<Language, string | null>>({
    English: null,
    Malay: null,
    Chinese: null
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const backgrounds = {
    default: 'bg-[#fafafa]',
    sunset: 'bg-gradient-to-br from-orange-50 to-rose-100',
    forest: 'bg-gradient-to-br from-emerald-50 to-teal-100',
    midnight: 'bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100',
    ocean: 'bg-gradient-to-br from-blue-50 to-indigo-100'
  };

  const backgroundNames: Record<string, string> = {
    default: 'Classic White',
    sunset: 'Sunset Glow',
    forest: 'Deep Forest',
    midnight: 'Midnight Sky',
    ocean: 'Ocean Breeze'
  };

  const playSound = (type: 'correct' | 'wrong') => {
    const sound = new Audio(type === 'correct' 
      ? 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3' 
      : 'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3'
    );
    sound.volume = 0.4;
    sound.play().catch(() => {});
  };

  useEffect(() => {
    if (bgMusicEnabled) {
      if (!audioRef.current) {
        audioRef.current = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3');
        audioRef.current.loop = true;
        audioRef.current.volume = 0.1;
      }
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current?.pause();
    }
    return () => audioRef.current?.pause();
  }, [bgMusicEnabled]);
  const [moduleStep, setModuleStep] = useState(0);
  const [moduleScore, setModuleScore] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [writingInput, setWritingInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [detailedFeedback, setDetailedFeedback] = useState<DetailedFeedback | null>(null);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [flashcardSessionItems, setFlashcardSessionItems] = useState<SRSItem[]>([]);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState<{ section: ModuleType; nextLevel: Level } | null>(null);

  const recognitionRef = useRef<any>(null);

  // Firebase Auth Listener & Profile Sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          const initialStats = {
            streak: globalStats.streak || 1,
            lastCheckIn: globalStats.lastCheckIn || new Date().toISOString(),
            unlockedBackgrounds: globalStats.unlockedBackgrounds || ['default']
          };
          
          await setDoc(userDocRef, {
            displayName: firebaseUser.displayName || 'Learner',
            avatar: firebaseUser.photoURL || '👤',
            totalXp: 0,
            lastActive: serverTimestamp(),
            globalStats: initialStats
          });
          
          // Seed initial progress from local if exists
          const languages: Language[] = ['English', 'Malay', 'Chinese'];
          for (const lang of languages) {
            const localProg = progress[lang];
            if (localProg) {
              await setDoc(doc(db, 'users', firebaseUser.uid, 'progress', lang), localProg);
            }
          }
        } else {
          const data = userDoc.data();
          if (data.globalStats) {
            setGlobalStats(data.globalStats);
          }
          await setDoc(userDocRef, { lastActive: serverTimestamp() }, { merge: true });

          // Load language progress
          const languages: Language[] = ['English', 'Malay', 'Chinese'];
          const newProgress: Record<Language, UserProgress | null> = { ...progress };
          
          let hasCloudData = false;
          for (const lang of languages) {
            const progDoc = await getDoc(doc(db, 'users', firebaseUser.uid, 'progress', lang));
            if (progDoc.exists()) {
              newProgress[lang] = progDoc.data() as UserProgress;
              hasCloudData = true;
            }
          }
          
          if (hasCloudData) {
            setProgress(newProgress);
          }
        }
        toast.success(`Welcome back, ${firebaseUser.displayName}! Progress synced.`);
      } else {
        // Handle Logout: Reload from localStorage or reset
        const saved = localStorage.getItem('lingoleap_progress');
        if (saved) {
          try {
            setProgress(JSON.parse(saved));
          } catch (e) {
            setProgress({ English: null, Malay: null, Chinese: null });
          }
        }
        
        const savedGlobal = localStorage.getItem('lingoleap_global');
        if (savedGlobal) {
          try {
            setGlobalStats(JSON.parse(savedGlobal));
          } catch (e) {
            // keep current or reset
          }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Leaderboard Listener
  useEffect(() => {
    if (!leaderboardOpen.open || !leaderboardOpen.lang) return;

    setIsLeaderboardLoading(true);
    const scoresRef = collection(db, 'scores');
    
    // Calculate timestamp for "Weekly" (last 7 days)
    const sevenDaysAgo = new Date().getTime();
    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
    const threshold = sevenDaysAgo - sevenDaysInMs;

    // We fetch recent scores for the language and handle 
    // time-filtering/sorting on the client to avoid Firestore index requirements.
    const q = query(
      scoresRef,
      where('language', '==', leaderboardOpen.lang)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userAggregates: Record<string, any> = {};
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const uid = data.userId;
        if (!uid) return;

        // If Weekly tab, filter records older than 7 days
        if (leaderboardTab === 'weekly') {
          const ts = data.timestamp?.toMillis ? data.timestamp.toMillis() : 0;
          if (ts < threshold) return;
        }
        
        if (!userAggregates[uid]) {
          userAggregates[uid] = {
            id: uid,
            userName: data.userName || 'Student',
            userAvatar: data.userAvatar || '🎓',
            score: 0,
            language: data.language,
            isMe: uid === auth.currentUser?.uid
          };
        }
        userAggregates[uid].score += (data.score || 0);
      });

      const records = Object.values(userAggregates)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);
      
      setLiveLeaderboard(records);
      setIsLeaderboardLoading(false);
    }, (error) => {
      console.error("Leaderboard Error:", error);
      setIsLeaderboardLoading(false);
    });

    return () => unsubscribe();
  }, [leaderboardOpen.open, leaderboardOpen.lang, leaderboardTab]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Welcome to LingoLeap!");
    } catch (e) {
      toast.error("Auth failed. Please try again.");
    }
  };

  const handleLogout = () => {
    signOut(auth);
    toast.info("Logged out safely.");
  };

  const saveScoreToCloud = (lang: Language, scoreVal: number, xpGained: number, currentBadges: string[] = []) => {
    if (!auth.currentUser) return;

    // We do it asynchronously without blocking the UI
    (async () => {
      try {
        // 1. Add score record (historical)
        await addDoc(collection(db, 'scores'), {
          userId: auth.currentUser.uid,
          userName: auth.currentUser.displayName || 'Learner',
          userAvatar: '🎓', 
          language: lang,
          score: scoreVal,
          xpGained: xpGained,
          timestamp: serverTimestamp()
        });

        // 2. Update user cumulative points and badges
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const updateData: any = { 
          totalXp: increment(xpGained),
          [`pointsByLanguage.${lang}`]: increment(scoreVal),
          lastActive: serverTimestamp()
        };

        if (currentBadges && currentBadges.length > 0) {
          updateData.badges = arrayUnion(...currentBadges);
        }

        await setDoc(userRef, updateData, { merge: true });
      } catch (error) {
        console.error("Firestore Save Error:", error);
      }
    })();
  };
  useEffect(() => {
    const saved = localStorage.getItem('lingoleap_progress');
    if (saved) {
      try {
        setProgress(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved progress", e);
      }
    }

    const savedGlobal = localStorage.getItem('lingoleap_global');
    if (savedGlobal) {
      try {
        const stats = JSON.parse(savedGlobal);
        setGlobalStats(stats);
        
        // Streak logic
        const now = new Date();
        const last = stats.lastCheckIn ? new Date(stats.lastCheckIn) : null;
        
        if (!last) {
          setGlobalStats(prev => ({ ...prev, streak: 1, lastCheckIn: now.toISOString() }));
        } else {
          const diffHours = (now.getTime() - last.getTime()) / (1000 * 60 * 60);
          
          if (diffHours >= 12 && diffHours < 36) {
            // Increment streak if between 12 and 36 hours (allowing some flexibility)
            setGlobalStats(prev => ({ ...prev, streak: prev.streak + 1, lastCheckIn: now.toISOString() }));
            toast.success(`Streak Continued! Day ${stats.streak + 1} 🔥`);
          } else if (diffHours >= 36) {
            // Reset if missed more than 36 hours
            setGlobalStats(prev => ({ ...prev, streak: 1, lastCheckIn: now.toISOString() }));
            toast.info("Streak reset. Let's start again!");
          }
        }
      } catch (e) {
        console.error("Failed to parse global stats", e);
      }
    } else {
      // First time
      const now = new Date();
      setGlobalStats({
        streak: 1,
        lastCheckIn: now.toISOString(),
        unlockedBackgrounds: ['default']
      });
    }
  }, []);

  // Save progress to LocalStorage & Firestore
  useEffect(() => {
    localStorage.setItem('lingoleap_progress', JSON.stringify(progress));
    
    if (user) {
      // Background sync for each language that has progress
      (async () => {
        try {
          const languages: Language[] = ['English', 'Malay', 'Chinese'];
          for (const lang of languages) {
            const prog = progress[lang];
            if (prog) {
              await setDoc(doc(db, 'users', user.uid, 'progress', lang), prog);
            }
          }
        } catch (e) {
          console.error("Cloud Sync Error (Progress):", e);
        }
      })();
    }
  }, [progress, user]);

  useEffect(() => {
    localStorage.setItem('lingoleap_global', JSON.stringify(globalStats));
    
    if (user) {
      (async () => {
        try {
          const userRef = doc(db, 'users', user.uid);
          await setDoc(userRef, { globalStats }, { merge: true });
        } catch (e) {
          console.error("Cloud Sync Error (Global):", e);
        }
      })();
    }
  }, [globalStats, user]);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setTranscription(text);
        setIsRecording(false);
      };

      recognitionRef.current.onerror = () => {
        setIsRecording(false);
        toast.error("Speech recognition error. Please try again.");
      };
    }
  }, []);

  // --- Lifted Hooks for Rules of Hooks compliance ---
  const placementQuestion = (language && PLACEMENT_QUESTIONS[language] && PLACEMENT_QUESTIONS[language][testStep]) || null;
  const shuffledPlacementOptions = useMemo(() => {
    if (!placementQuestion || !placementQuestion.options) return [];
    return [...placementQuestion.options].sort(() => Math.random() - 0.5);
  }, [placementQuestion?.id, testStep, language]);

  const currentModuleQuestion = (currentModule && language && currentModule.questions[moduleStep]) ? currentModule.questions[moduleStep] : null;
  const shuffledModuleOptions = useMemo(() => {
    if (!currentModuleQuestion || !currentModuleQuestion.options) return [];
    return [...currentModuleQuestion.options].sort(() => Math.random() - 0.5);
  }, [currentModuleQuestion?.id, moduleStep, currentModule?.id]);

  const startTest = (lang: Language) => {
    setLanguage(lang);
    if (progress[lang]) {
      // Already tested, skip to dashboard
      return;
    }
    setIsTesting(true);
    setTestStep(0);
    setTestAnswers([]);
  };

  const handleTestAnswer = async (answer: string) => {
    if (!language) return;
    const question = PLACEMENT_QUESTIONS[language][testStep];
    const isCorrect = answer === question.correctAnswer;
    const newAnswers = [...testAnswers, { question: question.question, answer, isCorrect }];
    setTestAnswers(newAnswers);

    if (testStep < PLACEMENT_QUESTIONS[language].length - 1) {
      setTestStep(testStep + 1);
    } else {
      setIsEvaluating(true);
      const result = await determineLevel(language, newAnswers);
      
      const initialProgress: UserProgress = {
        language,
        overallLevel: result.level,
        sectionLevels: {
          Listening: result.level,
          Speaking: result.level,
          Writing: result.level,
          Comprehension: result.level,
          Vocabulary: result.level,
          Grammar: result.level
        },
        sectionStreaks: {
          Listening: 0,
          Speaking: 0,
          Writing: 0,
          Comprehension: 0,
          Vocabulary: 0,
          Grammar: 0
        },
        completedModules: [],
        moduleHistory: {},
        srsItems: [],
        earnedBadges: []
      };

      setProgress(prev => ({ ...prev, [language]: initialProgress }));
      
      // Unlock background based on language
      const bgToUnlock = language === 'English' ? 'sunset' : language === 'Malay' ? 'forest' : 'ocean';
      setGlobalStats(prev => ({
        ...prev,
        unlockedBackgrounds: Array.from(new Set([...prev.unlockedBackgrounds, bgToUnlock]))
      }));

      setIsTesting(false);
      setIsEvaluating(false);
      toast.success(`Your level is: ${result.level}! ${result.explanation}`);
      toast(`New Wallpaper Unlocked: ${backgroundNames[bgToUnlock]}!`, {
        icon: '🎁'
      });
    }
  };

  const updateSRSAfterModule = (items: SRSItem[], mod: Module, score: number): SRSItem[] => {
    const quality = Math.floor(score / 20); // Map 0-100 to 0-5
    const existingIndex = items.findIndex(item => item.id === mod.id);
    
    let updatedItem: SRSItem;
    if (existingIndex >= 0) {
      updatedItem = updateSRSItem(quality, items[existingIndex]);
    } else {
      updatedItem = updateSRSItem(quality, createInitialSRSItem(mod.id, 'module', mod.title));
    }

    const newItems = [...items];
    if (existingIndex >= 0) {
      newItems[existingIndex] = updatedItem;
    } else {
      newItems.push(updatedItem);
    }
    return newItems;
  };

  const updateSRSAfterItem = (items: SRSItem[], id: string, type: 'vocabulary' | 'grammar', content: string, isCorrect: boolean): SRSItem[] => {
    const quality = isCorrect ? 5 : 1;
    const existingIndex = items.findIndex(item => item.id === id);
    
    let updatedItem: SRSItem;
    if (existingIndex >= 0) {
      updatedItem = updateSRSItem(quality, items[existingIndex]);
    } else {
      updatedItem = updateSRSItem(quality, createInitialSRSItem(id, type, content));
    }

    const newItems = [...items];
    if (existingIndex >= 0) {
      newItems[existingIndex] = updatedItem;
    } else {
      newItems.push(updatedItem);
    }
    return newItems;
  };

  const handleFlashcardResult = (isCorrect: boolean) => {
    if (!language) return;
    const currentLangProgress = progress[language];
    if (!currentLangProgress) return;
    
    const currentItem = flashcardSessionItems[flashcardIndex];
    if (!currentItem) return;

    const updatedSRS = updateSRSAfterItem(
      currentLangProgress.srsItems,
      currentItem.id,
      currentItem.type as 'vocabulary' | 'grammar',
      currentItem.content,
      isCorrect
    );

    setProgress(prev => ({
      ...prev,
      [language!]: { ...currentLangProgress, srsItems: updatedSRS }
    }));

    if (isCorrect) playSound('correct');
    else playSound('wrong');

    if (flashcardIndex < flashcardSessionItems.length - 1) {
      setIsCardFlipped(false);
      setFlashcardIndex(flashcardIndex + 1);
    } else {
      setShowFlashcards(false);
      setFlashcardIndex(0);
      setFlashcardSessionItems([]);
      setIsCardFlipped(false);
      toast.success("Flashcard session complete!");
    }
  };

  const shuffleQuestions = (questions: Question[]) => {
    return [...questions].map(q => ({
      ...q,
      options: q.options ? [...q.options].sort(() => Math.random() - 0.5) : undefined
    })).sort(() => Math.random() - 0.5);
  };

  const handleShuffle = () => {
    if (!currentModule) return;
    
    // Shuffle all questions except the current one to keep the user at the same step
    // Also shuffle options for every question
    const questions = currentModule.questions.map(q => ({
      ...q,
      options: q.options ? [...q.options].sort(() => Math.random() - 0.5) : undefined
    }));
    const currentQuestion = questions[moduleStep];
    
    // Remove current question, shuffle the rest, then put current question back at moduleStep
    questions.splice(moduleStep, 1);
    const shuffledRest = questions.sort(() => Math.random() - 0.5);
    shuffledRest.splice(moduleStep, 0, currentQuestion);
    
    setCurrentModule({
      ...currentModule,
      questions: shuffledRest
    });
    
    toast.info("Questions and options re-shuffled!", {
      icon: '🔀'
    });
  };

  const startModule = (mod: Module) => {
    const shuffledMod = { ...mod, questions: shuffleQuestions(mod.questions) };
    setCurrentModule(shuffledMod);
    setModuleStep(0);
    setModuleScore(0);
    setFeedback(null);
    setWritingInput('');
    setTranscription('');
  };

  const speakText = (text: string, lang: Language) => {
    const utterance = new SpeechSynthesisUtterance(text);
    if (lang === 'Malay') utterance.lang = 'ms-MY';
    else if (lang === 'Chinese') utterance.lang = 'zh-CN';
    else utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const handleAnalyzeProgress = async (lang: Language) => {
    if (!progress[lang]) return;
    setIsAnalyzingProgress(true);
    try {
      const feedback = await analyzeProgress(lang, progress[lang]);
      setAiFeedback(prev => ({ ...prev, [lang]: feedback }));
    } catch (e) {
      toast.error("Failed to analyze progress. Please try again.");
    } finally {
      setIsAnalyzingProgress(false);
    }
  };

  const startRecording = () => {
    if (!recognitionRef.current) {
      toast.error("Speech recognition not supported in this browser.");
      return;
    }
    
    // Set correct language for recognition based on currently active study language
    if (language === 'Malay') {
      recognitionRef.current.lang = 'ms-MY';
    } else if (language === 'Chinese') {
      recognitionRef.current.lang = 'zh-CN';
    } else {
      recognitionRef.current.lang = 'en-US';
    }

    setTranscription('');
    setIsRecording(true);
    recognitionRef.current.start();
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleItemResult = (question: Question, isCorrect: boolean, scoreValue: number, customFeedback?: string) => {
    if (customFeedback) {
      setFeedback(customFeedback);
      if (isCorrect) playSound('correct');
      else playSound('wrong');
    } else if (isCorrect) {
      playSound('correct');
      setFeedback("Correct! Well done.");
    } else {
      playSound('wrong');
      setFeedback(`Incorrect. The correct answer was: ${question.correctAnswer || 'Check feedback'}`);
    }

    setModuleScore(prev => prev + scoreValue);
    setLastScore(scoreValue);

    if (question.type === 'Vocabulary' || question.type === 'Grammar') {
      const currentLangProgress = progress[language!];
      if (currentLangProgress) {
        const updatedSRS = updateSRSAfterItem(
          currentLangProgress.srsItems,
          question.id,
          question.type.toLowerCase() as 'vocabulary' | 'grammar',
          question.question,
          isCorrect
        );
        setProgress(prev => ({
          ...prev,
          [language!]: { ...currentLangProgress, srsItems: updatedSRS }
        }));
      }
    }
  };

  const handleModuleStep = async () => {
    if (!currentModule || !language) return;
    const question = currentModule.questions[moduleStep];
    let stepScore = 0;
    let isCorrect = false;

    setIsEvaluating(true);

    if (question.type === 'Comprehension' || question.type === 'Listening' || question.type === 'Vocabulary' || question.type === 'Grammar') {
       // Handled in renderModule for MCQ
    } else if (question.type === 'Writing') {
      const result = await evaluateWriting(language, question.question, writingInput);
      stepScore = result.score;
      isCorrect = result.score >= 70;
      setDetailedFeedback(result);
      handleItemResult(question, isCorrect, stepScore, result.feedback);
    } else if (question.type === 'Speaking') {
      const result = await evaluateSpeaking(language, question.question, transcription);
      stepScore = result.score;
      isCorrect = result.score >= 70;
      setDetailedFeedback(result);
      handleItemResult(question, isCorrect, stepScore, result.feedback);
    }

    setIsEvaluating(false);
  };

  const nextStep = () => {
    if (!currentModule || !language) return;
    if (moduleStep < currentModule.questions.length - 1) {
      setModuleStep(moduleStep + 1);
      setFeedback(null);
      setDetailedFeedback(null);
      setWritingInput('');
      setTranscription('');
      setLastScore(null);
    } else {
      const finalScore = Math.round(moduleScore / currentModule.questions.length);
      
      // Update streaks and check for level up
      const currentLangProgress = progress[language];
      if (currentLangProgress) {
        const section = currentModule.type;
        const newStreak = finalScore >= 80 ? currentLangProgress.sectionStreaks[section] + 1 : 0;
        
        const historyEntry = { score: finalScore, date: new Date().toISOString() };
        const updatedHistory = {
          ...currentLangProgress.moduleHistory,
          [currentModule.id]: [...(currentLangProgress.moduleHistory[currentModule.id] || []), historyEntry]
        };

        const updatedProgress = {
          ...currentLangProgress,
          sectionStreaks: {
            ...currentLangProgress.sectionStreaks,
            [section]: newStreak
          },
          moduleHistory: updatedHistory,
          completedModules: Array.from(new Set([...currentLangProgress.completedModules, currentModule.id])),
          srsItems: updateSRSAfterModule(currentLangProgress.srsItems, currentModule, finalScore)
        };

        setProgress(prev => ({ ...prev, [language!]: updatedProgress }));

      // Check for new badges
      const newBadges = checkBadgeEligibility(updatedProgress, currentModule, finalScore);
      if (newBadges.length > 0) {
        const reallyNewBadges = newBadges.filter(b => !currentLangProgress.earnedBadges.includes(b));
        if (reallyNewBadges.length > 0) {
          setProgress(prev => {
            const curr = prev[language!];
            if (!curr) return prev;
            return {
              ...prev,
              [language!]: {
                ...curr,
                earnedBadges: Array.from(new Set([...curr.earnedBadges, ...reallyNewBadges]))
              }
            };
          });

          reallyNewBadges.forEach(badgeId => {
            const def = BADGE_DEFINITIONS[badgeId];
            toast(`New Badge Earned: ${def.name}!`, {
              description: def.description,
              icon: <Medal className="text-yellow-500" />
            });
          });
        }
      }

        if (newStreak >= 3) {
          const currentSectionLevel = currentLangProgress.sectionLevels[section];
          let nextLevel: Level | null = null;
          if (currentSectionLevel === 'Beginner') nextLevel = 'Intermediate';
          else if (currentSectionLevel === 'Intermediate') nextLevel = 'Advanced';

          if (nextLevel) {
            setShowLevelUp({ section, nextLevel });
          }
        }
      }

      // Show final results screen
      setFeedback(`Congratulations! You've completed the module with a score of ${finalScore}%.`);
      setLastScore(finalScore);
      setModuleScore(-1); // Signal that we are at the end

      // Save to Cloud if logged in
      if (auth.currentUser) {
        saveScoreToCloud(language, finalScore, finalScore * 2, progress[language]?.earnedBadges || []); // XP = Score * 2
      } else {
        toast.info("Sign in to save your score to the global leaderboard!");
      }
    }
  };

  const handleRetryStep = () => {
    if (lastScore !== null) {
      setModuleScore(prev => Math.max(0, prev - lastScore));
    }
    setFeedback(null);
    setDetailedFeedback(null);
    setWritingInput('');
    setTranscription('');
    setLastScore(null);
  };

  const handleLevelUp = () => {
    if (!showLevelUp || !language) return;
    const { section, nextLevel } = showLevelUp;
    
    setProgress(prev => {
      const current = prev[language];
      if (!current) return prev;
      return {
        ...prev,
        [language]: {
          ...current,
          sectionLevels: {
            ...current.sectionLevels,
            [section]: nextLevel
          },
          sectionStreaks: {
            ...current.sectionStreaks,
            [section]: 0
          }
        }
      };
    });
    
    toast.success(`Congratulations! You've reached ${nextLevel} level in ${section}!`);
    setShowLevelUp(null);
  };

  const renderGeneralDashboard = () => {
    const languages = (['English', 'Malay', 'Chinese'] as Language[]);
    const totalCompleted = languages.reduce((acc, lang) => acc + (progress[lang]?.completedModules.length || 0), 0);
    
    return (
      <div className="max-w-6xl mx-auto py-12 px-4 space-y-12">
        <div className="flex justify-between items-center">
          <h2 className="text-4xl font-black text-primary tracking-tight">General Progress</h2>
          <Button variant="outline" onClick={() => setShowGeneralDashboard(false)}>
            <ArrowLeft className="mr-2 w-4 h-4" /> Back to Selection
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest opacity-70">Total Modules Done</CardTitle>
              <CardContent className="p-0 pt-2">
                <span className="text-5xl font-black">{totalCompleted}</span>
              </CardContent>
            </CardHeader>
          </Card>
          {languages.map(lang => {
            const displayName = lang === 'English' ? 'English' : lang === 'Malay' ? 'Malay' : lang;
            return (
              <Card key={lang} className="border-primary/10">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">{displayName} Level</CardTitle>
                  <CardContent className="p-0 pt-2 flex justify-between items-end">
                    <span className="text-3xl font-bold text-primary">{progress[lang]?.overallLevel || 'Not Started'}</span>
                    <Badge variant="secondary">{progress[lang]?.completedModules.length || 0} Done</Badge>
                  </CardContent>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        <div className="space-y-6">
          <h3 className="text-2xl font-bold">Language Breakdown</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {languages.map(lang => {
              const p = progress[lang];
              const displayName = lang === 'English' ? 'English' : lang === 'Malay' ? 'Malay' : lang;
              if (!p) return (
                <Card key={lang} className="opacity-50 border-dashed">
                  <CardHeader className="text-center py-12">
                    <CardTitle className="text-muted-foreground italic">No data for {displayName}</CardTitle>
                    <Button variant="link" onClick={() => startTest(lang)}>Start Placement Test</Button>
                  </CardHeader>
                </Card>
              );

              return (
                <Card key={lang} className="overflow-hidden border-primary/20">
                  <CardHeader className="bg-primary/5">
                    <CardTitle className="flex items-center justify-between">
                      {displayName}
                      <Button variant="ghost" size="sm" onClick={() => { setLanguage(lang); setShowGeneralDashboard(false); }}>
                        View Details <ChevronRight className="ml-1 w-4 h-4" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    {(['Listening', 'Speaking', 'Writing', 'Comprehension', 'Vocabulary', 'Grammar'] as ModuleType[]).map(type => (
                      <div key={type} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span>{type}</span>
                          <span>{p.sectionLevels[type]}</span>
                        </div>
                        <Progress value={p.sectionStreaks[type] * 33.3} className="h-1" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const handleAIChat = async () => {
    if (!aiInput.trim()) return;
    const userMsg = aiInput;
    setAIChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setAIInput('');
    setIsAITyping(true);

    // Build context for Gemini
    let context = `You are LingoBot, a multilingual language tutor powered by Google's Gemini models.
    The user is currently learning ${language || 'a new language'}.

    MISSION:
    1. Understand the user even if they mix languages or make mistakes.
    2. Provide answers that involve both English and the target language (${language}) to help them learn terms in context.
    3. If they ask a question in English about ${language}, explain the concept and then give examples in ${language} with translations.
    4. If the user asks who you are, state that you are LingoBot, an AI assistant powered by Google's Gemini AI.`;
    
    if (currentModule) {
      const question = currentModule.questions[moduleStep];
      context += ` 
      CURRENT TASK CONTEXT:
      - Module: ${currentModule.title} (${currentModule.type})
      - Level: ${currentModule.level}
      - Current Question: "${question.question}"
      
      If the user is stuck on this specific question, guide them without giving the direct answer immediately unless they are very frustrated.`;
    }

    try {
      const response = await chatWithAI(language || 'English', context, userMsg);
      setAIChatMessages(prev => [...prev, { role: 'ai', content: response }]);
    } catch (error) {
      setAIChatMessages(prev => [...prev, { role: 'ai', content: "Maaf (Sorry), I'm having trouble connecting right now. Please try again!" }]);
    } finally {
      setIsAITyping(false);
    }
  };

  useEffect(() => {
    if (isAIChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiChatMessages, isAITyping, isAIChatOpen]);

  const renderLanguageSelection = () => (
    <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-8 relative z-10">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <h1 className={`text-6xl font-black tracking-tighter drop-shadow-sm ${selectedBg === 'midnight' ? 'text-white' : 'text-primary'}`}>LingoLeap</h1>
        <p className={`text-xl font-medium ${selectedBg === 'midnight' ? 'text-slate-300' : 'text-muted-foreground'}`}>Master a new language with AI-powered practice</p>
      </motion.div>

      <div className="flex gap-4 mb-4">
        <Button 
          variant="outline" 
          size="lg" 
          className={`rounded-full px-8 shadow-lg backdrop-blur-sm ${selectedBg === 'midnight' ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700' : 'border-primary text-primary hover:bg-primary hover:text-white bg-white/50'}`}
          onClick={() => setShowGeneralDashboard(true)}
        >
          <Trophy className="mr-2 w-5 h-5 text-yellow-500" /> Progress & Global Ranks
        </Button>
        <div className={`flex items-center px-6 rounded-full shadow-lg backdrop-blur-sm border ${selectedBg === 'midnight' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white/50 border-primary/20 text-primary'}`}>
          <span className="text-lg font-bold">🔥 {globalStats.streak} Day Streak</span>
        </div>
        <Button 
          variant="ghost" 
          size="lg" 
          className={`rounded-full px-6 ${selectedBg === 'midnight' ? 'text-white hover:bg-slate-800' : ''}`}
          onClick={() => setBgMusicEnabled(!bgMusicEnabled)}
        >
          {bgMusicEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </Button>
        
        <Dialog>
          <DialogTrigger 
            render={
              <Button variant="outline" size="lg" className={`rounded-full px-6 shadow-lg backdrop-blur-sm ${selectedBg === 'midnight' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white/50'}`}>
                <Palette className="mr-2 w-5 h-5" /> Inventory
              </Button>
            }
          />
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Background Inventory</DialogTitle>
              <DialogDescription>Complete level tests to unlock more wallpapers!</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              {Object.keys(backgrounds).map((bg) => {
                const isUnlocked = globalStats.unlockedBackgrounds.includes(bg);
                return (
                  <Button
                    key={bg}
                    variant={selectedBg === bg ? 'default' : 'outline'}
                    className={`h-24 flex flex-col gap-2 capitalize relative overflow-hidden ${!isUnlocked ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                    onClick={() => isUnlocked && setSelectedBg(bg)}
                    disabled={!isUnlocked}
                  >
                    <div className={`w-full h-12 rounded ${backgrounds[bg as keyof typeof backgrounds]}`} />
                    <span className="text-xs font-bold">{backgroundNames[bg]}</span>
                    {!isUnlocked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <XCircle className="w-6 h-6 text-white" />
                      </div>
                    )}
                  </Button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl px-4">
        {(['English', 'Malay', 'Chinese'] as Language[]).map((lang) => {
          const images = {
            English: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=800&q=80',
            Malay: '/regenerated_image_1777553720643.png',
            Chinese: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=800&q=80'
          };
          const displayNames = {
            English: 'English',
            Malay: 'Malay',
            Chinese: 'Chinese'
          };
          return (
            <motion.div
              key={lang}
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.95 }}
            >
              <Card 
                className="cursor-pointer hover:border-primary transition-all overflow-hidden group shadow-xl border-2 border-transparent relative"
                onClick={() => startTest(lang)}
              >
                <div className="h-48 relative overflow-hidden">
                  <img 
                    src={images[lang]} 
                    alt={displayNames[lang]} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                  <div className="absolute bottom-4 left-4">
                    <Badge className="bg-white/90 text-black border-none backdrop-blur-sm">
                      <Languages className="w-3 h-3 mr-1" /> {displayNames[lang]}
                    </Badge>
                  </div>
                  {/* Leaderboard Trigger Button */}
                  <div 
                    className="absolute top-4 right-4 z-20"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLeaderboardOpen({ open: true, lang });
                    }}
                  >
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Button size="sm" className="bg-primary text-white font-black shadow-xl border-none h-10 px-4 rounded-xl">
                        <Trophy className="w-4 h-4 mr-2 text-yellow-400 fill-current" /> LEADERBOARD
                      </Button>
                    </motion.div>
                  </div>
                </div>
                <CardHeader className="text-center bg-white">
                  <CardTitle className="text-2xl font-bold">{displayNames[lang]}</CardTitle>
                  <CardDescription>
                    {progress[lang] ? `Level: ${progress[lang]?.overallLevel}` : `Start learning ${displayNames[lang]}`}
                  </CardDescription>
                </CardHeader>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );

  const renderPlacementTest = () => {
    if (!language || !placementQuestion) return null;
    const totalSteps = PLACEMENT_QUESTIONS[language].length;

    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Card className="border-2 border-primary/20 shadow-xl overflow-hidden">
          {language === 'Malay' && (
            <div className="h-40 relative">
              <img 
                src="https://images.unsplash.com/photo-1542382156909-9ae37b3f56fd?auto=format&fit=crop&w=1200&q=80" 
                alt="Batu Caves Malaysia" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                <span className="text-white font-bold text-lg">Malay Learning Journey 🇲🇾</span>
              </div>
            </div>
          )}
          <CardHeader>
            <div className="flex justify-between items-center mb-4">
              <Badge variant="outline" className="text-primary border-primary">Placement Test: {language}</Badge>
              <span className="text-sm font-medium text-muted-foreground">Question {testStep + 1} of {totalSteps}</span>
            </div>
            <Progress value={((testStep + 1) / totalSteps) * 100} className="h-2" />
            <CardTitle className="text-2xl mt-6 leading-relaxed">{placementQuestion.question}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {shuffledPlacementOptions.map((option) => (
              <Button
                key={option}
                variant="outline"
                className="w-full justify-start text-left h-auto py-4 px-6 text-lg hover:bg-primary/5 hover:border-primary transition-all"
                onClick={() => handleTestAnswer(option)}
                disabled={isEvaluating}
              >
                {option}
              </Button>
            ))}
          </CardContent>
          {isEvaluating && (
            <div className="flex items-center justify-center p-8 space-x-3">
              <Loader2 className="animate-spin text-primary" />
              <span className="font-medium">Evaluating your level...</span>
            </div>
          )}
        </Card>
      </div>
    );
  };

  const renderDashboard = () => {
    if (!language || !progress[language]) return null;
    const userLangProgress = progress[language]!;
    const now = new Date();
    const dueItems = userLangProgress.srsItems.filter(item => new Date(item.nextReview) <= now);
    
    return (
      <div className="max-w-6xl mx-auto py-12 px-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div className="space-y-2">
            <h2 className="text-4xl font-bold text-primary">Your Dashboard</h2>
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="bg-primary text-primary-foreground px-3 py-1">{language}</Badge>
              <Badge variant="outline" className="border-primary text-primary px-3 py-1">Overall: {userLangProgress.overallLevel}</Badge>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setShowProgressDashboard(true)}
                className="rounded-full shadow-md border-primary/20 text-primary font-black text-[10px] uppercase tracking-wider h-8"
              >
                <TrendingUp className="mr-2 w-3 h-3" /> Growth & Stats
              </Button>
              <Button 
                size="sm" 
                onClick={() => setLeaderboardOpen({ open: true, lang: language })}
                className="rounded-full shadow-lg bg-yellow-500 hover:bg-yellow-600 border-none h-8 px-4 font-bold text-xs"
              >
                <Trophy className="mr-2 w-3 h-3 fill-current" /> Language Leaderboard
              </Button>
            </div>
          </div>
          <Button variant="ghost" onClick={() => { setLanguage(null); }} className="text-muted-foreground hover:text-primary">
            <ArrowLeft className="mr-2 w-4 h-4" /> Change Language
          </Button>
        </div>

        <Tabs defaultValue="all" className="w-full">
          {language === 'Malay' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <Card className="border-2 border-primary/20 bg-primary/5 overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  <div className="md:w-1/3 h-48 md:h-auto relative">
                    <img 
                      src="https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&w=800&q=80" 
                      alt="Nasi Lemak" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <CardHeader className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-5 h-5 text-primary" />
                      <Badge>Cultural Insight</Badge>
                    </div>
                    <CardTitle className="text-2xl">Symbol of Malaysia: Nasi Lemak</CardTitle>
                    <CardDescription className="text-base mt-2">
                      "What Malay people love most!" Nasi Lemak is often called the national dish of Malaysia. It's rice cooked in coconut milk and pandan leaf, served with sambal, anchovies, peanuts, and boiled egg. It represents the rich, harmonious blend of flavors that define the culture.
                    </CardDescription>
                  </CardHeader>
                </div>
              </Card>
            </motion.div>
          )}

          <TabsList className="mb-8 p-1 bg-muted/50 rounded-xl overflow-x-auto flex-nowrap justify-start">
            <TabsTrigger value="all" className="rounded-lg px-6">All Modules</TabsTrigger>
            <TabsTrigger value="Vocabulary" className="rounded-lg px-6">Vocab</TabsTrigger>
            <TabsTrigger value="Grammar" className="rounded-lg px-6">Grammar</TabsTrigger>
            <TabsTrigger value="Listening" className="rounded-lg px-6">Listening</TabsTrigger>
            <TabsTrigger value="Speaking" className="rounded-lg px-6">Speaking</TabsTrigger>
            <TabsTrigger value="Writing" className="rounded-lg px-6">Writing</TabsTrigger>
            <TabsTrigger value="Comprehension" className="rounded-lg px-6">Comprehension</TabsTrigger>
            <TabsTrigger value="review" className="rounded-lg px-6 flex items-center gap-2">
              <Zap className="w-4 h-4" /> Review Due
              {dueItems.length > 0 && (
                <Badge className="ml-1 px-1.5 py-0 h-5 min-w-5 flex items-center justify-center bg-destructive text-[10px]">
                  {dueItems.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="review">
            {dueItems.length === 0 ? (
              <Card className="border-dashed border-2 py-12 text-center">
                <CardHeader>
                  <CardTitle className="text-muted-foreground">All caught up! 🎉</CardTitle>
                  <CardDescription>No concepts are due for review right now. Keep learning new things!</CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <div className="space-y-8">
                {dueItems.some(i => i.type !== 'module') && (
                  <div className="flex justify-between items-center bg-primary/5 p-6 rounded-3xl border-2 border-primary/10">
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold">Fast-Track Review</h3>
                      <p className="text-sm text-muted-foreground">Practice your vocab & grammar words with flashcards.</p>
                    </div>
                    <Button 
                      size="lg" 
                      className="rounded-full px-8 shadow-lg shadow-primary/20"
                      onClick={() => {
                        const items = userLangProgress.srsItems.filter(i => 
                          (i.type === 'vocabulary' || i.type === 'grammar') && 
                          new Date(i.nextReview) <= new Date()
                        );
                        setFlashcardSessionItems(items);
                        setFlashcardIndex(0);
                        setIsCardFlipped(false);
                        setShowFlashcards(true);
                      }}
                    >
                      <Zap className="mr-2 w-5 h-5 fill-current" /> Start Flashcards
                    </Button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {dueItems.map(item => {
                  const mod = MODULES.find(m => m.id === item.id);
                  if (item.type === 'module' && mod) {
                    return (
                      <motion.div key={item.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                        <Card className="border-primary/40 bg-primary/5 border-2 h-full flex flex-col">
                          <CardHeader>
                            <div className="flex justify-between items-start">
                              <Badge className="mb-2">Module Review</Badge>
                              <span className="text-xs text-muted-foreground">Due Now</span>
                            </div>
                            <CardTitle>{mod.title}</CardTitle>
                            <CardDescription>{mod.description}</CardDescription>
                          </CardHeader>
                          <CardFooter className="mt-auto">
                            <Button className="w-full" onClick={() => startModule(mod)}>
                              Start Module Review
                            </Button>
                          </CardFooter>
                        </Card>
                      </motion.div>
                    );
                  } else if (item.type === 'vocabulary' || item.type === 'grammar') {
                    return (
                      <motion.div key={item.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                        <Card className="border-orange-500/40 bg-orange-500/5 border-2 h-full flex flex-col">
                          <CardHeader>
                            <div className="flex justify-between items-start">
                              <Badge variant="secondary" className="mb-2 uppercase text-[10px]">{item.type} Review</Badge>
                              <span className="text-xs text-muted-foreground">Interval: {item.interval}d</span>
                            </div>
                            <CardTitle className="text-lg">Review: {item.content}</CardTitle>
                            <CardDescription>Practice this specific {item.type} point again.</CardDescription>
                          </CardHeader>
                          <CardFooter className="mt-auto">
                            <Button 
                              variant="outline" 
                              className="w-full border-orange-500/20 text-orange-600 hover:bg-orange-500/10"
                              onClick={() => {
                                // Create a single-question module placeholder for review
                                const reviewModule: Module = {
                                  id: `review-${item.id}`,
                                  language: language!,
                                  level: userLangProgress.overallLevel,
                                  type: item.type === 'vocabulary' ? 'Vocabulary' : 'Grammar',
                                  title: `Review: ${item.content}`,
                                  description: `Specific review session for ${item.content}`,
                                  questions: MODULES.flatMap(m => m.questions).filter(q => q.id === item.id)
                                };
                                if (reviewModule.questions.length > 0) {
                                  startModule(reviewModule);
                                } else {
                                  toast.error("Original question data not found.");
                                }
                              }}
                            >
                              Quick Review
                            </Button>
                          </CardFooter>
                        </Card>
                      </motion.div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          )}
        </TabsContent>

          {['all', 'Listening', 'Speaking', 'Writing', 'Comprehension'].map((tab) => (
            <TabsContent key={tab} value={tab}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {MODULES
                  .filter(m => m.language === language && (tab === 'all' || m.type === tab))
                  .filter(m => m.level === userLangProgress.sectionLevels[m.type])
                    .map((mod) => {
                      const history = userLangProgress.moduleHistory[mod.id];
                      const lastAttempt = history?.[history.length - 1];
                      const isCompleted = userLangProgress.completedModules.includes(mod.id);

                      return (
                        <motion.div key={mod.id} layout>
                          <Card className={`h-full flex flex-col hover:shadow-lg transition-shadow ${isCompleted ? 'border-green-500/20 bg-green-500/5' : 'border-primary/10'}`}>
                            <CardHeader>
                              <div className="flex justify-between items-start mb-2">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                  {mod.type === 'Listening' && <Headphones className="w-5 h-5 text-primary" />}
                                  {mod.type === 'Speaking' && <Mic className="w-5 h-5 text-primary" />}
                                  {mod.type === 'Writing' && <PenTool className="w-5 h-5 text-primary" />}
                                  {mod.type === 'Comprehension' && <BookOpen className="w-5 h-5 text-primary" />}
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <div className="flex gap-2">
                                    {isCompleted && <Badge className="bg-green-500 text-white border-none">Completed</Badge>}
                                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">{mod.type}</Badge>
                                  </div>
                                  <div className="flex flex-col items-end">
                                    <Badge variant="outline" className="text-[10px] border-primary/20">{mod.level}</Badge>
                                    {isCompleted && userLangProgress.srsItems.find(i => i.id === mod.id) && (
                                      <span className="text-[8px] text-muted-foreground mt-1">
                                        Review: {new Date(userLangProgress.srsItems.find(i => i.id === mod.id)!.nextReview).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <CardTitle className="text-xl flex justify-between items-center">
                                {mod.title}
                                {lastAttempt && <span className="text-sm font-black text-primary">{lastAttempt.score}%</span>}
                              </CardTitle>
                              <CardDescription className="line-clamp-2">{mod.description}</CardDescription>
                              
                              <div className="mt-4 space-y-1">
                                <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground">
                                  <span>Streak to Level Up</span>
                                  <span>{userLangProgress.sectionStreaks[mod.type]}/3</span>
                                </div>
                                <Progress value={(userLangProgress.sectionStreaks[mod.type] / 3) * 100} className="h-1" />
                              </div>
                            </CardHeader>
                            <CardFooter className="mt-auto pt-4">
                              <Button className="w-full group" onClick={() => startModule(mod)}>
                                {isCompleted ? 'Practice Again' : 'Start Module'} 
                                <ChevronRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                              </Button>
                            </CardFooter>
                          </Card>
                        </motion.div>
                      );
                    })}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {showLevelUp && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl"
            >
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Trophy className="w-10 h-10 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-3xl font-bold text-primary">Level Up!</h3>
                <p className="text-muted-foreground">
                  You've mastered {showLevelUp.section} at your current level. 
                  Would you like to move up to <span className="font-bold text-primary">{showLevelUp.nextLevel}</span>?
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <Button size="lg" className="w-full text-lg h-14" onClick={handleLevelUp}>
                  Yes, Level Me Up!
                </Button>
                <Button size="lg" variant="ghost" className="w-full" onClick={() => setShowLevelUp(null)}>
                  Not Yet, I Want to Practice More
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    );
  };

  const renderModule = () => {
    if (!currentModule || !language || !currentModuleQuestion) return null;
    const totalSteps = currentModule.questions.length;

    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <div className="flex justify-between items-center mb-6">
          <Button variant="ghost" onClick={() => setCurrentModule(null)} className="text-muted-foreground hover:text-primary">
            <ArrowLeft className="mr-2 w-4 h-4" /> Back to Dashboard
          </Button>
          <Button variant="outline" size="sm" onClick={handleShuffle} className="text-xs">
            Shuffle Questions
          </Button>
        </div>

        <Card className="border-2 border-primary/10 shadow-2xl overflow-hidden">
          {language === 'Malay' && (
            <div className="h-24 relative opacity-80 overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1596422846543-75c6fc18a593?auto=format&fit=crop&w=1200&q=80" 
                alt="Kuala Lumpur" 
                className="w-full h-full object-cover grayscale-[0.2] contrast-125"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                 <Badge className="bg-white/80 text-primary font-black backdrop-blur-sm">MALAY PRACTICE</Badge>
              </div>
            </div>
          )}
          <div className="h-2 bg-muted">
            <motion.div 
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${((moduleStep + 1) / totalSteps) * 100}%` }}
            />
          </div>
          
          <CardHeader className="bg-primary/5 pb-8">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-2">
                <Badge className="bg-primary">{currentModule.type}</Badge>
                <span className="text-sm font-medium opacity-70">Step {moduleStep + 1} of {totalSteps}</span>
              </div>
              <div className="flex items-center space-x-1 text-primary">
                <Trophy className="w-4 h-4" />
                <span className="font-bold">{Math.round(moduleScore)} pts</span>
              </div>
            </div>
            <CardTitle className="text-3xl font-bold leading-tight flex flex-col items-center text-center">
              {language === 'Chinese' && currentModuleQuestion.pinyin && currentModuleQuestion.question.includes('“') ? (
                <div className="flex flex-col items-center space-y-4 w-full">
                  <span className="text-xl opacity-60">{currentModuleQuestion.question.split('“')[0]}</span>
                  <div className="flex flex-col items-center p-8 bg-primary/5 rounded-[2.5rem] border-2 border-primary/10 w-full max-w-2xl">
                    <ChineseRubyText 
                      text={currentModuleQuestion.question.match(/“([^”]+)”/)?.[1] || currentModuleQuestion.question} 
                      pinyin={currentModuleQuestion.pinyin.replace(/[.,!?;:]/g, '')} 
                    />
                  </div>
                  {currentModuleQuestion.question.split('”')[1] && <span className="text-xl opacity-60">{currentModuleQuestion.question.split('”')[1]}</span>}
                </div>
              ) : (
                <>
                  {language === 'Chinese' && currentModuleQuestion.pinyin ? (
                    <ChineseRubyText text={currentModuleQuestion.question} pinyin={currentModuleQuestion.pinyin.replace(/[.,!?;:]/g, '')} />
                  ) : (
                    <span>{currentModuleQuestion.question}</span>
                  )}
                </>
              )}
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-8 space-y-8">
            {(currentModuleQuestion.type === 'Listening' || currentModuleQuestion.type === 'Comprehension' || currentModuleQuestion.type === 'Vocabulary' || currentModuleQuestion.type === 'Grammar') && (
              <div className="flex flex-col items-center space-y-6">
                {currentModuleQuestion.type === 'Listening' && (
                  <>
                    <Button 
                      size="lg" 
                      className="rounded-full w-24 h-24 shadow-lg hover:scale-105 transition-transform"
                      onClick={() => speakText(currentModuleQuestion.audioText || '', language)}
                    >
                      <Play className="w-10 h-10 fill-current" />
                    </Button>
                    <p className="text-muted-foreground font-medium">Click to listen to the audio</p>
                  </>
                )}
                
                <div className={`grid grid-cols-1 ${currentModuleQuestion.type === 'Listening' ? 'sm:grid-cols-2' : ''} gap-4 w-full`}>
                  {shuffledModuleOptions.map((opt) => (
                    <Button 
                      key={opt} 
                      variant="outline" 
                      disabled={!!feedback}
                      className={`h-16 text-lg hover:bg-primary/5 hover:border-primary px-6 ${feedback && opt === currentModuleQuestion.correctAnswer ? 'bg-green-500/10 border-green-500 text-green-700' : feedback && opt !== currentModuleQuestion.correctAnswer ? 'opacity-50' : ''}`}
                      onClick={() => handleItemResult(currentModuleQuestion, opt === currentModuleQuestion.correctAnswer, opt === currentModuleQuestion.correctAnswer ? 100 : 0)}
                    >
                      {opt}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {currentModuleQuestion.type === 'Writing' && (
              <div className="space-y-6">
                <textarea
                  className="w-full min-h-[200px] p-6 rounded-2xl border-2 border-muted focus:border-primary focus:ring-0 transition-all text-lg resize-none bg-muted/20"
                  placeholder="Type your answer here..."
                  value={writingInput}
                  onChange={(e) => setWritingInput(e.target.value)}
                  disabled={isEvaluating || !!feedback}
                />
                {!feedback && (
                  <Button 
                    className="w-full h-14 text-lg font-bold rounded-xl" 
                    onClick={handleModuleStep}
                    disabled={!writingInput || isEvaluating}
                  >
                    {isEvaluating ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
                    Submit for Evaluation
                  </Button>
                )}
              </div>
            )}

            {currentModuleQuestion.type === 'Speaking' && (
              <div className="flex flex-col items-center space-y-8">
                <div className="relative">
                  <AnimatePresence>
                    {isRecording && (
                      <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1.5, opacity: 0.2 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="absolute inset-0 bg-primary rounded-full"
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      />
                    )}
                  </AnimatePresence>
                  <Button 
                    size="lg" 
                    className={`rounded-full w-24 h-24 shadow-xl z-10 relative transition-all ${isRecording ? 'bg-destructive hover:bg-destructive/90' : ''}`}
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isEvaluating || !!feedback}
                  >
                    {isRecording ? <XCircle className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
                  </Button>
                </div>
                
                <div className="text-center space-y-2">
                  <p className="font-bold text-xl">{isRecording ? 'Listening...' : 'Click the mic to speak'}</p>
                  {transcription && (
                    <div className="p-6 bg-muted/50 rounded-2xl border-2 border-dashed border-primary/20 max-w-md italic text-lg">
                      "{transcription}"
                    </div>
                  )}
                </div>

                {!feedback && transcription && (
                  <Button 
                    className="w-full h-14 text-lg font-bold rounded-xl" 
                    onClick={handleModuleStep}
                    disabled={isEvaluating}
                  >
                    {isEvaluating ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
                    Evaluate Pronunciation
                  </Button>
                )}
              </div>
            )}

            {detailedFeedback ? (
              <AIFeedback 
                feedback={detailedFeedback} 
                score={lastScore || 0}
                showRetry={currentModuleQuestion.type === 'Speaking'}
                onRetry={handleRetryStep}
                onContinue={() => {
                  if (moduleScore === -1) {
                    setCurrentModule(null);
                    setDetailedFeedback(null);
                  } else {
                    nextStep();
                  }
                }}
              />
            ) : feedback && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-8 bg-primary/5 rounded-3xl border-2 border-primary/10 space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold text-primary">Evaluation Result</h3>
                  <div className="bg-primary text-primary-foreground rounded-2xl px-4 py-2 flex flex-col items-center justify-center min-w-[80px]">
                    <span className="text-3xl font-black">{lastScore}%</span>
                    <span className="text-[10px] uppercase font-black opacity-70">Score</span>
                  </div>
                </div>
                
                <p className="text-lg leading-relaxed text-muted-foreground italic text-center">"{feedback}"</p>
                
                {currentModuleQuestion.explanation && (
                  <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20">
                    <p className="text-xs font-black uppercase text-primary mb-1 flex items-center gap-1">
                      <Bot className="w-3 h-3" /> Teacher's Explanation
                    </p>
                    <p className="text-sm text-primary/80 leading-relaxed font-medium">
                      {currentModuleQuestion.explanation}
                    </p>
                  </div>
                )}
                
                <div className="flex flex-col sm:flex-row gap-3">
                  {moduleScore !== -1 && currentModuleQuestion.type === 'Speaking' && (
                    <Button 
                      variant="outline" 
                      className="flex-1 h-14 text-lg rounded-xl border-2 font-bold" 
                      onClick={handleRetryStep}
                    >
                      <RefreshCcw className="mr-2 w-5 h-5" /> Try Again
                    </Button>
                  )}
                  <Button className="flex-[2] h-14 text-lg rounded-xl font-bold" onClick={() => {
                    if (moduleScore === -1) {
                      setCurrentModule(null);
                      setDetailedFeedback(null);
                    } else {
                      nextStep();
                    }
                  }}>
                    {moduleScore === -1 ? 'Finish Practice' : 'Continue to Next Step'} <ChevronRight className="ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderFlashcards = () => {
    const currentItem = flashcardSessionItems[flashcardIndex];
    if (!currentItem) return null;

    const findQuestion = () => {
      for (const m of MODULES) {
        const q = m.questions.find(q => q.id === currentItem.id);
        if (q) return q;
      }
      return null;
    };
    const questionData = findQuestion();

    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[150] flex items-center justify-center p-4">
        <div className="max-w-xl w-full space-y-8">
          <div className="flex justify-between items-center text-white">
            <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => setShowFlashcards(false)}>
              <XCircle className="mr-2" /> Exit Session
            </Button>
            <span className="font-bold tracking-widest text-sm uppercase opacity-70">
              Flashcard {flashcardIndex + 1} / {flashcardSessionItems.length}
            </span>
          </div>

          <div className="perspective-1000 h-[400px] w-full cursor-pointer" onClick={() => setIsCardFlipped(!isCardFlipped)}>
            <motion.div 
              className="relative w-full h-full transition-all duration-500 transform-style-3d"
              animate={{ rotateY: isCardFlipped ? 180 : 0 }}
            >
              {/* Front */}
              <div className="absolute inset-0 backface-hidden bg-white rounded-[2.5rem] shadow-2xl flex flex-col items-center justify-center p-12 text-center space-y-6">
                <Badge variant="secondary" className="mb-4 uppercase tracking-tighter">{currentItem.type}</Badge>
                <h3 className="text-4xl font-black text-primary leading-tight">
                  {currentItem.content}
                </h3>
                <p className="text-muted-foreground font-medium animate-pulse">Click to Reveal Answer</p>
              </div>

              {/* Back */}
              <div className="absolute inset-0 backface-hidden bg-primary text-primary-foreground rounded-[2.5rem] shadow-2xl flex flex-col items-center justify-center p-12 text-center space-y-6 rotate-y-180">
                <Badge variant="outline" className="text-white border-white/20 mb-4 uppercase">Correct Answer</Badge>
                <h3 className="text-5xl font-black italic">
                   {questionData?.correctAnswer || "???"}
                </h3>
              </div>
            </motion.div>
          </div>

          <AnimatePresence>
            {isCardFlipped && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-2 gap-4"
              >
                <Button 
                  size="lg" 
                  variant="outline" 
                   className="h-20 text-xl font-bold bg-white/10 text-white border-white/20 hover:bg-destructive shadow-xl"
                   onClick={(e) => { e.stopPropagation(); handleFlashcardResult(false); }}
                >
                  Incorrect
                </Button>
                <Button 
                  size="lg" 
                  className="h-20 text-xl font-bold bg-green-500 hover:bg-green-600 shadow-xl shadow-green-500/20"
                  onClick={(e) => { e.stopPropagation(); handleFlashcardResult(true); }}
                >
                  Correct
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen font-sans selection:bg-primary/20 relative overflow-hidden transition-colors duration-500 ${backgrounds[selectedBg as keyof typeof backgrounds]}`}>
      {showFlashcards && renderFlashcards()}
      {/* Background Decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] animate-pulse ${selectedBg === 'midnight' ? 'bg-blue-500/10' : 'bg-primary/5'}`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] animate-pulse delay-700 ${selectedBg === 'midnight' ? 'bg-purple-500/10' : 'bg-blue-500/5'}`} />
        
        {/* Subtle Grid */}
        <div className={`absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] ${selectedBg === 'midnight' ? 'opacity-20' : ''}`} />
      </div>

      <nav className={`border-b sticky top-0 z-50 transition-colors ${selectedBg === 'midnight' ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 backdrop-blur-md'}`}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => { setLanguage(null); setCurrentModule(null); setShowBreakGame(false); }}>
            <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
              <GraduationCap className="text-white w-6 h-6" />
            </div>
            <span className="text-2xl font-black tracking-tighter text-primary">LingoLeap</span>
          </div>
          
          <div className="flex items-center space-x-4">
            {user ? (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-destructive flex items-center gap-2"
                onClick={handleLogout}
              >
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-black text-primary">
                  {user.displayName?.[0] || 'L'}
                </div>
                <span className="hidden sm:inline">Logout</span>
              </Button>
            ) : (
              <Button 
                variant="outline" 
                size="sm" 
                className="border-primary text-primary hover:bg-primary/5 font-bold rounded-xl"
                onClick={handleLogin}
              >
                Sign In
              </Button>
            )}
            <Button 
               variant="ghost"
               size="sm" 
               className="text-primary font-bold hover:bg-primary/10"
               onClick={() => setLeaderboardOpen({ open: true, lang: language })}
            >
              <Trophy className="mr-2 w-4 h-4" /> Leaderboard
            </Button>
            <Button 
              variant={isAIChatOpen ? "default" : "outline"}
              size="icon" 
              className={`w-12 h-12 rounded-full shadow-lg transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center ${
                isAIChatOpen 
                  ? 'bg-primary ring-4 ring-primary/20 scale-105' 
                  : 'bg-white border-2 border-primary text-primary hover:bg-primary/5 hover:border-primary/80'
              }`}
              onClick={() => setIsAIChatOpen(!isAIChatOpen)}
              title="AI Coach"
            >
              <Bot className={`${isAIChatOpen ? 'w-7 h-7' : 'w-6 h-6'}`} />
            </Button>
            {language && progress[language] && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-primary font-bold hover:bg-primary/10"
                onClick={() => setShowBreakGame(true)}
              >
                <Gamepad2 className="mr-2 w-4 h-4" /> Break Game
              </Button>
            )}
            {language && progress[language] && (
              <div className="hidden md:flex items-center space-x-6">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Overall Level</span>
                  <span className="font-bold text-primary">{progress[language]?.overallLevel}</span>
                </div>
                <div className="h-8 w-[1px] bg-muted" />
                <div className="flex flex-col items-end">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Language</span>
                  <span className="font-bold text-primary">{language}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* AI Assistant Centered Modal */}
      <AnimatePresence>
        {isAIChatOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAIChatOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            />
            
            {/* Chat Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[92%] max-w-[420px] h-[80vh] max-h-[700px] shadow-2xl rounded-[32px] flex flex-col overflow-hidden border ${
                selectedBg === 'midnight' 
                  ? 'bg-slate-900 border-slate-700 text-white' 
                  : 'bg-white border-primary/10 text-foreground'
              }`}
            >
              {/* Header */}
              <div className="p-5 border-b flex justify-between items-center bg-primary/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight">LingoBot</h3>
                    <p className="text-[10px] uppercase tracking-widest font-black opacity-50">Gemini 1.5 Flash</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10" onClick={() => setIsAIChatOpen(false)}>
                  <XCircle className="w-6 h-6" />
                </Button>
              </div>

              {/* Messages Area */}
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-6 pb-20">
                  {aiChatMessages.length === 0 && (
                    <div className="text-center py-12 px-4 space-y-4">
                       <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center mx-auto">
                        <Bot className="w-8 h-8 text-primary/40" />
                       </div>
                       <div className="space-y-1">
                        <p className="font-bold text-base">Hi! I'm your AI Tutor.</p>
                        <p className="text-muted-foreground text-sm max-w-[240px] mx-auto">
                          Ask me anything about {language || 'languages'}! I can explain grammar, translate phrases, or tell you about Malay culture.
                        </p>
                       </div>
                    </div>
                  )}
                  {aiChatMessages.map((msg, i) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      key={i} 
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[88%] p-4 rounded-3xl text-sm leading-relaxed shadow-sm prose prose-sm max-w-none ${
                        msg.role === 'user' 
                          ? 'bg-primary text-white rounded-tr-none px-5' 
                          : selectedBg === 'midnight' 
                            ? 'bg-slate-800 text-white rounded-tl-none border border-slate-700' 
                            : 'bg-muted text-foreground rounded-tl-none border border-primary/5 px-5'
                      }`}>
                        <div className={msg.role === 'user' ? 'text-white' : ''}>
                          <Markdown>
                            {msg.content}
                          </Markdown>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {isAITyping && (
                    <div className="flex justify-start">
                      <div className="bg-muted p-4 rounded-3xl rounded-tl-none border border-primary/5 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span className="text-xs font-bold text-primary/60">LingoBot is thinking...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="p-5 border-t bg-white/50 backdrop-blur-sm">
                <div className="flex gap-3 items-center bg-muted/50 p-1.5 rounded-[24px] border border-primary/10 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                  <Input 
                    placeholder="Ask a question..." 
                    value={aiInput}
                    onChange={(e) => setAIInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAIChat()}
                    className="flex-1 h-12 text-base border-none shadow-none focus-visible:ring-0 bg-transparent px-4"
                  />
                  <Button 
                    size="icon"
                    onClick={handleAIChat} 
                    disabled={isAITyping || !aiInput.trim()}
                    className="w-12 h-12 rounded-full shrink-0 shadow-lg shadow-primary/20"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="pb-20">
        <AnimatePresence mode="wait">
          {showBreakGame && (
            <motion.div key="break" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <BreakGame setShowBreakGame={setShowBreakGame} timeLeft={breakTimeRemaining} />
            </motion.div>
          )}
          {!showBreakGame && !language && !showGeneralDashboard && (
            <motion.div key="lang" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {renderLanguageSelection()}
            </motion.div>
          )}
          {showGeneralDashboard && (
            <motion.div key="general" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {renderGeneralDashboard()}
            </motion.div>
          )}
          {language && !progress[language] && (
            <motion.div key="test" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {renderPlacementTest()}
            </motion.div>
          )}
          {language && progress[language] && !currentModule && (
            <motion.div key="dash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {renderDashboard()}
            </motion.div>
          )}
          {currentModule && (
            <motion.div key="mod" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {renderModule()}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Progress Dashboard Dialog */}
      <Dialog open={showProgressDashboard} onOpenChange={setShowProgressDashboard}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-6 border-b">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-3xl font-black">Learning Analytics</DialogTitle>
                <DialogDescription>Track your proficiency growth across all languages.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="p-6">
              <ProgressDashboard 
                progress={progress} 
                onClose={() => setShowProgressDashboard(false)}
                onAnalyzeProgress={handleAnalyzeProgress}
                aiFeedback={aiFeedback}
                isAnalyzing={isAnalyzingProgress}
              />
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Toaster position="top-center" richColors />

      {/* Leaderboard Modal */}
      <Dialog open={leaderboardOpen.open} onOpenChange={(open) => setLeaderboardOpen(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-md p-0 rounded-[32px] overflow-hidden border-none shadow-2xl">
          <div className="bg-primary p-8 text-white relative">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <Trophy className="w-7 h-7" />
              </div>
              <div>
                <DialogTitle className="text-3xl font-black tracking-tighter">Leaderboard</DialogTitle>
                <DialogDescription className="text-white/60 font-bold uppercase tracking-widest text-[10px]">
                  {leaderboardOpen.lang === 'English' ? 'English' : leaderboardOpen.lang === 'Malay' ? 'Malay' : leaderboardOpen.lang} Rankings
                </DialogDescription>
              </div>
            </div>

            <Tabs value={leaderboardTab} onValueChange={(v) => setLeaderboardTab(v as any)} className="w-full">
              <TabsList className="bg-white/10 p-1 rounded-xl w-full border-none">
                <TabsTrigger value="weekly" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary font-bold">Weekly</TabsTrigger>
                <TabsTrigger value="alltime" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary font-bold">All Time</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <ScrollArea className="h-[450px] bg-white">
            <div className="p-6 space-y-3">
              {isLeaderboardLoading ? (
                <div className="flex flex-col items-center justify-center h-full py-12 space-y-4">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm font-bold text-muted-foreground">Loading top rankings...</p>
                </div>
              ) : liveLeaderboard.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                   <Trophy className="w-12 h-12 text-muted/30 mx-auto" />
                   <p className="text-muted-foreground font-medium">No scores yet. Be the first!</p>
                </div>
              ) : (
                liveLeaderboard.map((entry, index) => {
                  const rank = index + 1;
                  const isTop3 = rank <= 3;
                  const medalColors = { 1: 'bg-yellow-400', 2: 'bg-slate-300', 3: 'bg-amber-600' };

                  return (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      key={entry.id}
                      className={`flex items-center justify-between p-4 rounded-2xl transition-all border ${entry.isMe ? 'bg-primary/5 border-primary/20 shadow-sm' : 'bg-white border-transparent hover:border-muted'}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${isTop3 ? medalColors[rank as keyof typeof medalColors] + ' text-white' : 'bg-muted text-muted-foreground'}`}>
                            {rank}
                          </div>
                          {isTop3 && (
                            <div className="absolute -top-1 -right-1">
                              <Medal className="w-3 h-3 text-white fill-current" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${entry.isMe ? 'bg-primary text-white' : 'bg-muted/50 text-muted-foreground'}`}>
                            {entry.userAvatar || '🎓'}
                          </div>
                          <div>
                            <p className={`font-bold ${entry.isMe ? 'text-primary' : 'text-foreground'}`}>
                              {entry.userName} {entry.isMe && <Badge className="ml-1 text-[8px] h-3 px-1.5 uppercase font-black">You</Badge>}
                            </p>
                            <div className="flex items-center text-[10px] text-muted-foreground font-bold leading-none">
                               <Users className="w-2.5 h-2.5 mr-1" /> {entry.language} Student
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-black text-primary leading-none">{entry.score.toLocaleString()}</div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Points</div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
