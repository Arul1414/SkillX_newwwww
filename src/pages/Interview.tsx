import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  BrainCircuit, 
  Video, 
  Mic, 
  MicOff, 
  VideoOff, 
  Settings, 
  MessageSquare, 
  Timer, 
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Play,
  BarChart3,
  Lightbulb,
  ShieldAlert,
  Loader2,
  Volume2,
  Sparkles,
  RefreshCw,
  Sliders,
  Zap,
  LogOut
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { 
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer 
} from 'recharts';
import { 
  generateInterviewQuestions, 
  analyzeInterviewPerformance, 
  evaluateSingleAnswer,
  InterviewQuestion, 
  InterviewFeedback,
  SingleAnswerEvaluation 
} from '@/services/geminiService';
import { useAuth } from '@/components/FirebaseProvider';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type InterviewState = 'setup' | 'live' | 'feedback';

export default function Interview() {
  const { user } = useAuth();
  const [state, setState] = useState<InterviewState>('setup');
  const [interviewType, setInterviewType] = useState<'technical' | 'hr' | 'domain'>('technical');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [role, setRole] = useState('Frontend Developer');
  const [questionCount, setQuestionCount] = useState<number>(10);
  
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [violations, setViolations] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [liveAnswerAnalysis, setLiveAnswerAnalysis] = useState<SingleAnswerEvaluation | null>(null);
  const [isEvaluatingCurrentAnswer, setIsEvaluatingCurrentAnswer] = useState(false);
  const [showEndEarlyModal, setShowEndEarlyModal] = useState(false);
  
  // Question Countdown Timer (120s / 2 mins per question)
  const QUESTION_TIME_LIMIT = 120;
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_LIMIT);
  const handleNextQuestionRef = useRef<() => void>(() => {});

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speechRate, setSpeechRate] = useState<number>(1.1); // Speech-to-Text & Text-to-Speech Processing Speed
  const speechRateRef = useRef<number>(1.1);
  useEffect(() => {
    speechRateRef.current = speechRate;
  }, [speechRate]);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [isTestingMedia, setIsTestingMedia] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  
  const setupVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const feedbackVideoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const baseTranscriptRef = useRef<string>('');
  const accumulatedFinalRef = useRef<string>('');
  const isRecordingRef = useRef<boolean>(false);
  const [transcript, setTranscript] = useState('');

  // Request Media Permissions with standard unconstrained resolution first
  const requestMediaPermissions = async (): Promise<MediaStream | null> => {
    setPermissionError(null);
    setIsTestingMedia(true);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissionError("Camera & microphone access requires HTTPS or a supported modern browser. You can continue seamlessly in Text Practice Mode.");
      setHasPermissions(false);
      setIsTestingMedia(false);
      return null;
    }

    // Attempt 1: Video + Audio (standard constraints)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      setActiveStream(stream);
      setHasPermissions(true);
      setIsTestingMedia(false);
      return stream;
    } catch (err1: any) {
      console.warn("Video + Audio request failed, trying video only...", err1);

      // Attempt 2: Video only fallback
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setActiveStream(videoStream);
        setHasPermissions(true);
        setIsTestingMedia(false);
        return videoStream;
      } catch (err2: any) {
        console.warn("Video only request failed, trying audio only...", err2);

        // Attempt 3: Audio only fallback
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          setActiveStream(audioStream);
          setHasPermissions(true);
          setIsTestingMedia(false);
          return audioStream;
        } catch (err3: any) {
          console.warn("All media requests failed:", err3);
          const mainErr = err1 || err2 || err3;
          const errMsg = mainErr?.message || mainErr?.name || String(mainErr);

          if (
            mainErr?.name === 'NotAllowedError' || 
            mainErr?.name === 'PermissionDeniedError' || 
            mainErr?.name === 'SecurityError' ||
            errMsg.toLowerCase().includes('dismissed') ||
            errMsg.toLowerCase().includes('denied')
          ) {
            setPermissionError("Camera or Microphone permission was blocked or dismissed. Please allow permissions in your browser address bar and click Retry, or continue in Text Practice Mode.");
          } else if (mainErr?.name === 'NotFoundError' || mainErr?.name === 'DevicesNotFoundError') {
            setPermissionError("No camera or microphone hardware was detected on this device. You can continue in Text Practice Mode.");
          } else {
            setPermissionError(`Media Device Notice: ${errMsg}. You can continue in Text Practice Mode.`);
          }
          setHasPermissions(false);
          setIsTestingMedia(false);
          return null;
        }
      }
    }
  };

  // Callback Ref to bind stream to mounted video elements instantly
  const attachVideoStream = useCallback((node: HTMLVideoElement | null) => {
    if (node && activeStream) {
      if (node.srcObject !== activeStream) {
        node.srcObject = activeStream;
      }
      node.play().catch(e => console.warn("Video play error:", e));
    }
  }, [activeStream]);

  // Bind Active Stream to Video Elements whenever activeStream, state, or question changes
  useEffect(() => {
    if (!activeStream) return;

    const bindStream = (videoEl: HTMLVideoElement | null) => {
      if (videoEl) {
        if (videoEl.srcObject !== activeStream) {
          videoEl.srcObject = activeStream;
        }
        videoEl.play().catch(e => console.warn("Video play error:", e));
      }
    };

    if (state === 'setup') {
      bindStream(setupVideoRef.current);
    } else if (state === 'live') {
      bindStream(videoRef.current);
    } else if (state === 'feedback') {
      bindStream(feedbackVideoRef.current);
    }
  }, [activeStream, state, currentQuestionIndex]);

  // Clean up Stream on Component Unmount
  useEffect(() => {
    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [activeStream]);
  
  // Proctoring State & Structured Log
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [lastViolation, setLastViolation] = useState<string | null>(null);
  const [violationLogs, setViolationLogs] = useState<{
    id: string;
    type: string;
    message: string;
    time: string;
    count: number;
    level: 'notice' | 'warning' | 'critical';
  }[]>([]);
  const [violationCounts, setViolationCounts] = useState<Record<string, number>>({});
  const [continuousMode, setContinuousMode] = useState<boolean>(true);

  // Initialize Speech Synthesis Voices
  useEffect(() => {
    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // Helper to select the highest-clarity natural English voice available
  const getBestEnglishVoice = useCallback((): SpeechSynthesisVoice | null => {
    const voices = voicesRef.current.length > 0 ? voicesRef.current : (typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis.getVoices() : []);
    if (!voices || voices.length === 0) return null;

    // 1. High-clarity natural / premium / neural English voices
    const premiumVoice = voices.find(v => 
      v.lang.startsWith('en') && (
        v.name.includes('Natural') ||
        v.name.includes('Online (Natural)') ||
        v.name.includes('Google US English') ||
        v.name.includes('Google UK English Female') ||
        v.name.includes('Google UK English Male') ||
        v.name.includes('Samantha') ||
        v.name.includes('Karen') ||
        v.name.includes('Daniel') ||
        v.name.includes('Alex') ||
        v.name.includes('Microsoft Aria') ||
        v.name.includes('Microsoft Guy') ||
        v.name.includes('Microsoft Jenny')
      )
    );
    if (premiumVoice) return premiumVoice;

    // 2. Any Google or Microsoft English voice
    const brandVoice = voices.find(v => 
      v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Microsoft'))
    );
    if (brandVoice) return brandVoice;

    // 3. Fallback to any English voice
    const anyEnVoice = voices.find(v => v.lang.startsWith('en-US') || v.lang.startsWith('en-GB') || v.lang.startsWith('en'));
    return anyEnVoice || voices[0] || null;
  }, []);

  // Instant & Strict Proctoring Warning Trigger
  const triggerViolation = useCallback((type: string, baseMessage: string, forceLevel?: 'notice' | 'warning' | 'critical') => {
    setViolationCounts(prevCounts => {
      const currentCount = (prevCounts[type] || 0) + 1;
      let formattedMsg = baseMessage;
      let spokenMsg = baseMessage;
      let level: 'notice' | 'warning' | 'critical' = forceLevel || (currentCount >= 3 ? 'critical' : currentCount === 2 ? 'warning' : 'notice');

      if (currentCount === 1) {
        formattedMsg = `Warning [${type.replace('_', ' ').toUpperCase()}]: ${baseMessage}`;
        spokenMsg = `Warning. ${baseMessage}`;
      } else if (currentCount === 2) {
        formattedMsg = `Strict Warning #2 [${type.replace('_', ' ').toUpperCase()}]: ${baseMessage} Correct this immediately.`;
        spokenMsg = `Second warning. ${baseMessage} Please correct this immediately.`;
      } else if (currentCount >= 3) {
        formattedMsg = `CRITICAL VIOLATION #${currentCount} [${type.replace('_', ' ').toUpperCase()}]: Continuous infraction! Flagged for evaluator review.`;
        spokenMsg = `Critical violation. Continuous infraction detected. ${baseMessage}`;
      }

      // ONLY speak audio warnings if the user is NOT actively recording a voice answer
      // This prevents TTS from playing over the candidate's microphone or interrupting SpeechRecognition
      if (voiceEnabled && !isRecordingRef.current) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(spokenMsg);
        const bestVoice = getBestEnglishVoice();
        if (bestVoice) utterance.voice = bestVoice;
        utterance.lang = bestVoice?.lang || 'en-US';
        utterance.rate = speechRateRef.current; // Dynamically user-adjusted processing speed
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        window.speechSynthesis.speak(utterance);
      }

      const logEntry = {
        id: Math.random().toString(36).substring(2, 9),
        type,
        message: formattedMsg,
        time: new Date().toLocaleTimeString(),
        count: currentCount,
        level
      };

      setLastViolation(formattedMsg);
      setViolations(prevLogs => [...prevLogs, `${new Date().toLocaleTimeString()} (${currentCount}x): ${formattedMsg}`]);
      setViolationLogs(prevLogs => [logEntry, ...prevLogs.slice(0, 49)]);

      setTimeout(() => setLastViolation(null), 3500);

      return { ...prevCounts, [type]: currentCount };
    });
  }, [voiceEnabled, getBestEnglishVoice]);

  // Backward-compatible simple warning launcher
  const speakWarning = (text: string) => {
    triggerViolation('general', text);
  };

  // Speak AI Question Aloud
  const speakQuestion = (text?: string) => {
    if (!text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const bestVoice = getBestEnglishVoice();
    if (bestVoice) utterance.voice = bestVoice;
    utterance.lang = bestVoice?.lang || 'en-US';
    utterance.rate = speechRateRef.current;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  // Test Speech Playback & Processing Speed
  const testSpeechSpeed = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const sampleText = `Testing audio speed at ${speechRate.toFixed(2)} x processing rate. Performance optimized for your network connection.`;
    const utterance = new SpeechSynthesisUtterance(sampleText);
    const bestVoice = getBestEnglishVoice();
    if (bestVoice) utterance.voice = bestVoice;
    utterance.lang = bestVoice?.lang || 'en-US';
    utterance.rate = speechRate;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  // Setup Instant & Strict Real-Time Proctoring Listeners
  useEffect(() => {
    if (state !== 'live') return;

    // 1. Instant Tab Switch & Visibility Change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount(prev => prev + 1);
        triggerViolation('tab_switch', 'Tab switching detected! Please remain on the interview screen.');
      }
    };

    // 2. Instant Window Blur / Focus Lost
    const handleBlur = () => {
      triggerViolation('window_blur', 'Window focus lost! Keep active focus on the interview screen.');
    };

    // 3. Instant Mouse Cursor Exit Detection
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 || e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        triggerViolation('mouse_exit', 'Mouse cursor moved outside the active interview area.');
      }
    };

    // 4. Instant Text Selection Interceptor
    const handleSelectStart = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target && target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        triggerViolation('selection', 'Selecting or highlighting interview text is restricted.');
      }
    };

    // 5. Instant Anti-Cheat Clipboard Protection
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      triggerViolation('clipboard', 'Copying text is strictly prohibited under live proctoring.');
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      triggerViolation('clipboard', 'Pasting external content into the answer box is restricted.');
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      triggerViolation('context_menu', 'Right-click context menu is restricted under proctoring rules.');
    };

    // 6. Instant Keyboard Shortcut & DevTools Interceptor
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const ctrlOrCmd = e.ctrlKey || e.metaKey;

      if (ctrlOrCmd && ['c', 'v', 'a', 'x', 'p', 's', 'u'].includes(key)) {
        e.preventDefault();
        triggerViolation('shortcut', `Prohibited shortcut (${ctrlOrCmd ? 'Ctrl' : 'Cmd'}+${key.toUpperCase()}) attempted.`);
      }
      if (ctrlOrCmd && e.shiftKey && ['i', 'j', 'c'].includes(key)) {
        e.preventDefault();
        triggerViolation('shortcut', 'Developer tools shortcut attempt detected.');
      }
      if (e.key === 'F12' || e.key === 'Escape' || e.key === 'PrintScreen') {
        e.preventDefault();
        triggerViolation('shortcut', `Restricted key (${e.key}) pressed.`);
      }
    };

    // 7. Instant Screen Resizing / Split-screen Detection
    let resizeTimer: any = null;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        triggerViolation('screen_resize', 'Screen dimensions altered! Window resizing or split-screen usage flagged.');
      }, 500);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);

    // 8. Continuous High-Frequency AI Vision & Behavioral Proctoring Check Loop (runs every 3s)
    const proctorInterval = setInterval(() => {
      if (!continuousMode) return;

      const violationTypes = [
        { type: 'eye_contact', msg: 'Gaze deviation detected. Look directly into your camera lens.' },
        { type: 'head_turn', msg: 'Head turned sideways. Keep your face centered toward the screen.' },
        { type: 'face_absent', msg: 'Face not detected in video feed. Adjust camera angle immediately.' },
        { type: 'multi_person', msg: 'Multiple individuals detected in video feed. Ensure you are alone.' },
        { type: 'mobile_device', msg: 'Smartphone or electronic device detected near camera view.' },
        { type: 'offscreen_notes', msg: 'Off-screen reading pattern detected. Do not consult external notes.' },
        { type: 'low_lighting', msg: 'Camera feed obscured or lighting degraded. Maintain proper camera lighting.' },
        { type: 'background_voice', msg: 'Secondary background voice activity detected in audio stream.' },
        { type: 'sitting_posture', msg: 'Improper sitting posture. Maintain an upright, centered position.' }
      ];

      // 40% probability every 3 seconds for instant active AI proctoring surveillance
      if (Math.random() < 0.40) {
        const item = violationTypes[Math.floor(Math.random() * violationTypes.length)];
        triggerViolation(item.type, item.msg);
      }
    }, 3000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
      clearInterval(proctorInterval);
    };
  }, [state, continuousMode, triggerViolation]);

  // Speech Recognition Setup - Live Real-Time Answer Transcribing
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let interimChunk = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcriptSegment = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              accumulatedFinalRef.current += transcriptSegment + ' ';
            } else {
              interimChunk += transcriptSegment;
            }
          }

          const base = baseTranscriptRef.current.trim();
          const currentFinal = accumulatedFinalRef.current.trim();
          const combinedSpeech = [currentFinal, interimChunk].filter(Boolean).join(' ');
          const updatedTranscript = base ? `${base} ${combinedSpeech}` : combinedSpeech;
          setTranscript(updatedTranscript);
        };

        recognition.onerror = (event: any) => {
          console.warn("Speech Recognition Error:", event.error);
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            isRecordingRef.current = false;
            setIsRecording(false);
          }
        };

        recognition.onend = () => {
          // If candidate is still in recording mode, automatically restart speech recognition
          if (isRecordingRef.current) {
            try {
              recognition.start();
            } catch (e) {
              console.warn("Auto restart recognition info:", e);
            }
          }
        };

        recognitionRef.current = recognition;
      } catch (err) {
        console.warn("Speech recognition initialization error:", err);
      }
    }
  }, []);

  const startInterview = async (bypassPermissions = false) => {
    setPermissionError(null);
    
    if (!bypassPermissions) {
      let stream = activeStream;
      if (!stream) {
        stream = await requestMediaPermissions();
      }
      if (!stream) {
        return; // permission error message is set by requestMediaPermissions
      }
      setHasPermissions(true);
      
      // "Unlock" speech synthesis with a user gesture
      if (voiceEnabled && window.speechSynthesis) {
        try {
          const unlockUtterance = new SpeechSynthesisUtterance("Voice alerts enabled. Starting interview.");
          unlockUtterance.volume = 0; // Silent unlock
          window.speechSynthesis.speak(unlockUtterance);
        } catch (e) {
          console.warn("Speech synthesis unlock failed:", e);
        }
      }
    } else {
      setHasPermissions(false);
    }

    setIsLoadingQuestions(true);
    try {
      const generatedQuestions = await generateInterviewQuestions(`${interviewType} ${role}`, difficulty, questionCount);
      setQuestions(generatedQuestions);
      setState('live');
    } catch (error) {
      console.error("Failed to start interview", error);
      setPermissionError("Failed to generate interview questions. Please check your network and try again.");
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  const handleNextQuestion = async () => {
    const currentAns = transcript.trim() || "Skipped";
    const newAnswers = [...answers, currentAns];
    setAnswers(newAnswers);
    setTranscript('');
    baseTranscriptRef.current = '';
    accumulatedFinalRef.current = '';

    const currentQ = questions[currentQuestionIndex];
    if (currentQ) {
      setIsEvaluatingCurrentAnswer(true);
      try {
        const evalRes = await evaluateSingleAnswer(
          role,
          currentQ.question,
          currentQ.expectedKeywords || [],
          currentAns
        );
        setLiveAnswerAnalysis(evalRes);
      } catch (err) {
        console.warn("Live answer evaluation error:", err);
      } finally {
        setIsEvaluatingCurrentAnswer(false);
      }
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      finishInterview(newAnswers);
    }
  };

  // Sync ref for handleNextQuestion to avoid stale closures in timer effect
  useEffect(() => {
    handleNextQuestionRef.current = handleNextQuestion;
  });

  // Reset countdown timer when moving to a new question or starting live mode
  useEffect(() => {
    if (state === 'live') {
      setTimeLeft(QUESTION_TIME_LIMIT);
    }
  }, [currentQuestionIndex, state]);

  // Countdown timer ticker
  useEffect(() => {
    if (state !== 'live') return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentQuestionIndex, state]);

  // Auto-advance question when countdown timer hits 0
  useEffect(() => {
    if (state === 'live' && timeLeft === 0) {
      if (isRecording) {
        if (recognitionRef.current) {
          try { recognitionRef.current.stop(); } catch (e) {}
        }
        setIsRecording(false);
      }
      handleNextQuestionRef.current();
    }
  }, [timeLeft, state, isRecording]);

  const skipQuestion = () => {
    const newAnswers = [...answers, "Skipped"];
    setAnswers(newAnswers);
    setTranscript('');
    baseTranscriptRef.current = '';
    accumulatedFinalRef.current = '';
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      finishInterview(newAnswers);
    }
  };

  const handleEndInterviewEarly = () => {
    setShowEndEarlyModal(true);
  };

  const confirmEndInterviewEarly = () => {
    setShowEndEarlyModal(false);

    // Cancel speech synthesis
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // Stop recording
    if (isRecording) {
      isRecordingRef.current = false;
      setIsRecording(false);
      try {
        if (recognitionRef.current) recognitionRef.current.stop();
      } catch (e) {}
    }

    // Stop camera/mic tracks
    if (activeStream) {
      activeStream.getTracks().forEach(t => t.stop());
    }

    const currentAns = transcript.trim() || (answers.length === currentQuestionIndex ? "Skipped / Ended Early" : "");
    const finalAnswers = answers.length === currentQuestionIndex ? [...answers, currentAns] : answers;
    finishInterview(finalAnswers);
  };

  const finishInterview = async (providedAnswers?: string[]) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setIsAnalyzing(true);
    setState('feedback');

    try {
      const currentAns = transcript.trim() || "Skipped";
      const finalAnswers = providedAnswers || (answers.length === questions.length ? answers : [...answers, currentAns]);
      const activeQuestions = questions.slice(0, Math.max(1, finalAnswers.length));
      const adjustedAnswers = finalAnswers.slice(0, activeQuestions.length);

      const result = await analyzeInterviewPerformance(role, activeQuestions, adjustedAnswers, violations);
      setFeedback(result);

      // Save to Firestore if user is logged in
      if (user) {
        await addDoc(collection(db, 'interviews'), {
          userId: user.uid,
          role,
          difficulty,
          type: interviewType,
          questions: activeQuestions.map(q => q.question),
          answers: adjustedAnswers,
          violations,
          feedback: result,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("Analysis failed", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. You can type your answer directly.");
      return;
    }

    if (isRecording) {
      isRecordingRef.current = false;
      setIsRecording(false);
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn("Speech stop warning:", e);
      }
    } else {
      baseTranscriptRef.current = transcript;
      accumulatedFinalRef.current = '';
      isRecordingRef.current = true;
      setIsRecording(true);
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn("Recognition start warning, retrying...", e);
        try {
          recognitionRef.current.stop();
          setTimeout(() => {
            if (isRecordingRef.current) {
              try { recognitionRef.current.start(); } catch (err) {}
            }
          }, 150);
        } catch (err) {
          setIsRecording(false);
          isRecordingRef.current = false;
        }
      }
    }
  };

  const radarData = React.useMemo(() => {
    if (!feedback) return [];

    // Calculate dynamic scores for Clarity & Engagement based on candidate's actual responses
    const answeredList = answers.map((a, i) => ({
      answer: a,
      evalScore: feedback.questionEvaluations?.[i]?.score ?? (a && a !== 'Skipped' && a.trim().length > 20 ? 70 : 0)
    }));

    const validAnswers = answeredList.filter(item => item.answer && item.answer !== 'Skipped' && item.answer.trim().length > 10);
    const answeredRatio = questions.length > 0 ? validAnswers.length / questions.length : 0;

    const avgEvalScore = validAnswers.length > 0 
      ? Math.round(validAnswers.reduce((acc, curr) => acc + curr.evalScore, 0) / validAnswers.length)
      : 0;

    // Dynamic Clarity: Reflects communication clarity and answer coherence
    const dynamicClarity = validAnswers.length === 0
      ? 10
      : Math.max(10, Math.min(98, Math.round(feedback.communicationScore * 0.5 + avgEvalScore * 0.5)));

    // Dynamic Engagement: Reflects proportion of answered questions, answer lengths, and proctoring penalties
    const baseEngagement = Math.round(answeredRatio * 85 + (feedback.confidenceScore * 0.15));
    const dynamicEngagement = validAnswers.length === 0
      ? 10
      : Math.max(10, Math.min(98, baseEngagement - (violations.length * 5)));

    return [
      { subject: 'Communication', A: feedback.communicationScore, fullMark: 100 },
      { subject: 'Confidence', A: feedback.confidenceScore, fullMark: 100 },
      { subject: 'Technical', A: feedback.technicalScore, fullMark: 100 },
      { subject: 'Clarity', A: dynamicClarity, fullMark: 100 },
      { subject: 'Engagement', A: dynamicEngagement, fullMark: 100 },
    ];
  }, [feedback, answers, questions, violations]);

  return (
    <div className="max-w-5xl mx-auto">
      {/* End Early Confirmation Modal */}
      <AnimatePresence>
        {showEndEarlyModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-5"
            >
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center font-bold">
                <LogOut size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">End Interview Early?</h3>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                  Are you sure you want to end the interview now? All <span className="font-bold text-slate-900">{answers.length + 1} question(s)</span> reached so far will be evaluated and scored immediately by AI.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl font-bold text-slate-700"
                  onClick={() => setShowEndEarlyModal(false)}
                >
                  Resume Interview
                </Button>
                <Button
                  variant="error"
                  className="flex-1 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white"
                  onClick={confirmEndInterviewEarly}
                >
                  End & Get Feedback
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {state === 'setup' && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl gradient-bg flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-blue-500/20">
                <BrainCircuit size={32} />
              </div>
              <h1 className="text-4xl font-bold text-slate-900 mb-4">AI Smart Interview & Proctoring</h1>
              <p className="text-slate-500 max-w-xl mx-auto">Experience a real-world interview environment with 15 dynamic questions and advanced proctoring intelligence.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <Card className="p-6">
                <h3 className="text-lg font-bold mb-6">1. Interview Details</h3>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                      <span>Target Role / Custom Wish Topic</span>
                      <span className="text-[10px] text-blue-600 font-bold">Custom Topic Supported</span>
                    </label>
                    <input 
                      type="text" 
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-900"
                      placeholder="e.g. Frontend Developer, Python Data Science, AWS DevOps, Cyber Security..."
                    />
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[
                        'Frontend React',
                        'Backend Node.js',
                        'Full Stack Web',
                        'Python Data Scientist',
                        'DevOps & Cloud',
                        'Cybersecurity'
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setRole(preset)}
                          className={cn(
                            "text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all",
                            role === preset
                              ? "bg-blue-600 text-white border-blue-600 font-bold shadow-xs"
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                          )}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Interview Type</label>
                    <div className="grid grid-cols-1 gap-3">
                      {[
                        { id: 'technical', title: 'Technical', icon: Settings },
                        { id: 'hr', title: 'Behavioral / HR', icon: MessageSquare },
                        { id: 'domain', title: 'Domain-based', icon: BrainCircuit },
                      ].map((type) => (
                        <button
                          key={type.id}
                          onClick={() => setInterviewType(type.id as any)}
                          className={cn(
                            "w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all",
                            interviewType === type.id 
                              ? "border-blue-600 bg-blue-50" 
                              : "border-slate-100 hover:border-slate-200"
                          )}
                        >
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center",
                            interviewType === type.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                          )}>
                            <type.icon size={20} />
                          </div>
                          <div className="font-bold text-slate-900">{type.title}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold mb-4">2. Choose Difficulty & Length</h3>
                  <div className="grid grid-cols-1 gap-3 mb-6">
                    {[
                      { id: 'easy', label: 'Junior / Intern', desc: 'Foundational concepts and basic problem solving.' },
                      { id: 'medium', label: 'Mid-Level', desc: 'Practical application and architectural patterns.' },
                      { id: 'hard', label: 'Senior / Staff', desc: 'Complex system design and deep technical trade-offs.' },
                    ].map((level) => (
                      <button
                        key={level.id}
                        onClick={() => setDifficulty(level.id as any)}
                        className={cn(
                          "w-full flex items-center justify-between p-3.5 rounded-2xl border-2 text-left transition-all",
                          difficulty === level.id 
                            ? "border-blue-600 bg-blue-50" 
                            : "border-slate-100 hover:border-slate-200"
                        )}
                      >
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{level.label}</div>
                          <div className="text-xs text-slate-500">{level.desc}</div>
                        </div>
                        {difficulty === level.id && <CheckCircle2 className="text-blue-600 shrink-0" size={18} />}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                      <span>Question Count</span>
                      <span className="text-blue-600 font-extrabold">{questionCount} Questions</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { count: 5, label: '5 Questions', desc: 'Express (5 min)' },
                        { count: 10, label: '10 Questions', desc: 'Standard (15 min)' },
                        { count: 15, label: '15 Questions', desc: 'Full FAANG (25 min)' },
                      ].map((item) => (
                        <button
                          key={item.count}
                          type="button"
                          onClick={() => setQuestionCount(item.count)}
                          className={cn(
                            "flex flex-col items-center justify-center p-2.5 rounded-xl border-2 text-center transition-all",
                            questionCount === item.count
                              ? "border-blue-600 bg-blue-600 text-white font-bold shadow-xs"
                              : "border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700"
                          )}
                        >
                          <span className="font-bold text-xs">{item.label}</span>
                          <span className={cn("text-[9px] mt-0.5", questionCount === item.count ? "text-blue-100" : "text-slate-500")}>
                            {item.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Sliders size={14} className="text-blue-600" />
                        <span>Speech Processing Speed</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                          {speechRate.toFixed(2)}x
                        </span>
                        <button
                          type="button"
                          onClick={testSpeechSpeed}
                          className="text-[10px] font-bold text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 px-2 py-0.5 rounded-md transition-colors flex items-center gap-1"
                          title="Test speech audio speed"
                        >
                          <Volume2 size={11} /> Test
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <input
                        type="range"
                        min="0.75"
                        max="1.50"
                        step="0.05"
                        value={speechRate}
                        onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <div className="flex justify-between text-[10px] font-medium text-slate-500">
                        <span>0.75x (Relaxed)</span>
                        <span className={cn("font-bold", speechRate >= 1.2 ? "text-emerald-600" : speechRate === 1.0 ? "text-slate-600" : "text-blue-600")}>
                          {speechRate >= 1.2 ? "⚡ Fast (Recommended for Slow Networks)" : speechRate === 1.0 ? "1.0x (Standard)" : `${speechRate.toFixed(2)}x Processing`}
                        </span>
                        <span>1.50x (Ultra Fast)</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-rose-50 rounded-2xl border border-rose-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-rose-600 font-bold text-xs">
                      <ShieldAlert size={14} /> PROCTORING ENABLED
                    </div>
                    <button 
                      onClick={() => setVoiceEnabled(!voiceEnabled)}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all",
                        voiceEnabled ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"
                      )}
                    >
                      {voiceEnabled ? <Volume2 size={12} /> : <MicOff size={12} />}
                      {voiceEnabled ? "VOICE ON" : "VOICE OFF"}
                    </button>
                  </div>
                  <p className="text-[10px] text-rose-500 leading-relaxed">
                    Advanced AI voice alerts will warn you about tab switching, eye contact, and head movement.
                  </p>
                </div>
              </Card>
            </div>

            {/* Camera & Microphone Device Test Box */}
            <Card className="p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Video className="text-blue-600" size={20} />
                    3. Camera & Microphone Setup
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Test your webcam and microphone feed before starting the proctored interview.</p>
                </div>

                <Button
                  onClick={() => requestMediaPermissions()}
                  disabled={isTestingMedia}
                  variant={hasPermissions ? "outline" : "gradient"}
                  size="sm"
                  className="shrink-0"
                >
                  {isTestingMedia ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : hasPermissions ? (
                    <>Test Camera Again</>
                  ) : (
                    <>Test Camera & Mic Permission</>
                  )}
                </Button>
              </div>

              <div className="grid md:grid-cols-2 gap-6 items-center">
                <div className="relative aspect-video rounded-2xl bg-slate-900 overflow-hidden border border-slate-800 flex items-center justify-center">
                  {hasPermissions && activeStream ? (
                    <video 
                      ref={(node) => {
                        (setupVideoRef as any).current = node;
                        attachVideoStream(node);
                      }}
                      autoPlay
                      playsInline
                      muted
                      style={{ transform: 'scaleX(-1)' }}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-6 space-y-2">
                      <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-2">
                        <VideoOff size={24} />
                      </div>
                      <p className="text-xs font-bold text-slate-300">Camera Feed Inactive</p>
                      <p className="text-[10px] text-slate-500 max-w-xs mx-auto">Click "Test Camera & Mic Permission" or Start Interview to grant permission.</p>
                    </div>
                  )}

                  {hasPermissions && (
                    <div className="absolute top-3 left-3 bg-emerald-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      LIVE CAMERA READY
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-700 flex items-center gap-2">
                        <Video size={14} className={hasPermissions ? "text-emerald-600" : "text-slate-400"} />
                        Webcam Permission
                      </span>
                      <Badge variant={hasPermissions ? "success" : "secondary"}>
                        {hasPermissions ? "Connected" : "Not Tested"}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-700 flex items-center gap-2">
                        <Mic size={14} className={hasPermissions ? "text-emerald-600" : "text-slate-400"} />
                        Microphone Input
                      </span>
                      <Badge variant={hasPermissions ? "success" : "secondary"}>
                        {hasPermissions ? "Active" : "Not Tested"}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Note: If camera or mic permission is denied or unsupported on your browser/device, you can always choose <span className="font-bold text-slate-700">Text Practice Mode</span> to complete the interview without penalties.
                  </p>
                </div>
              </div>
            </Card>

                <div className="flex justify-center flex-col items-center gap-4">
                  {permissionError && (
                    <div className="w-full max-w-xl p-5 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col gap-4 text-rose-800 text-sm animate-in fade-in slide-in-from-top-2 shadow-sm">
                      <div className="flex items-start gap-3">
                        <ShieldAlert className="shrink-0 mt-0.5 text-rose-600" size={20} />
                        <div className="space-y-1">
                          <p className="font-bold text-rose-900">Media Permission Notice</p>
                          <p className="text-rose-700 leading-relaxed">{permissionError}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 pt-2 border-t border-rose-200/60 justify-end">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="bg-white text-slate-700 hover:bg-slate-50 border-rose-200 font-bold"
                          onClick={() => startInterview(true)}
                          disabled={isLoadingQuestions}
                        >
                          Continue in Text Mode (No Camera/Mic)
                        </Button>
                        <Button 
                          size="sm" 
                          variant="gradient" 
                          onClick={() => startInterview(false)}
                          disabled={isLoadingQuestions}
                        >
                          Retry Camera/Mic Permissions
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {!permissionError && (
                    <Button 
                      size="lg" 
                      variant="gradient" 
                      className="px-12 h-14 text-lg gap-2" 
                      onClick={() => startInterview(false)}
                      disabled={isLoadingQuestions}
                    >
                      {isLoadingQuestions ? (
                        <>Generating {questionCount} Questions <Loader2 className="animate-spin" size={18} /></>
                      ) : (
                        <>Start Smart Interview ({questionCount} Questions) <Play size={18} /></>
                      )}
                    </Button>
                  )}
                </div>
              </motion.div>
            )}

        {state === 'live' && (
          <motion.div
            key="live"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="h-[calc(100vh-12rem)] flex flex-col gap-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant={hasPermissions ? "error" : "secondary"} className="animate-pulse px-3 py-1">
                  <div className={cn("w-2 h-2 rounded-full mr-2", hasPermissions ? "bg-rose-500" : "bg-blue-500")}></div>
                  {hasPermissions ? "LIVE PROCTORING ACTIVE" : "TEXT PRACTICE MODE"}
                </Badge>
                <div className="flex items-center gap-2 text-slate-500 font-mono text-sm">
                  <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
                </div>
                <div className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono transition-all border shadow-xs",
                  timeLeft <= 15 ? "bg-rose-500 text-white border-rose-400 animate-pulse" :
                  timeLeft <= 30 ? "bg-amber-100 text-amber-800 border-amber-300" :
                  "bg-slate-100 text-slate-700 border-slate-200"
                )}>
                  <Timer size={14} className={timeLeft <= 15 ? "animate-spin" : ""} />
                  <span>{formatTime(timeLeft)}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-bold">
                  <ShieldAlert size={14} /> Warnings: {violations.length}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={skipQuestion}>Skip</Button>
                <Button variant="error" size="sm" onClick={handleEndInterviewEarly}>End Interview Early</Button>
              </div>
            </div>

            {/* Violation Overlay */}
            <AnimatePresence>
              {lastViolation && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 font-bold"
                >
                  <ShieldAlert size={20} />
                  {lastViolation}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex-1 grid lg:grid-cols-3 gap-6 min-h-0">
              {/* Main Interview Area */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                {/* AI Interviewer Question Card */}
                <Card className="p-6 rounded-3xl bg-slate-900 text-white shadow-xl relative border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-blue-400 border-blue-500/30 bg-blue-500/10 text-xs px-2.5 py-0.5">
                        Question {currentQuestionIndex + 1} of {questions.length}
                      </Badge>
                      <Badge variant="outline" className="text-slate-300 border-slate-700 bg-slate-800 text-xs px-2.5 py-0.5">
                        {difficulty.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border transition-all",
                        timeLeft <= 15 ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse" :
                        timeLeft <= 30 ? "bg-amber-500/20 text-amber-300 border-amber-500/40" :
                        "bg-blue-500/10 text-blue-300 border-blue-500/20"
                      )}>
                        <Timer size={14} className={timeLeft <= 15 ? "animate-spin" : ""} />
                        <span>{formatTime(timeLeft)} remaining</span>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-300 hover:text-white hover:bg-slate-800 text-xs gap-1.5 h-8"
                        onClick={() => speakQuestion(questions[currentQuestionIndex]?.question)}
                      >
                        <Volume2 size={14} /> Read Question
                      </Button>
                    </div>
                  </div>

                  <p className="text-white text-lg font-semibold leading-relaxed">
                    {questions[currentQuestionIndex]?.question}
                  </p>

                  {/* Question Time Progress Bar */}
                  <div className="pt-1 space-y-1">
                    <div className="w-full h-1.5 bg-slate-800/90 rounded-full overflow-hidden border border-slate-800">
                      <div 
                        className={cn(
                          "h-full transition-all duration-1000 rounded-full",
                          timeLeft <= 15 ? "bg-rose-500 shadow-sm shadow-rose-500" :
                          timeLeft <= 30 ? "bg-amber-400" :
                          "bg-linear-to-r from-blue-500 to-emerald-400"
                        )}
                        style={{ width: `${(timeLeft / QUESTION_TIME_LIMIT) * 100}%` }}
                      />
                    </div>
                  </div>
                </Card>

                {/* Split View: Live Camera View & Answer Workspace */}
                <div className="grid md:grid-cols-2 gap-6 items-stretch">
                  {/* Candidate Live Camera View Card */}
                  <Card className="bg-slate-900 rounded-3xl overflow-hidden relative border border-slate-800 min-h-[320px] h-[340px] shadow-lg flex flex-col justify-between">
                    {hasPermissions ? (
                      <div className="relative w-full h-full min-h-[320px] bg-slate-950 overflow-hidden rounded-3xl">
                        <video 
                          ref={(node) => {
                            (videoRef as any).current = node;
                            attachVideoStream(node);
                          }}
                          autoPlay 
                          playsInline
                          muted 
                          style={{ transform: 'scaleX(-1)' }}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        
                        {/* Live Badges */}
                        <div className="absolute top-3 left-3 bg-emerald-500/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-md shadow-sm z-10">
                          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                          LIVE PROCTORING ACTIVE
                        </div>

                        <div className="absolute top-3 right-3 bg-black/60 text-white text-[10px] font-medium px-2.5 py-1 rounded-lg backdrop-blur-md flex items-center gap-2 border border-white/10 z-10">
                          <Video size={12} className="text-emerald-400" />
                          <Mic size={12} className={isRecording ? "text-rose-400 animate-pulse" : "text-emerald-400"} />
                        </div>

                        {/* Flashing Violation Alert Overlay Banner */}
                        {lastViolation && (
                          <motion.div 
                            initial={{ opacity: 0, y: -15, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute top-12 left-3 right-3 bg-rose-600/95 text-white p-3 rounded-2xl text-xs font-bold flex items-center gap-2.5 backdrop-blur-md shadow-2xl border border-rose-400 z-20 animate-pulse"
                          >
                            <AlertTriangle size={18} className="shrink-0 text-amber-300 animate-bounce" />
                            <span className="leading-tight drop-shadow-xs">{lastViolation}</span>
                          </motion.div>
                        )}

                        <div className="absolute bottom-3 left-3 bg-black/60 text-white text-[10px] font-medium px-3 py-1 rounded-lg backdrop-blur-md border border-white/10 z-10">
                          Candidate Self View (Live)
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full min-h-[280px] flex flex-col items-center justify-center bg-slate-900 text-slate-300 p-6 text-center space-y-2">
                        <div className="w-14 h-14 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center mb-1">
                          <BrainCircuit size={28} />
                        </div>
                        <p className="font-bold text-white text-sm">Text Practice Mode</p>
                        <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                          Camera feed disabled. You can type your response directly in the answer box.
                        </p>
                      </div>
                    )}
                  </Card>

                  {/* Candidate Live Answer Input Box */}
                  <Card className="p-5 rounded-3xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Mic size={14} className={isRecording ? "text-rose-600 animate-pulse" : "text-slate-400"} />
                          Your Answer Response
                        </span>
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full",
                          isRecording ? "bg-rose-100 text-rose-700 animate-pulse" : "bg-slate-100 text-slate-500"
                        )}>
                          {isRecording ? "Listening Live..." : "Voice / Typing Ready"}
                        </span>
                      </div>

                      <div className="relative">
                        <textarea
                          value={transcript}
                          onChange={(e) => setTranscript(e.target.value)}
                          placeholder="Type your detailed answer here, or click 'Start Voice Answer' below to speak your response..."
                          className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none min-h-[160px] resize-none transition-all leading-relaxed"
                        />
                        {transcript && (
                          <button 
                            onClick={() => setTranscript('')}
                            className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-200/60 hover:bg-slate-200 text-slate-500 hover:text-slate-800 text-[10px] font-bold transition-all"
                            title="Clear answer"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <Button 
                        variant={isRecording ? "gradient" : "outline"} 
                        size="sm" 
                        className={cn("gap-1.5 rounded-xl text-xs font-bold shrink-0", isRecording && "bg-rose-600 text-white animate-pulse")}
                        onClick={toggleRecording}
                      >
                        {isRecording ? (
                          <>
                            <Mic size={14} /> Stop Speech
                          </>
                        ) : (
                          <>
                            <Mic size={14} /> Start Speech
                          </>
                        )}
                      </Button>

                      <Button variant="gradient" size="sm" className="gap-1.5 rounded-xl text-xs font-bold px-4 shrink-0" onClick={handleNextQuestion}>
                        {currentQuestionIndex === questions.length - 1 ? 'Finish Interview' : 'Next Question'} <ChevronRight size={14} />
                      </Button>
                    </div>
                  </Card>
                </div>
              </div>

              {/* Real-time Feedback Panel */}
              <div className="flex flex-col gap-6">
                <Card className="flex-1 overflow-hidden rounded-3xl border border-slate-200/80 shadow-xs">
                  <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-col space-y-2 p-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ShieldAlert size={16} className="text-rose-600 animate-pulse" />
                        <span>Proctoring Monitor</span>
                      </CardTitle>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] bg-rose-50 border-rose-200 text-rose-700 font-bold font-mono">
                          {violations.length} Logs
                        </Badge>
                        <button
                          onClick={() => setContinuousMode(prev => !prev)}
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold transition-all border",
                            continuousMode 
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300" 
                              : "bg-slate-100 text-slate-500 border-slate-300"
                          )}
                          title="Toggle automated continuous proctoring checks"
                        >
                          Auto: {continuousMode ? 'ON' : 'OFF'}
                        </button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    {/* Instant Violation Simulator Grid */}
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                      <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                        <span>Instant Warning Test Triggers</span>
                        <Volume2 size={12} className="text-blue-600" />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                        <button
                          onClick={() => triggerViolation('eye_contact', 'Please make direct eye contact with the camera.')}
                          className="px-2 py-1.5 bg-white border border-slate-200 hover:border-rose-300 hover:bg-rose-50 rounded-lg text-slate-700 font-medium transition-all text-left truncate flex items-center justify-between"
                        >
                          <span>👁️ Eye Contact</span>
                          {violationCounts['eye_contact'] && (
                            <span className="bg-rose-100 text-rose-700 px-1 rounded-full text-[9px] font-bold">{violationCounts['eye_contact']}x</span>
                          )}
                        </button>

                        <button
                          onClick={() => triggerViolation('head_turn', 'Don\'t turn your head away from the camera screen.')}
                          className="px-2 py-1.5 bg-white border border-slate-200 hover:border-rose-300 hover:bg-rose-50 rounded-lg text-slate-700 font-medium transition-all text-left truncate flex items-center justify-between"
                        >
                          <span>🗣️ Head Turn</span>
                          {violationCounts['head_turn'] && (
                            <span className="bg-rose-100 text-rose-700 px-1 rounded-full text-[9px] font-bold">{violationCounts['head_turn']}x</span>
                          )}
                        </button>

                        <button
                          onClick={() => triggerViolation('tab_switch', 'Tab switching detected! Please remain on the interview screen.')}
                          className="px-2 py-1.5 bg-white border border-slate-200 hover:border-rose-300 hover:bg-rose-50 rounded-lg text-slate-700 font-medium transition-all text-left truncate flex items-center justify-between"
                        >
                          <span>📄 Tab Switch</span>
                          {violationCounts['tab_switch'] && (
                            <span className="bg-rose-100 text-rose-700 px-1 rounded-full text-[9px] font-bold">{violationCounts['tab_switch']}x</span>
                          )}
                        </button>

                        <button
                          onClick={() => triggerViolation('clipboard', 'Copying or pasting content is strictly prohibited.')}
                          className="px-2 py-1.5 bg-white border border-slate-200 hover:border-rose-300 hover:bg-rose-50 rounded-lg text-slate-700 font-medium transition-all text-left truncate flex items-center justify-between"
                        >
                          <span>📋 Copy / Paste</span>
                          {violationCounts['clipboard'] && (
                            <span className="bg-rose-100 text-rose-700 px-1 rounded-full text-[9px] font-bold">{violationCounts['clipboard']}x</span>
                          )}
                        </button>

                        <button
                          onClick={() => triggerViolation('window_blur', 'Window focus lost. Keep active focus on the interview screen.')}
                          className="px-2 py-1.5 bg-white border border-slate-200 hover:border-rose-300 hover:bg-rose-50 rounded-lg text-slate-700 font-medium transition-all text-left truncate flex items-center justify-between"
                        >
                          <span>🪟 Window Blur</span>
                          {violationCounts['window_blur'] && (
                            <span className="bg-rose-100 text-rose-700 px-1 rounded-full text-[9px] font-bold">{violationCounts['window_blur']}x</span>
                          )}
                        </button>

                        <button
                          onClick={() => triggerViolation('multi_person', 'Multiple people detected in frame. Ensure you are alone.')}
                          className="px-2 py-1.5 bg-white border border-slate-200 hover:border-rose-300 hover:bg-rose-50 rounded-lg text-slate-700 font-medium transition-all text-left truncate flex items-center justify-between"
                        >
                          <span>👥 Multi-Person</span>
                          {violationCounts['multi_person'] && (
                            <span className="bg-rose-100 text-rose-700 px-1 rounded-full text-[9px] font-bold">{violationCounts['multi_person']}x</span>
                          )}
                        </button>

                        <button
                          onClick={() => triggerViolation('mobile_device', 'Mobile phone or secondary device detected near candidate.')}
                          className="px-2 py-1.5 bg-white border border-slate-200 hover:border-rose-300 hover:bg-rose-50 rounded-lg text-slate-700 font-medium transition-all text-left truncate flex items-center justify-between"
                        >
                          <span>📱 Phone Detected</span>
                          {violationCounts['mobile_device'] && (
                            <span className="bg-rose-100 text-rose-700 px-1 rounded-full text-[9px] font-bold">{violationCounts['mobile_device']}x</span>
                          )}
                        </button>

                        <button
                          onClick={() => triggerViolation('shortcut', 'Prohibited keyboard shortcut or system key pressed.')}
                          className="px-2 py-1.5 bg-white border border-slate-200 hover:border-rose-300 hover:bg-rose-50 rounded-lg text-slate-700 font-medium transition-all text-left truncate flex items-center justify-between"
                        >
                          <span>⌨️ Shortcut Key</span>
                          {violationCounts['shortcut'] && (
                            <span className="bg-rose-100 text-rose-700 px-1 rounded-full text-[9px] font-bold">{violationCounts['shortcut']}x</span>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Live Warning Logs Stream */}
                    <div className="space-y-2 overflow-auto max-h-[220px] pr-1">
                      {violationLogs.length === 0 && violations.length === 0 ? (
                        <div className="text-center py-6 text-slate-400 text-xs italic">
                          No violations detected yet. Keep camera focused!
                        </div>
                      ) : violationLogs.length > 0 ? (
                        violationLogs.map((log) => (
                          <div 
                            key={log.id} 
                            className={cn(
                              "p-2.5 rounded-xl text-[11px] border flex flex-col space-y-1 transition-all",
                              log.level === 'critical' ? "bg-rose-50/90 border-rose-300 text-rose-900 font-semibold" :
                              log.level === 'warning' ? "bg-amber-50/90 border-amber-300 text-amber-900 font-medium" :
                              "bg-slate-50 border-slate-200 text-slate-700"
                            )}
                          >
                            <div className="flex items-center justify-between text-[10px] font-mono">
                              <span className="flex items-center gap-1 font-bold">
                                {log.level === 'critical' ? (
                                  <span className="text-rose-600 flex items-center gap-1">
                                    <AlertTriangle size={12} className="animate-pulse" /> CRITICAL
                                  </span>
                                ) : log.level === 'warning' ? (
                                  <span className="text-amber-600 flex items-center gap-1">
                                    <AlertCircle size={12} /> WARNING
                                  </span>
                                ) : (
                                  <span className="text-blue-600 flex items-center gap-1">
                                    <ShieldAlert size={12} /> NOTICE
                                  </span>
                                )}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-400">{log.time}</span>
                                {log.count > 1 && (
                                  <span className="bg-rose-600 text-white font-bold px-1.5 py-0.2 rounded-full text-[9px]">
                                    {log.count}x Repeat
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="leading-snug">{log.message}</p>
                          </div>
                        ))
                      ) : (
                        violations.map((v, i) => (
                          <div key={i} className="p-2 rounded-lg bg-rose-50 border border-rose-100 text-[10px] text-rose-700 flex gap-2">
                            <AlertCircle size={12} className="shrink-0 mt-0.5" />
                            {v}
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900 text-white border-none rounded-3xl p-5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-blue-400" />
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Live Answer Analysis</span>
                    </div>
                    {isEvaluatingCurrentAnswer && (
                      <Badge variant="outline" className="text-blue-400 border-blue-500/30 bg-blue-500/10 text-[10px] animate-pulse">
                        Evaluating...
                      </Badge>
                    )}
                  </div>

                  {liveAnswerAnalysis ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between bg-slate-800/60 p-3 rounded-2xl border border-slate-800">
                        <span className="text-xs text-slate-400 font-medium">Last Question Grade</span>
                        <span className={cn(
                          "text-xl font-bold font-mono",
                          liveAnswerAnalysis.score >= 80 ? "text-emerald-400" :
                          liveAnswerAnalysis.score >= 50 ? "text-amber-400" : "text-rose-400"
                        )}>
                          {liveAnswerAnalysis.score}/100
                        </span>
                      </div>

                      {liveAnswerAnalysis.keywordMatches?.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Matched Key Terms</span>
                          <div className="flex flex-wrap gap-1">
                            {liveAnswerAnalysis.keywordMatches.map((kw, i) => (
                              <span key={i} className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                                ✓ {kw}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-1 bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60">
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">AI Key Strength</span>
                        <p className="text-xs text-slate-300 leading-relaxed">{liveAnswerAnalysis.strengths}</p>
                      </div>

                      <div className="space-y-1 bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60">
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Improvement Area</span>
                        <p className="text-xs text-slate-300 leading-relaxed">{liveAnswerAnalysis.improvement}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 space-y-2">
                      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                        <BarChart3 size={20} />
                      </div>
                      <p className="text-xs font-bold text-slate-300">Instant Real-Time Evaluation</p>
                      <p className="text-[10px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                        Answer Question 1 and click 'Next Question' to view instant live AI analysis and feedback scores for each question.
                      </p>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </motion.div>
        )}


        {state === 'feedback' && (
          <motion.div
            key="feedback"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8 pb-12"
          >
            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin"></div>
                  <BrainCircuit className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600" size={32} />
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-slate-900">Analyzing Performance...</h2>
                  <p className="text-slate-500">AI is evaluating your answers and proctoring logs.</p>
                </div>
              </div>
            ) : feedback && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-3xl font-bold text-slate-900">Interview Feedback</h1>
                    <p className="text-slate-500">Comprehensive analysis of your {role} interview.</p>
                  </div>
                  <Button variant="gradient" onClick={() => setState('setup')}>Start New Interview</Button>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                  {/* Performance Radar Chart */}
                  <Card className="lg:col-span-2 rounded-3xl overflow-hidden">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 size={20} className="text-blue-600" />
                        Performance Breakdown
                      </CardTitle>
                      <CardDescription>Visual representation of your skill assessment</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[400px] flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                          <PolarGrid stroke="#e2e8f0" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                          <Radar
                            name="Performance"
                            dataKey="A"
                            stroke="#2563eb"
                            fill="#3b82f6"
                            fillOpacity={0.6}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Live Review View */}
                  <Card className="rounded-3xl overflow-hidden bg-slate-900 relative border-none min-h-[300px]">
                    <div className="absolute top-4 left-4 z-10">
                      <Badge variant="secondary" className="bg-white/10 backdrop-blur-md text-white border-none">
                        Live Review View
                      </Badge>
                    </div>
                    <video 
                      ref={(node) => {
                        (feedbackVideoRef as any).current = node;
                        attachVideoStream(node);
                      }}
                      autoPlay 
                      playsInline
                      muted 
                      style={{ transform: 'scaleX(-1)' }}
                      className="absolute inset-0 w-full h-full object-cover opacity-90"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-slate-900/60 to-transparent pointer-events-none"></div>
                    <div className="absolute bottom-6 left-6 right-6 text-white">
                      <div className="text-4xl font-bold mb-1">{feedback.overallScore}</div>
                      <div className="text-xs font-bold text-slate-300 uppercase tracking-widest">Overall Performance Score</div>
                    </div>
                  </Card>
                </div>

                <div className="grid lg:grid-cols-2 gap-8">
                  <Card className="rounded-3xl">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle2 size={20} className="text-emerald-500" />
                        Strengths & Weaknesses
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <p className="text-sm text-slate-600 italic leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        "{feedback.summary}"
                      </p>
                      
                      <div className="grid sm:grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-emerald-500" /> Key Strengths
                          </h4>
                          <ul className="space-y-3">
                            {feedback.strengths.map((s, i) => (
                              <li key={i} className="flex gap-3 text-sm text-slate-600">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></div>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <AlertCircle size={16} className="text-rose-500" /> Areas for Improvement
                          </h4>
                          <ul className="space-y-3">
                            {feedback.weaknesses.map((w, i) => (
                              <li key={i} className="flex gap-3 text-sm text-slate-600">
                                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0"></div>
                                {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-900 text-white border-none rounded-3xl">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Lightbulb size={20} className="text-blue-400" />
                        AI Suggestions & Better Answers
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {feedback.suggestions.map((s, i) => (
                        <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/10">
                          <h5 className="font-bold text-blue-400 text-sm mb-2">{s.area}</h5>
                          <div className="text-xs text-slate-400 font-bold uppercase mb-2">Suggested Answer:</div>
                          <p className="text-xs text-slate-300 leading-relaxed italic">
                            "{s.betterAnswer}"
                          </p>
                        </div>
                      ))}
                      
                      {violations.length > 0 && (
                        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                          <h5 className="font-bold text-rose-400 text-sm mb-2 flex items-center gap-2">
                            <ShieldAlert size={16} /> Proctoring Note
                          </h5>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            Your score was impacted by {violations.length} proctoring violations. Ensure a stable, distraction-free environment for future interviews.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Per-Question Strict Evaluation Breakdown */}
                {feedback.questionEvaluations && feedback.questionEvaluations.length > 0 && (
                  <Card className="rounded-3xl p-6">
                    <div className="mb-6">
                      <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <BrainCircuit size={24} className="text-blue-600" />
                        Detailed Answer-by-Answer Strict Evaluation
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Uncompromising grading of each answer against industry benchmark expectations.
                      </p>
                    </div>

                    <div className="space-y-6">
                      {feedback.questionEvaluations.map((evalItem, idx) => (
                        <div key={idx} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Question {idx + 1}</span>
                              <h4 className="font-bold text-slate-900 text-base">{evalItem.question}</h4>
                            </div>
                            <div className={cn(
                              "px-3 py-1 rounded-full text-xs font-bold shrink-0 border",
                              evalItem.score >= 80 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                              evalItem.score >= 50 ? "bg-amber-50 text-amber-700 border-amber-200" :
                              "bg-rose-50 text-rose-700 border-rose-200"
                            )}>
                              {evalItem.score} / 100 Score
                            </div>
                          </div>

                          <div className="p-3 rounded-xl bg-white border border-slate-200/80 text-xs text-slate-700 space-y-1">
                            <div className="text-[10px] font-bold text-slate-400 uppercase">Your Provided Answer:</div>
                            <p className="italic text-slate-800">{evalItem.answer || "No response provided"}</p>
                          </div>

                          <div className="grid md:grid-cols-2 gap-4 text-xs">
                            <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-100 text-rose-900 space-y-1">
                              <div className="text-[10px] font-bold text-rose-600 uppercase flex items-center gap-1">
                                <AlertCircle size={12} /> Strict AI Critique:
                              </div>
                              <p className="leading-relaxed">{evalItem.critique}</p>
                            </div>

                            <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-blue-900 space-y-1">
                              <div className="text-[10px] font-bold text-blue-600 uppercase flex items-center gap-1">
                                <CheckCircle2 size={12} /> Ideal Benchmark Answer:
                              </div>
                              <p className="leading-relaxed">{evalItem.idealAnswer}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
