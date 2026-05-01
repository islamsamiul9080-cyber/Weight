import React, { useState, useEffect, useRef } from 'react';
import { 
  Dumbbell, 
  Timer, 
  LineChart as LucideLineChart, 
  MessageSquare, 
  Play, 
  Pause, 
  RotateCcw, 
  ChevronRight, 
  Flame, 
  TrendingUp, 
  Calendar,
  X,
  Send,
  User as UserIcon,
  Bot,
  LogOut,
  Upload,
  Video,
  Trash2,
  ShieldCheck,
  Search,
  Plus,
  PlusCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart as ReChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { GoogleGenAI } from "@google/genai";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Firebase imports
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signInAnonymously, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  doc,
  deleteDoc,
  getDoc,
  getDocFromServer,
  setDoc,
  Timestamp
} from 'firebase/firestore';
import { auth, db, googleProvider } from './lib/firebase';

// Connection check logic moved inside App component

/** Utility for Tailwind class merging */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

type View = 'dashboard' | 'library' | 'progress' | 'transformation';

interface Media {
  id: string;
  type: 'image' | 'video';
  url: string;
  title: string;
  description: string;
  uploadedBy: string;
  createdAt: Timestamp | any;
}

interface Exercise {
  id: string;
  name: string;
  category: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
  image: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Mock Data ---

const EXERCISES: Exercise[] = [
  { id: '1', name: 'Barbell Squat', category: 'Legs', level: 'Intermediate', description: 'Core exercise for building lower body strength and mass.', image: 'https://images.unsplash.com/photo-1574673139762-014a1efefc31?auto=format&fit=crop&q=80&w=400' },
  { id: '2', name: 'Bench Press', category: 'Chest', level: 'Intermediate', description: 'Classic upper body exercise focusing on pectorals and triceps.', image: 'https://images.unsplash.com/photo-1534367507873-d2d7e24c797f?auto=format&fit=crop&q=80&w=400' },
  { id: '3', name: 'Deadlift', category: 'Back', level: 'Advanced', description: 'Ultimate full-body strength builder targeting the posterior chain.', image: 'https://images.unsplash.com/photo-1603503364444-8df65406439f?auto=format&fit=crop&q=80&w=400' },
  { id: '4', name: 'Pull-ups', category: 'Back', level: 'Intermediate', description: 'Bodyweight staple for upper body width and strength.', image: 'https://images.unsplash.com/photo-1598971639058-aba7c02b36f7?auto=format&fit=crop&q=80&w=400' },
  { id: '5', name: 'Dumbbell Lunge', category: 'Legs', level: 'Beginner', description: 'Unilateral leg training for balance and muscle growth.', image: 'https://images.unsplash.com/photo-1434608519344-49d77a699e1d?auto=format&fit=crop&q=80&w=400' },
];

const PROGRESS_DATA = [
  { day: 'Mon', weight: 78.5, volume: 12000 },
  { day: 'Tue', weight: 78.2, volume: 13500 },
  { day: 'Wed', weight: 78.1, volume: 0 },
  { day: 'Thu', weight: 78.3, volume: 15000 },
  { day: 'Fri', weight: 77.9, volume: 11000 },
  { day: 'Sat', weight: 77.6, volume: 16500 },
  { day: 'Sun', weight: 77.8, volume: 0 },
];

// --- Components ---

const WorkoutTimer = () => {
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [duration, setDuration] = useState(60); 

  useEffect(() => {
    let interval: number | undefined;
    if (isActive && seconds < duration) {
      interval = window.setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } else if (seconds >= duration) {
      setIsActive(false);
    }
    return () => clearInterval(interval);
  }, [isActive, seconds, duration]);

  const toggle = () => setIsActive(!isActive);
  const reset = () => {
    setSeconds(0);
    setIsActive(false);
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = (seconds / duration) * 100;

  return (
    <div className="bg-bg-card p-6 rounded-2xl border border-border-medium shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg uppercase tracking-wider flex items-center gap-2 text-brand-primary">
          <Timer size={20} />
          Set Timer
        </h3>
        <span className="text-xs font-mono text-text-muted uppercase">GOAL: {formatTime(duration)}</span>
      </div>

      <div className="relative h-2 bg-black/40 rounded-full mb-6 overflow-hidden">
        <motion.div 
          className="absolute top-0 left-0 h-full bg-brand-primary shadow-[0_0_10px_rgba(99,102,241,0.5)]"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
        />
      </div>

      <div className="text-5xl font-mono font-black text-center mb-6 tracking-tighter text-text-primary">
        {formatTime(seconds)}
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
        {[30, 60, 120, 180, 300].map((d) => (
          <button
            key={d}
            onClick={() => { setDuration(d); reset(); }}
            className={cn(
              "flex-1 text-[10px] font-bold py-1.5 px-3 rounded-lg border transition-all truncate",
              duration === d 
                ? "bg-brand-primary text-white border-brand-primary" 
                : "bg-white/5 text-text-secondary border-border-subtle hover:border-text-muted"
            )}
          >
            {d >= 60 ? `${d/60}m` : `${d}s`}
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        <button 
          onClick={toggle}
          className={cn(
            "flex-1 py-3 rounded-xl font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all",
            isActive ? "bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]" : "bg-brand-primary text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]"
          )}
        >
          {isActive ? <Pause size={18} /> : <Play size={18} />}
          {isActive ? 'Pause' : 'Start'}
        </button>
        <button 
          onClick={reset}
          className="p-3 rounded-xl bg-bg-sidebar text-text-secondary hover:bg-black/50 transition-all border border-border-medium"
        >
          <RotateCcw size={18} />
        </button>
      </div>
    </div>
  );
};

const AICoach = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hey champion! Ready to crush today\'s session? I can help with routine planning, form tips, or some motivation. What\'s on your mind?' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      // Use process.env.GEMINI_API_KEY directly as it is defined in vite.config.ts
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not defined in the environment.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // Combine history with new user message
      const fullMessages = [...messages, { role: 'user' as const, content: userMsg }];
      
      // Gemini requires contents to start with 'user' role.
      // Filter out leading 'model' (assistant) messages.
      const firstUserIndex = fullMessages.findIndex(m => m.role === 'user');
      const sanitizedContents = firstUserIndex !== -1 
        ? fullMessages.slice(firstUserIndex).map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
          }))
        : [{ role: 'user', parts: [{ text: userMsg }] }];

      const response = await ai.models.generateContent({ 
        model: "gemini-flash-latest",
        contents: sanitizedContents,
        config: {
          systemInstruction: "You are FitTrack AI Coach, a high-energy, supportive, and extremely knowledgeable fitness expert. You specialize in weightlifting, progressive overload, nutrition, and injury prevention. Keep your responses punchy, motivational, and structured with clear advice. Use occasional emoji like 💪🔥🏋️‍♂️."
        }
      });

      const fullText = response.text || "Sorry, I lost my breath there. Can you repeat that?";
      setMessages(prev => [...prev, { role: 'assistant', content: fullText }]);
    } catch (err) {
      console.error("AI Coach Error:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setMessages(prev => [...prev, { role: 'assistant', content: `Coach is offline: ${errorMessage.includes('403') ? 'Access Denied (Invalid Key)' : 'Connection issue'}. Try again in a bit!` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-brand-primary rounded-full shadow-[0_8px_30px_rgba(99,102,241,0.4)] flex items-center justify-center text-white hover:scale-110 transition-transform z-40 border border-white/20"
      >
        <MessageSquare size={28} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className="fixed inset-0 sm:inset-auto sm:bottom-24 sm:right-6 sm:w-[400px] h-[600px] bg-bg-sidebar border border-border-medium sm:rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 flex flex-col overflow-hidden"
          >
            <div className="px-6 py-4 bg-bg-card border-b border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 avatar-gradient rounded-xl flex items-center justify-center text-white shadow-lg">
                  <Bot size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight text-white">AI COACH</h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_5px_#10B981]" />
                    <span className="text-[10px] text-text-secondary uppercase font-bold tracking-wider">System Online</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 text-text-muted hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide bg-bg-main/30">
              {messages.map((msg, i) => (
                <div key={i} className={cn(
                  "flex items-start gap-3",
                  msg.role === 'user' ? "flex-row-reverse" : ""
                )}>
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 shadow-sm",
                    msg.role === 'user' ? "bg-bg-card border border-border-medium text-text-secondary" : "avatar-gradient text-white"
                  )}>
                    {msg.role === 'user' ? <UserIcon size={16} /> : <Bot size={16} />}
                  </div>
                  <div className={cn(
                    "p-4 rounded-2xl text-[15px] leading-relaxed max-w-[80%] shadow-sm",
                    msg.role === 'user' 
                      ? "bg-brand-primary text-white font-medium rounded-tr-none border border-brand-primary/20" 
                      : "bg-bg-card text-text-primary rounded-tl-none border border-border-medium"
                  )}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 text-text-muted text-xs font-semibold animate-pulse px-2">
                  <Bot size={14} /> Coach is processing...
                </div>
              )}
            </div>

            <div className="p-4 bg-bg-sidebar border-t border-border-subtle flex gap-2">
              <div className="flex-1 relative">
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Search anything Gemini..."
                  className="w-full bg-bg-card border border-border-medium rounded-xl px-5 py-3.5 text-sm focus:outline-none focus:border-brand-primary placeholder:text-text-muted transition-colors text-text-primary"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:block">
                  <span className="text-[10px] font-bold text-text-muted bg-white/5 px-1.5 py-0.5 rounded border border-white/5 uppercase">⌘ K</span>
                </div>
              </div>
              <button 
                onClick={handleSend}
                disabled={isLoading}
                className="w-12 h-12 bg-brand-primary text-white rounded-xl flex items-center justify-center disabled:opacity-50 transition-all hover:scale-105 shadow-lg active:scale-95"
              >
                <Send size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const ImageWithFallback = ({ src, alt, className }: { src: string, alt: string, className?: string }) => {
  const [error, setError] = useState(false);

  if (error || !src) {
    return (
      <div className={cn("w-full h-full bg-bg-card flex flex-col items-center justify-center text-text-muted gap-3", className)}>
        <Upload size={32} strokeWidth={1} />
        <span className="text-[10px] font-black uppercase tracking-widest opacity-50 text-center px-4">Broken or Private Link</span>
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt={alt} 
      referrerPolicy="no-referrer"
      onError={() => setError(true)}
      className={cn("w-full h-full object-cover", className)}
    />
  );
};

const getVideoEmbedUrl = (url: string) => {
  if (!url) return '';
  
  try {
    let vidId = '';
    
    // YouTube Shorts
    if (url.includes('/shorts/')) {
      const parts = url.split('/shorts/');
      vidId = parts[1]?.split(/[?&]/)[0];
    } 
    // YouTube Watch
    else if (url.includes('v=')) {
      const match = url.match(/[?&]v=([^&#]+)/);
      vidId = match ? match[1] : '';
    } 
    // YouTube Be (Short links)
    else if (url.includes('youtu.be/')) {
      const parts = url.split('youtu.be/');
      vidId = parts[1]?.split(/[?&]/)[0];
    }
    // Generic YouTube IDs
    else {
      // Try to find any 11 char ID pattern for YouTube
      const ytPattern = /(?:v=|\/embed\/|\/1\/|\/v\/|https:\/\/youtu\.be\/|https:\/\/www\.youtube\.com\/shorts\/|[^#&?]*?v=)([^#&?]{11})/;
      const match = url.match(ytPattern);
      if (match && match[1]) {
        vidId = match[1];
      }
    }

    if (vidId) {
      return `https://www.youtube.com/embed/${vidId}`;
    }

    // Vimeo
    const vimeoMatch = url.match(/(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(.+)/);
    if (vimeoMatch && vimeoMatch[1]) {
      const id = vimeoMatch[1].split(/[?&]/)[0];
      return `https://player.vimeo.com/video/${id}`;
    }
  } catch (e) {
    console.error("URL parsing error:", e);
  }
  
  return '';
};

const TransformationCenter = ({ isAdmin }: { isAdmin: boolean }) => {
  const [mediaList, setMediaList] = useState<Media[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [newMedia, setNewMedia] = useState({ title: '', url: '', type: 'image' as 'image' | 'video', description: '' });

  useEffect(() => {
    const q = query(collection(db, 'media'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Media));
      setMediaList(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'media');
    });
    return () => unsubscribe();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedia.url || !newMedia.title) return;
    setIsUploading(true);
    try {
      await addDoc(collection(db, 'media'), {
        ...newMedia,
        uploadedBy: auth.currentUser?.uid || 'anonymous',
        createdAt: serverTimestamp()
      });
      setNewMedia({ title: '', url: '', type: 'image', description: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'media');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Purge this evidence? This action is irreversible.")) return;
    try {
      await deleteDoc(doc(db, 'media', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'media/' + id);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-5xl font-black uppercase tracking-tighter leading-none text-white">Battle<br /><span className="text-brand-primary">Evidence</span></h1>
        <p className="text-text-secondary text-sm max-w-md">Visual documentation of physical transformations. Real results from real warriors.</p>
      </header>

      {isAdmin && (
        <section className="bg-bg-card p-6 rounded-3xl border border-brand-primary/20 shadow-2xl space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-brand-primary flex items-center gap-2">
            <ShieldCheck size={18} />
            Commander Upload
          </h3>
          <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input 
              type="text" 
              placeholder="Media Title" 
              className="bg-bg-main border border-border-medium rounded-xl p-3 text-sm focus:border-brand-primary outline-none text-white"
              value={newMedia.title}
              onChange={e => setNewMedia(p => ({ ...p, title: e.target.value }))}
              required
            />
            <input 
              type="url" 
              placeholder="Paste Video or Image URL" 
              className="bg-bg-main border border-border-medium rounded-xl p-3 text-sm focus:border-brand-primary outline-none text-white"
              value={newMedia.url}
              onChange={e => setNewMedia(p => ({ ...p, url: e.target.value }))}
              required
            />
            <select 
              className="bg-bg-main border border-border-medium rounded-xl p-3 text-sm focus:border-brand-primary outline-none text-white"
              value={newMedia.type}
              onChange={e => setNewMedia(p => ({ ...p, type: e.target.value as any }))}
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
            <input 
              type="text" 
              placeholder="Short Description" 
              className="bg-bg-main border border-border-medium rounded-xl p-3 text-sm focus:border-brand-primary outline-none text-white"
              value={newMedia.description}
              onChange={e => setNewMedia(p => ({ ...p, description: e.target.value }))}
            />
            <button 
              type="submit" 
              disabled={isUploading}
              className="md:col-span-2 bg-brand-primary text-white py-3 rounded-xl font-bold uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Upload size={18} />
              {isUploading ? 'Deploying...' : 'Deploy Evidence'}
            </button>
          </form>
        </section>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {mediaList.map((media, i) => {
            const embedUrl = getVideoEmbedUrl(media.url);
            return (
              <motion.div 
                key={media.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="bg-bg-sidebar rounded-3xl overflow-hidden border border-border-medium group hover:border-brand-primary/30 transition-all flex flex-col shadow-lg"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-black/40">
                  {media.type === 'video' ? (
                    embedUrl ? (
                      <iframe 
                        src={embedUrl} 
                        className="w-full h-full border-0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowFullScreen
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-text-muted">
                        <Video size={48} className="mb-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Video Content</span>
                        <a href={media.url} target="_blank" rel="noopener noreferrer" className="mt-4 px-4 py-2 bg-brand-primary text-white rounded-lg text-xs font-bold uppercase tracking-widest">Watch Now</a>
                      </div>
                    )
                  ) : (
                    <ImageWithFallback 
                      src={media.url} 
                      alt={media.title} 
                      className="group-hover:scale-110 transition-transform duration-1000" 
                    />
                  )}
                  <div className="absolute top-4 left-4">
                    <span className="bg-black/60 backdrop-blur-md text-white px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-white/10">
                      {media.type}
                    </span>
                  </div>
                  {isAdmin && (
                    <button 
                      onClick={() => handleDelete(media.id)}
                      className="absolute top-4 right-4 p-2 bg-red-500/20 hover:bg-red-500 text-white rounded-lg backdrop-blur-md border border-red-500/30 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-black uppercase tracking-tighter text-white mb-2 leading-tight">{media.title}</h3>
                  <p className="text-text-secondary text-xs leading-relaxed line-clamp-2">{media.description}</p>
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[8px] font-black text-text-muted uppercase tracking-widest">
                      {media.createdAt?.toDate ? media.createdAt.toDate().toLocaleDateString() : 'Just now'}
                    </span>
                    <div className="flex items-center gap-1">
                       <div className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-pulse" />
                       <span className="text-[8px] font-black text-brand-primary uppercase tracking-widest">Verified Result</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {mediaList.length === 0 && (
          <div className="col-span-full py-20 text-center space-y-4">
             <div className="w-20 h-20 bg-bg-card rounded-3xl mx-auto flex items-center justify-center text-text-muted border border-border-subtle">
                <Search size={32} />
             </div>
             <p className="text-text-secondary font-bold uppercase text-xs tracking-widest italic">No evidence detected in local sector.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const Library = ({ isAdmin }: { isAdmin: boolean }) => {
  const [filter, setFilter] = useState('All');
  const [items, setItems] = useState<Media[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [newItem, setNewItem] = useState({ title: '', url: '', description: '', type: 'image' as 'image' | 'video', category: 'General' });
  const categories = ['All', 'Weight Loss', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Shorts', 'Images'];

  useEffect(() => {
    const q = query(collection(db, 'library'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Media[];
      setItems(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'library');
    });
    return () => unsubscribe();
  }, []);

  const handleUpload = async () => {
    if (!newItem.url || !newItem.title) return;
    setIsUploading(true);
    try {
      await addDoc(collection(db, 'library'), {
        ...newItem,
        createdAt: serverTimestamp()
      });
      setNewItem({ title: '', url: '', description: '', type: 'image', category: 'General' });
      alert("Asset added to catalog.");
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'library');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Remove asset from catalog?")) return;
    try {
      await deleteDoc(doc(db, 'library', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'library/' + id);
    }
  };

  const filteredItems = items.filter(item => {
    if (filter === 'All') return true;
    if (filter === 'Shorts') return item.type === 'video';
    if (filter === 'Images') return item.type === 'image';
    return item.category === filter;
  });

  return (
    <div className="space-y-8 pb-20">
      <header className="space-y-2">
        <h1 className="text-5xl font-black uppercase tracking-tighter leading-none text-white">Catalog<br /><span className="text-brand-primary">Assets</span></h1>
        <p className="text-text-secondary text-sm max-w-md">Our unified library of calculated movements, optimized for architectural precision and physical growth.</p>
      </header>

      {isAdmin && (
        <div className="bg-bg-sidebar/50 p-8 rounded-[2rem] border border-brand-primary/20 space-y-6 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-brand-primary/10 rounded-lg text-brand-primary">
              <PlusCircle size={20} />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tighter text-white">Expansion Protocol <span className="text-brand-primary">Active</span></h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <input 
              placeholder="Asset Title" 
              className="bg-bg-main border border-border-medium rounded-xl p-3 text-sm focus:border-brand-primary outline-none text-white"
              value={newItem.title}
              onChange={e => setNewItem(p => ({ ...p, title: e.target.value }))}
            />
            <input 
              type="url" 
              placeholder="Video or Image URL" 
              className="bg-bg-main border border-border-medium rounded-xl p-3 text-sm focus:border-brand-primary outline-none text-white"
              value={newItem.url}
              onChange={e => setNewItem(p => ({ ...p, url: e.target.value }))}
            />
            <textarea 
              placeholder="Description & Technical Specs" 
              className="bg-bg-main border border-border-medium rounded-xl p-3 text-sm focus:border-brand-primary outline-none text-white min-h-[100px] md:col-span-2"
              value={newItem.description}
              onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))}
            />
            <select 
              className="bg-bg-main border border-border-medium rounded-xl p-3 text-sm focus:border-brand-primary outline-none text-white"
              value={newItem.type}
              onChange={e => setNewItem(p => ({ ...p, type: e.target.value as any }))}
            >
              <option value="image">Image (Technical Still)</option>
              <option value="video">Short (Movement Loop)</option>
            </select>
            <select 
              className="bg-bg-main border border-border-medium rounded-xl p-3 text-sm focus:border-brand-primary outline-none text-white"
              value={newItem.category}
              onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}
            >
              {categories.filter(c => c !== 'All' && c !== 'Shorts' && c !== 'Images').map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="General">General</option>
            </select>
          </div>
          
          <button 
            disabled={isUploading}
            onClick={handleUpload}
            className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-brand-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isUploading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Deploy to Catalog"}
          </button>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={cn(
              "px-5 py-2.5 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all whitespace-nowrap border",
              filter === cat 
                ? "bg-brand-primary text-white border-brand-primary shadow-lg shadow-brand-primary/20" 
                : "bg-bg-sidebar border-border-subtle text-text-muted hover:border-text-secondary hover:text-text-primary"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredItems.map((item, i) => {
            const embedUrl = getVideoEmbedUrl(item.url);
            return (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="bg-bg-sidebar rounded-3xl overflow-hidden border border-border-medium group hover:border-brand-primary/30 transition-all flex flex-col shadow-lg"
              >
                <div className="relative aspect-video overflow-hidden bg-black/40">
                  {item.type === 'video' ? (
                    embedUrl ? (
                      <iframe 
                        src={embedUrl} 
                        className="w-full h-full border-0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowFullScreen
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-text-muted">
                        <Video size={48} className="mb-4" />
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-brand-primary text-white rounded-lg text-xs font-black uppercase tracking-widest">Watch Short</a>
                      </div>
                    )
                  ) : (
                    <ImageWithFallback 
                      src={item.url} 
                      alt={item.title} 
                      className="group-hover:scale-110 transition-transform duration-1000" 
                    />
                  )}
                  <div className="absolute top-4 left-4">
                    <span className="bg-black/60 backdrop-blur-md text-white px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-white/10">
                      {item.category}
                    </span>
                  </div>
                  {isAdmin && (
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="absolute top-4 right-4 p-2 bg-red-500/20 hover:bg-red-500 text-white rounded-lg backdrop-blur-md border border-red-500/30 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-black uppercase tracking-tighter text-white mb-2 leading-tight">{item.title}</h3>
                  <p className="text-text-secondary text-xs leading-relaxed line-clamp-3">{item.description}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {filteredItems.length === 0 && (
          <div className="col-span-full py-20 text-center space-y-4">
             <div className="w-20 h-20 bg-bg-card rounded-3xl mx-auto flex items-center justify-center text-text-muted border border-border-subtle">
                <Search size={32} />
             </div>
             <p className="text-text-secondary font-bold uppercase text-xs tracking-widest italic">Inventory empty for this classification.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const Progress = () => {
  return (
    <div className="space-y-8 pb-20 px-1">
      <header className="space-y-2">
        <h1 className="text-5xl font-black uppercase tracking-tighter leading-none text-white">Biometric<br /><span className="text-brand-primary">Telemetry</span></h1>
        <p className="text-text-secondary text-sm max-w-md">Real-time performance metrics and anatomical evolution tracking decoded via our advanced telemetry engine.</p>
      </header>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="bg-bg-sidebar p-8 rounded-[2rem] border border-border-medium space-y-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none text-white">
            <TrendingUp size={120} />
          </div>
          <div className="flex items-center justify-between relative z-10">
            <div className="space-y-1">
              <h3 className="font-bold uppercase tracking-[0.2em] text-text-primary text-xs flex items-center gap-2">
                <div className="w-2 h-2 bg-brand-primary rounded-full" />
                Weight Delta
              </h3>
              <p className="text-[10px] text-text-muted font-bold">HISTORICAL LOGGING</p>
            </div>
            <div className="text-[10px] font-black bg-brand-primary/10 text-brand-primary border border-brand-primary/20 px-3 py-1.5 rounded-full">-0.9kg RECENT VELOCITY</div>
          </div>
          <div className="h-[300px] w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <ReChart data={PROGRESS_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="day" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 700 }} />
                <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip 
                  cursor={{ stroke: '#6366F120', strokeWidth: 20 }}
                  contentStyle={{ backgroundColor: '#121418', border: '1px solid #2D333D', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
                  itemStyle={{ color: '#6366F1', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}
                />
                <defs>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={1}/>
                    <stop offset="95%" stopColor="#A855F7" stopOpacity={1}/>
                  </linearGradient>
                </defs>
                <Line 
                  type="monotone" 
                  dataKey="weight" 
                  stroke="url(#lineGradient)"
                  strokeWidth={5} 
                  dot={{ fill: '#6366F1', stroke: '#121418', strokeWidth: 3, r: 6 }}
                  activeDot={{ r: 9, fill: '#FFFFFF', stroke: '#6366F1', strokeWidth: 4 }}
                />
              </ReChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-4 relative z-10">
            {[
              { label: 'Origin', val: '78.5', unit: 'kg' },
              { label: 'Current', val: '77.8', unit: 'kg' },
              { label: 'Variance', val: '-0.7', unit: 'kg' },
            ].map(stat => (
              <div key={stat.label} className="bg-bg-card/50 p-4 rounded-2xl border border-border-subtle space-y-1 group hover:border-brand-primary/30 transition-colors">
                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">{stat.label}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black tracking-tighter text-white">{stat.val}</span>
                  <span className="text-[9px] text-brand-primary font-bold">{stat.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-bg-sidebar p-8 rounded-[2rem] border border-border-medium space-y-8 shadow-2xl relative overflow-hidden text-center flex flex-col justify-center min-h-[500px]">
          <div className="w-20 h-20 bg-brand-primary shadow-[0_0_40px_rgba(99,102,241,0.3)] rounded-3xl mx-auto flex items-center justify-center text-white mb-6">
            <Flame size={40} />
          </div>
          <h3 className="text-3xl font-black uppercase tracking-tight text-white italic">Protocol v2.0 <br /><span className="text-brand-primary">Locked</span></h3>
          <p className="text-text-secondary text-sm max-w-xs mx-auto mb-8">Detailed plate-by-plate volume metrics are currently being calibrated for our next system update.</p>
          <div className="w-full bg-white/5 h-2.5 rounded-full overflow-hidden border border-white/5">
             <motion.div 
              initial={{ width: "0%" }}
              animate={{ width: "65%" }}
              className="h-full avatar-gradient"
             />
          </div>
          <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mt-4">Calibration status: 65%</p>
        </div>
      </div>
    </div>
  );
};

// --- Dashboard View ---

const DashboardView = () => {
  return (
    <div className="space-y-8 pb-20">
      <header className="space-y-2">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 text-text-secondary"
        >
          <Calendar size={16} />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">Friday, May 1, 2026</span>
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl font-black uppercase tracking-tighter leading-none text-white"
        >
          Welcome Back,<br />
          <span className="text-brand-primary">Warrior</span>
        </motion.h1>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Flame, label: 'Calories', val: '1,240', unit: 'kcal', color: '#6366F1' },
          { icon: TrendingUp, label: 'Lifts', val: '450', unit: 'kg', color: '#A855F7' },
          { icon: Dumbbell, label: 'Exercises', val: '12', unit: 'done', color: '#8b5cf6' },
          { icon: Timer, label: 'Duration', val: '54', unit: 'mins', color: '#4f46e5' },
        ].map((item, i) => (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            key={item.label}
            className="bg-bg-card p-5 rounded-2xl border border-border-subtle hover:border-brand-primary/30 transition-all group relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" 
                style={{ backgroundColor: `${item.color}20`, color: item.color, border: `1px solid ${item.color}30` }}
              >
                <item.icon size={20} />
              </div>
              <ChevronRight size={16} className="text-text-muted group-hover:translate-x-1 transition-transform" />
            </div>
            <div className="space-y-1 relative z-10">
              <p className="text-[10px] font-black tracking-widest text-text-muted uppercase">{item.label}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-white">{item.val}</span>
                <span className="text-[10px] text-text-secondary font-bold uppercase tracking-tight">{item.unit}</span>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/[0.02] rounded-tl-full -mr-10 -mb-10 group-hover:scale-110 transition-transform" />
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <section className="space-y-4">
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-text-muted px-1">Active Tooling</h3>
          <WorkoutTimer />
        </section>

        <section className="space-y-4 bg-bg-sidebar p-1 rounded-3xl border border-border-medium overflow-hidden shadow-2xl">
          <div className="p-6">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-text-muted mb-4">Daily recommendation</h3>
            <div className="relative aspect-[16/10] rounded-2xl overflow-hidden group border border-border-medium">
              <img 
                src="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=800" 
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                alt="Exercise"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-8">
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-brand-primary text-white px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider">Leg Focus</span>
                  <span className="bg-white/10 backdrop-blur-md text-text-primary px-2.5 py-1 rounded text-[10px] font-bold uppercase border border-white/10">Elite</span>
                </div>
                <h4 className="text-3xl font-black uppercase tracking-tighter leading-tight mb-2 text-white">Hypertrophy Blueprint</h4>
                <p className="text-sm text-text-secondary mb-6 max-w-sm line-clamp-2">Master form and explosive rhythm with our expert-led squat variations.</p>
                <button className="w-full py-3.5 bg-white text-black font-black uppercase tracking-[0.15em] text-xs rounded-xl hover:bg-brand-primary hover:text-white transition-all shadow-xl active:scale-[0.98]">Launch Training</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

// --- Authentication Screen ---

const LoginScreen = ({ onHostLogin }: { onHostLogin: (pass: string) => void }) => {
  const [hostPass, setHostPass] = useState('');
  const [showHostInput, setShowHostInput] = useState(false);

  return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center p-6 elegant-gradient relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[20%] left-[10%] w-[30%] h-[30%] bg-brand-primary/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[20%] right-[10%] w-[35%] h-[35%] bg-brand-secondary/10 blur-[150px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-bg-sidebar border border-border-medium rounded-[2.5rem] p-10 shadow-2xl relative z-10"
      >
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-16 h-16 avatar-gradient rounded-3xl flex items-center justify-center text-white mb-6 shadow-xl shadow-brand-primary/20 rotate-12">
            <Dumbbell size={36} />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white mb-2 uppercase">FIT<span className="text-brand-primary">TRACK</span></h1>
          <p className="text-text-secondary text-sm font-bold tracking-widest opacity-60 uppercase">Anatomical System Access</p>
        </div>

        <div className="space-y-4">
          <button 
            onClick={() => signInWithPopup(auth, googleProvider)}
            className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-3 hover:bg-brand-primary hover:text-white transition-all shadow-lg active:scale-95"
          >
             {/* Simple visual bot icon replacement for login button */}
            <div className="w-5 h-5 bg-black/10 rounded flex items-center justify-center"><Bot size={16} /></div>
            Enter with Google
          </button>

          <button 
            onClick={() => signInAnonymously(auth)}
            className="w-full py-4 bg-bg-card border border-border-medium text-text-primary font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-3 hover:border-brand-primary/50 transition-all active:scale-95 shadow-lg"
          >
            <UserIcon size={20} />
            Guest Protocol
          </button>

          <div className="relative py-4 flex items-center justify-center">
             <div className="h-[1px] w-full bg-border-subtle absolute" />
             <span className="relative z-10 bg-bg-sidebar px-4 text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Restricted Access</span>
          </div>

          {!showHostInput ? (
            <button 
              onClick={() => setShowHostInput(true)}
              className="w-full py-4 bg-transparent border border-dashed border-border-medium text-text-muted font-bold uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:border-brand-primary hover:text-brand-primary hover:bg-brand-primary/5 transition-all text-xs"
            >
              <ShieldCheck size={16} />
              Commander Login
            </button>
          ) : (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              className="space-y-3"
            >
              <input 
                type="password" 
                placeholder="Access Code" 
                className="w-full bg-bg-main border border-border-medium rounded-xl p-4 text-center text-brand-primary font-mono focus:border-brand-primary outline-none transition-all placeholder:text-text-muted"
                value={hostPass}
                onChange={e => setHostPass(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onHostLogin(hostPass)}
              />
              <div className="flex gap-2">
                <button 
                   onClick={() => setShowHostInput(false)}
                   className="flex-1 py-3 bg-bg-card border border-border-medium text-text-muted rounded-xl font-bold uppercase text-[10px] tracking-widest"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => onHostLogin(hostPass)}
                  className="flex-[2] py-3 bg-brand-primary text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-brand-primary/20"
                >
                  Verify Access
                </button>
              </div>
            </motion.div>
          )}
        </div>

        <p className="mt-10 text-center text-[10px] text-text-muted font-medium leading-relaxed max-w-[240px] mx-auto uppercase tracking-tighter">
          By entering this system, you agree to follow the hyperthophy protocols and anatomical safety standards.
        </p>
      </motion.div>
    </div>
  );
};

// --- App Root ---

const HostElevation = ({ onHostLogin, isAdmin }: { onHostLogin: (pass: string) => void, isAdmin: boolean }) => {
  const [hostPass, setHostPass] = useState('');
  const [showInput, setShowInput] = useState(false);

  if (isAdmin) return null;

  return (
    <div className="mt-20 pt-10 border-t border-white/5 max-w-xs mx-auto text-center opacity-40 hover:opacity-100 transition-opacity pb-20">
      {!showInput ? (
        <button 
          onClick={() => setShowInput(true)}
          className="text-[10px] font-black text-text-muted hover:text-brand-primary uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-2 mx-auto"
        >
          <ShieldCheck size={14} />
          Commander System Access
        </button>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
           <input 
              type="password" 
              placeholder="Access Code" 
              className="w-full bg-bg-card border border-border-medium rounded-xl p-3 text-center text-brand-primary font-mono focus:border-brand-primary outline-none transition-all placeholder:text-text-muted text-sm shadow-inner"
              value={hostPass}
              onChange={e => setHostPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onHostLogin(hostPass)}
              autoFocus
            />
            <div className="flex gap-2">
              <button 
                  onClick={() => setShowInput(false)}
                  className="flex-1 py-2 bg-white/5 text-text-muted rounded-lg font-bold uppercase text-[8px] tracking-widest"
              >
                Cancel
              </button>
              <button 
                onClick={() => onHostLogin(hostPass)}
                className="flex-[2] py-2 bg-brand-primary text-white rounded-lg font-black uppercase text-[8px] tracking-widest shadow-lg shadow-brand-primary/20"
              >
                Verify Code
              </button>
            </div>
        </motion.div>
      )}
    </div>
  );
};

export default function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log("Firestore connection established.");
        setIsFirestoreConnected(true);
      } catch (error) {
        console.error("Connection check failed:", error);
        setIsFirestoreConnected(false);
      }
    }
    checkConnection();
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Check for admin role in firestore
        const userDoc = await getDoc(doc(db, 'users', u.uid));
        if (userDoc.exists() && userDoc.data()?.role === 'admin') {
          setIsAdmin(true);
        } else {
          // If no doc, create a basic user doc
          if (!userDoc.exists()) {
            await setDoc(doc(db, 'users', u.uid), {
              uid: u.uid,
              email: u.email || 'anonymous',
              displayName: u.displayName || 'Warrior',
              role: 'user',
              createdAt: serverTimestamp()
            });
          }
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
  }, []);

  const handleHostLogin = async (pass: string) => {
    if (pass === 'Samiul123') {
       try {
          let currentUser = auth.currentUser;
          if (!currentUser) {
            const cred = await signInAnonymously(auth);
            currentUser = cred.user;
          }
          
          if (currentUser) {
            await setDoc(doc(db, 'users', currentUser.uid), { 
              uid: currentUser.uid,
              role: 'admin',
              email: currentUser.email || 'commander',
              displayName: currentUser.displayName || 'Commander Samiul',
              updatedAt: serverTimestamp()
            }, { merge: true });
            setIsAdmin(true);
            alert("COMMANDER ACCESS GRANTED");
          }
       } catch (e) {
          console.error(e);
          alert("Host verification failed - system error.");
       }
    } else {
      alert("The password is wrong: ACCESS DENIED");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
           <div className="w-12 h-12 avatar-gradient rounded-xl animate-bounce" />
           <span className="text-[10px] font-black tracking-[0.3em] text-brand-primary animate-pulse uppercase">Initializing System...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onHostLogin={handleHostLogin} />;
  }

  return (
    <div className="min-h-screen bg-bg-main text-text-primary font-sans selection:bg-brand-primary selection:text-white elegant-gradient">
      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-8 pb-32">
        {/* Top bar / Logo */}
        <nav className="flex items-center justify-between mb-16 px-2">
          <div className="flex items-center gap-3 group pointer-events-none">
            <div className="w-11 h-11 avatar-gradient text-white flex items-center justify-center rounded-2xl shadow-xl shadow-brand-primary/20 transition-transform group-hover:scale-110">
              <Dumbbell size={24} strokeWidth={3} />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-2xl font-black tracking-tighter text-white uppercase italic">FIT<span className="text-brand-primary">TRACK</span></span>
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-text-muted">Anatomical Intelligence</span>
            </div>
          </div>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-2 bg-bg-sidebar p-1.5 rounded-2xl border border-border-medium shadow-lg">
            {(['dashboard', 'library', 'progress', 'transformation'] as View[]).map(v => (
              <button 
                key={v}
                onClick={() => setActiveView(v)}
                className={cn(
                  "text-[10px] font-bold uppercase tracking-[0.15em] transition-all px-6 py-2.5 rounded-xl whitespace-nowrap",
                  activeView === v 
                    ? "bg-bg-card border border-border-medium text-white shadow-xl" 
                    : "text-text-muted hover:text-text-secondary"
                )}
              >
                {v === 'transformation' ? 'Battle Evidence' : v}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
             {isAdmin && (
               <div className="hidden sm:flex items-center gap-2 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest">
                 <ShieldCheck size={14} />
                 Commander mode
               </div>
             )}
             <button 
               onClick={() => signOut(auth)}
               className="hidden sm:flex items-center gap-2 bg-bg-card border border-border-medium text-text-primary px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50 transition-all group"
             >
                <LogOut size={16} />
                Logout
             </button>
             <div className="w-10 h-10 rounded-xl border border-border-medium overflow-hidden bg-bg-sidebar shadow-lg p-0.5">
               <img 
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'Warrior'}&background=6366F1&color=fff`} 
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover rounded-[10px]" 
                alt="Avatar" 
               />
             </div>
          </div>
        </nav>

        {/* Dynamic Content */}
        <main>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            >
              {activeView === 'dashboard' && <DashboardView />}
              {activeView === 'library' && <Library isAdmin={isAdmin} />}
              {activeView === 'progress' && <Progress />}
              {activeView === 'transformation' && <TransformationCenter isAdmin={isAdmin} />}
            </motion.div>
          </AnimatePresence>
        </main>

        <HostElevation onHostLogin={handleHostLogin} isAdmin={isAdmin} />
      </div>

      {/* Mobile Bottom Nav */}
      <footer className="fixed bottom-0 left-0 right-0 lg:hidden bg-bg-sidebar/80 backdrop-blur-2xl border-t border-border-subtle px-6 py-5 z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between max-w-sm mx-auto">
          {[
            { id: 'dashboard', icon: Flame, label: 'Dash' },
            { id: 'library', icon: Dumbbell, label: 'Lib' },
            { id: 'transformation', icon: Plus, label: 'Battle' },
            { id: 'progress', icon: LucideLineChart, label: 'Stats' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as View)}
              className={cn(
                "flex flex-col items-center gap-1.5 transition-all text-[9px] font-black uppercase tracking-widest",
                activeView === item.id ? "text-brand-primary" : "text-text-muted"
              )}
            >
              <div className={cn(
                "p-3 rounded-2xl transition-all shadow-sm",
                activeView === item.id ? "bg-brand-primary text-white shadow-brand-primary/30" : "bg-bg-card border border-border-subtle"
              )}>
                <item.icon size={22} />
              </div>
              {item.label}
            </button>
          ))}
        </div>
      </footer>

      {/* AI Coach Overlay */}
      <AICoach />

      {isFirestoreConnected === false && (
        <div className="fixed bottom-24 left-6 right-6 sm:left-auto sm:right-6 sm:w-80 bg-red-500/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl z-[60] border border-red-400 flex items-center gap-3">
          <ShieldCheck size={24} className="flex-shrink-0" />
          <div className="text-xs">
            <p className="font-bold uppercase tracking-wider mb-0.5">Connection Warning</p>
            <p className="opacity-90">Firestore is currently unreachable. Some data may not sync correctly.</p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="ml-auto p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
