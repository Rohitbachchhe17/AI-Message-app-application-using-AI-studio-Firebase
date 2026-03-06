/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  User
} from 'firebase/auth';
import { 
  ref, 
  set, 
  onValue, 
  push, 
  get, 
  update, 
  onDisconnect, 
  serverTimestamp,
  query,
  orderByChild,
  equalTo,
  remove,
  off
} from 'firebase/database';
import { 
  MessageCircle, 
  Users, 
  Phone, 
  Video, 
  Settings, 
  LogOut, 
  Search, 
  UserPlus, 
  Check, 
  X, 
  Send, 
  Mic, 
  MicOff, 
  VideoOff, 
  ArrowLeft,
  MoreVertical,
  Clock,
  Sparkles,
  Bot,
  Zap,
  Image as ImageIcon,
  Paperclip,
  MapPin,
  File,
  Download,
  Play,
  Pause,
  Square
} from 'lucide-react';
import * as Tone from 'tone';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GoogleGenAI } from "@google/genai";
import { geminiService } from './services/geminiService';

import { auth, db } from './firebase';

// --- Utility Functions ---

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const emojiToSVG = (content: string) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="#000" />
      <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="Arial" font-size="50" fill="#fff">
        ${content.substring(0, 2)}
      </text>
    </svg>
  `;
  // Use encodeURIComponent and unescape to handle Unicode characters (like emojis) in btoa
  const base64 = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${base64}`;
};

const generateUserId = () => {
  return `ar-${Math.floor(1000 + Math.random() * 9000)}`;
};

const THEMES = [
  { id: 'emerald', name: 'Emerald', class: '', color: '#00A878' },
  { id: 'midnight', name: 'Midnight', class: 'theme-midnight', color: '#3b82f6' },
  { id: 'sunset', name: 'Sunset', class: 'theme-sunset', color: '#f97316' },
  { id: 'rose', name: 'Rose', class: 'theme-rose', color: '#e11d48' },
  { id: 'classic', name: 'Classic', class: 'theme-classic', color: '#ffffff' },
  { id: 'cyberpunk', name: 'Cyberpunk', class: 'theme-cyberpunk', color: '#f0f' },
  { id: 'glass', name: 'Glass', class: 'theme-glass', color: '#ffffff' },
];

// --- Types ---

interface UserProfile {
  uid: string;
  name: string;
  bio: string;
  emoji: string;
  userId: string;
  dpUrl: string;
  status?: 'online' | 'offline';
  last_changed?: number;
}

interface Message {
  id: string;
  senderId: string;
  text?: string;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  location?: { lat: number, lng: number };
  audioUrl?: string;
  timestamp: number;
}

interface Contact {
  uid: string;
  chatId: string;
  profile?: UserProfile;
  unreadCount?: number;
  lastMessage?: string;
  status?: 'online' | 'offline';
}

interface FriendRequest {
  id: string;
  fromUid: string;
  fromProfile?: UserProfile;
}

function InteractiveBackground({ theme }: { theme: string }) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="interactive-bg">
      <motion.div 
        animate={{ 
          x: [0, 100, -50, 0],
          y: [0, -50, 100, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="blob top-0 left-0" 
      />
      <motion.div 
        animate={{ 
          x: [0, -100, 50, 0],
          y: [0, 100, -50, 0],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="blob bottom-0 right-0" 
      />
      
      {/* Mouse following blob */}
      <motion.div 
        animate={{ 
          x: mousePos.x - 200,
          y: mousePos.y - 200,
        }}
        transition={{ type: 'spring', damping: 30, stiffness: 50 }}
        className="blob opacity-[0.05]" 
        style={{ width: '400px', height: '400px' }}
      />

      {theme === 'cyberpunk' && (
        <div className="absolute inset-0 opacity-10 pointer-events-none" 
             style={{ backgroundImage: 'linear-gradient(rgba(0,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,255,0.1) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
      )}
    </div>
  );
}

// --- Components ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'requests' | 'calls' | 'ai'>('home');
  const [activeChat, setActiveChat] = useState<Contact | null>(null);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCallLogs, setShowCallLogs] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('ar-chats-theme') || 'emerald');
  
  useEffect(() => {
    localStorage.setItem('ar-chats-theme', theme);
  }, [theme]);
  
  // Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        fetchProfile(u.uid);
        setupPresence(u.uid);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchProfile = async (uid: string) => {
    const profileRef = ref(db, `users/${uid}`);
    onValue(profileRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setProfile(data);
        setShowProfileSetup(false);
      } else {
        setShowProfileSetup(true);
      }
      setLoading(false);
    });
  };

  const setupPresence = (uid: string) => {
    const statusRef = ref(db, `status/${uid}`);
    const connectedRef = ref(db, '.info/connected');

    onValue(connectedRef, (snapshot) => {
      if (snapshot.val() === false) return;

      onDisconnect(statusRef).set({
        status: 'offline',
        last_changed: serverTimestamp()
      }).then(() => {
        set(statusRef, {
          status: 'online',
          last_changed: serverTimestamp()
        });
      });
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-primary">
        <div className="animate-pulse text-2xl font-bold">Ar Chats</div>
      </div>
    );
  }

  return (
    <div className={cn(
      "fixed inset-0 flex items-center justify-center transition-colors duration-500",
      theme !== 'emerald' && THEMES.find(t => t.id === theme)?.class
    )}>
      <InteractiveBackground theme={theme} />
      
      <div className="relative w-full max-w-[400px] h-screen max-h-[800px] bg-background overflow-hidden shadow-2xl border border-white/5 sm:rounded-3xl">
        {!user ? (
        <AuthScreen />
      ) : showProfileSetup ? (
        <ProfileSetupScreen uid={user.uid} onComplete={() => setShowProfileSetup(false)} />
      ) : (
        <>
          <MainLayout 
            user={user} 
            profile={profile} 
            activeTab={activeTab} 
            setActiveTab={setActiveTab}
            setActiveChat={setActiveChat}
            setShowSideMenu={setShowSideMenu}
            setShowAddFriend={setShowAddFriend}
          />
          
          <AnimatePresence>
            {activeChat && (
              <ChatScreen 
                me={profile!} 
                contact={activeChat} 
                onClose={() => setActiveChat(null)} 
              />
            )}
            
            {showSideMenu && (
              <SideMenu 
                profile={profile!} 
                onClose={() => setShowSideMenu(false)} 
                onLogout={() => signOut(auth)}
                currentTheme={theme}
                onThemeChange={setTheme}
                onOpenSettings={() => { setShowSettings(true); setShowSideMenu(false); }}
                onOpenCallLogs={() => { setActiveTab('calls'); setShowSideMenu(false); }}
              />
            )}

            {showSettings && (
              <SettingsModal 
                profile={profile!} 
                onClose={() => setShowSettings(false)} 
              />
            )}

            {showAddFriend && (
              <AddFriendModal 
                me={profile!} 
                onClose={() => setShowAddFriend(false)} 
              />
            )}
          </AnimatePresence>
          
          <CallManager me={profile} />
        </>
      )}
      </div>
    </div>
  );
}

// --- Auth Screen ---

function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-container">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-primary mb-2">Ar Chats</h1>
        <p className="text-text/60">Connect with style</p>
      </div>
      
      <form onSubmit={handleAuth} className="w-full space-y-4">
        <input 
          type="email" 
          placeholder="Email" 
          className="w-full p-4 bg-background border border-white/10 rounded-xl focus:border-primary outline-none transition-colors"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input 
          type="password" 
          placeholder="Password" 
          className="w-full p-4 bg-background border border-white/10 rounded-xl focus:border-primary outline-none transition-colors"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <button 
          type="submit" 
          className="w-full p-4 bg-primary text-background font-bold rounded-xl active:scale-95 transition-transform"
        >
          {isLogin ? 'Login' : 'Sign Up'}
        </button>
      </form>
      
      <button 
        onClick={() => setIsLogin(!isLogin)} 
        className="mt-6 text-primary text-sm hover:underline"
      >
        {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
      </button>
    </div>
  );
}

// --- Profile Setup ---

function ProfileSetupScreen({ uid, onComplete }: { uid: string, onComplete: () => void }) {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [emoji, setEmoji] = useState('👋');
  const [isGeneratingBio, setIsGeneratingBio] = useState(false);

  const handleGenerateBio = async () => {
    if (!name.trim() || isGeneratingBio) return;
    setIsGeneratingBio(true);
    const generated = await geminiService.generateBio(name);
    if (generated) setBio(generated);
    setIsGeneratingBio(false);
  };

  const handleSave = async () => {
    if (!name || !emoji) return;
    const userId = generateUserId();
    const dpUrl = emojiToSVG(emoji);
    
    const profileData: UserProfile = {
      uid,
      name: name.substring(0, 20),
      bio: bio.substring(0, 100),
      emoji: emoji.substring(0, 2),
      userId,
      dpUrl
    };

    await set(ref(db, `users/${uid}`), profileData);
    await set(ref(db, `userIds/${userId}`), uid);
    onComplete();
  };

  return (
    <div className="flex flex-col h-full p-8 bg-container overflow-y-auto">
      <h2 className="text-2xl font-bold text-primary mb-6">Setup Profile</h2>
      
      <div className="flex flex-col items-center mb-8">
        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary mb-4">
          <img src={emojiToSVG(emoji)} alt="Preview" className="w-full h-full object-cover" />
        </div>
        <input 
          type="text" 
          maxLength={2} 
          className="w-16 p-2 text-center bg-background border border-white/10 rounded-lg focus:border-primary outline-none"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          placeholder="Emoji"
        />
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-text/50 uppercase tracking-wider mb-1 block">Name</label>
          <input 
            type="text" 
            maxLength={20}
            className="w-full p-4 bg-background border border-white/10 rounded-xl focus:border-primary outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your Name"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-text/50 uppercase tracking-wider block">Bio</label>
            <button 
              onClick={handleGenerateBio}
              disabled={!name.trim() || isGeneratingBio}
              className={cn(
                "text-[10px] text-primary font-bold uppercase tracking-widest flex items-center gap-1 hover:underline disabled:opacity-50",
                isGeneratingBio && "animate-pulse"
              )}
            >
              <Sparkles size={10} />
              AI Generate
            </button>
          </div>
          <textarea 
            maxLength={100}
            className="w-full p-4 bg-background border border-white/10 rounded-xl focus:border-primary outline-none h-24 resize-none"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about yourself"
          />
        </div>
        <button 
          onClick={handleSave}
          className="w-full p-4 bg-primary text-background font-bold rounded-xl active:scale-95 transition-transform mt-4"
        >
          Start Chatting
        </button>
      </div>
    </div>
  );
}

// --- Main Layout ---

function MainLayout({ 
  user, 
  profile, 
  activeTab, 
  setActiveTab, 
  setActiveChat,
  setShowSideMenu,
  setShowAddFriend
}: any) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="p-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowSideMenu(true)} className="w-10 h-10 rounded-full overflow-hidden border border-primary/30">
            <img src={profile?.dpUrl} alt="Me" className="w-full h-full object-cover" />
          </button>
          <div>
            <h1 className="font-bold text-lg leading-tight">Ar Chats</h1>
            <p className="text-[10px] text-primary font-mono">{profile?.userId}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddFriend(true)} className="p-2 text-text/60 hover:text-primary transition-colors">
            <UserPlus size={20} />
          </button>
          <button className="p-2 text-text/60 hover:text-primary transition-colors">
            <Search size={20} />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === 'home' && <HomeTab me={profile} onSelectChat={setActiveChat} />}
        {activeTab === 'requests' && <RequestsTab me={profile} />}
        {activeTab === 'calls' && <CallsTab me={profile} />}
        {activeTab === 'ai' && <AITab me={profile} />}
      </main>

      {/* Bottom Nav */}
      <nav className="flex items-center justify-around p-3 bg-container border-t border-white/5">
        <NavButton 
          active={activeTab === 'home'} 
          onClick={() => setActiveTab('home')} 
          icon={<MessageCircle size={22} />} 
          label="Chats" 
        />
        <NavButton 
          active={activeTab === 'ai'} 
          onClick={() => setActiveTab('ai')} 
          icon={<Sparkles size={22} />} 
          label="AI" 
        />
        <NavButton 
          active={activeTab === 'requests'} 
          onClick={() => setActiveTab('requests')} 
          icon={<Users size={22} />} 
          label="Requests" 
        />
        <NavButton 
          active={activeTab === 'calls'} 
          onClick={() => setActiveTab('calls')} 
          icon={<Phone size={22} />} 
          label="Calls" 
        />
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-all duration-300",
        active ? "text-primary scale-110" : "text-text/40"
      )}
    >
      {icon}
      <span className="text-[10px] font-medium uppercase tracking-tighter">{label}</span>
    </button>
  );
}

// --- Tabs ---

function HomeTab({ me, onSelectChat }: { me: UserProfile | null, onSelectChat: (c: Contact) => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    if (!me?.uid) return;
    const contactsRef = ref(db, `contacts/${me.uid}`);
    
    const unsubscribe = onValue(contactsRef, async (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setContacts([]);
        return;
      }

      const contactList: Contact[] = [];
      for (const contactUid in data) {
        const chatId = data[contactUid];
        
        // Fetch profile
        const profileSnap = await get(ref(db, `users/${contactUid}`));
        const profile = profileSnap.val();
        
        // Fetch status
        const statusSnap = await get(ref(db, `status/${contactUid}`));
        const status = statusSnap.val()?.status || 'offline';

        // Fetch unread count
        const unreadSnap = await get(ref(db, `unreadCounts/${me.uid}/${chatId}`));
        const unreadCount = unreadSnap.val() || 0;

        contactList.push({
          uid: contactUid,
          chatId,
          profile,
          status,
          unreadCount
        });
      }
      setContacts(contactList);
    });

    return () => off(contactsRef);
  }, [me]);

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text/30 p-8 text-center">
        <MessageCircle size={48} className="mb-4 opacity-20" />
        <p>No chats yet. Add friends using their Ar ID to start chatting!</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/5">
      {contacts.map((contact) => (
        <button 
          key={contact.uid}
          onClick={() => onSelectChat(contact)}
          className="w-full p-4 flex items-center gap-4 hover:bg-white/5 transition-colors text-left"
        >
          <div className="relative">
            <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10">
              <img src={contact.profile?.dpUrl} alt="" className="w-full h-full object-cover" />
            </div>
            <div className={cn(
              "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background",
              contact.status === 'online' ? "bg-primary" : "bg-zinc-600"
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-semibold truncate">{contact.profile?.name}</h3>
              <span className="text-[10px] text-text/40">12:45 PM</span>
            </div>
            <p className="text-xs text-text/50 truncate">Tap to chat...</p>
          </div>
          {contact.unreadCount! > 0 && (
            <div className="bg-primary text-background text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
              {contact.unreadCount}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

function RequestsTab({ me }: { me: UserProfile | null }) {
  const [requests, setRequests] = useState<FriendRequest[]>([]);

  useEffect(() => {
    if (!me?.uid) return;
    const requestsRef = ref(db, `requests/${me.uid}`);
    
    const unsubscribe = onValue(requestsRef, async (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setRequests([]);
        return;
      }

      const requestList: FriendRequest[] = [];
      for (const reqId in data) {
        const fromUid = data[reqId];
        const profileSnap = await get(ref(db, `users/${fromUid}`));
        requestList.push({
          id: reqId,
          fromUid,
          fromProfile: profileSnap.val()
        });
      }
      setRequests(requestList);
    });

    return () => off(requestsRef);
  }, [me]);

  const handleAccept = async (req: FriendRequest) => {
    const chatId = [me.uid, req.fromUid].sort().join('_');
    
    // Add to contacts for both
    await update(ref(db), {
      [`contacts/${me.uid}/${req.fromUid}`]: chatId,
      [`contacts/${req.fromUid}/${me.uid}`]: chatId,
      [`requests/${me.uid}/${req.id}`]: null
    });
  };

  const handleDecline = async (req: FriendRequest) => {
    await remove(ref(db, `requests/${me.uid}/${req.id}`));
  };

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text/30 p-8 text-center">
        <Users size={48} className="mb-4 opacity-20" />
        <p>No pending friend requests.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xs font-bold text-primary uppercase tracking-widest mb-4">Friend Requests</h2>
      {requests.map((req) => (
        <div key={req.id} className="bg-container p-4 rounded-2xl flex items-center gap-4 border border-white/5">
          <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10">
            <img src={req.fromProfile?.dpUrl} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{req.fromProfile?.name}</h3>
            <p className="text-[10px] text-primary font-mono">{req.fromProfile?.userId}</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => handleAccept(req)}
              className="w-10 h-10 bg-primary text-background rounded-full flex items-center justify-center active:scale-90 transition-transform"
            >
              <Check size={20} />
            </button>
            <button 
              onClick={() => handleDecline(req)}
              className="w-10 h-10 bg-white/5 text-red-500 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CallsTab({ me }: { me: UserProfile | null }) {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!me?.uid) return;
    const logsRef = ref(db, `callLogs/${me.uid}`);
    const q = query(logsRef, orderByChild('timestamp'));
    
    onValue(q, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setLogs([]);
        return;
      }
      const list = Object.values(data).reverse();
      setLogs(list);
    });
  }, [me]);

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text/30 p-8 text-center">
        <Phone size={48} className="mb-4 opacity-20" />
        <p>No call history yet.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xs font-bold text-primary uppercase tracking-widest mb-4">Recent Calls</h2>
      {logs.map((log, i) => (
        <div key={i} className="flex items-center gap-4 p-2">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center">
            {log.type === 'video' ? <Video size={18} /> : <Phone size={18} />}
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium">{log.otherName}</h3>
            <div className="flex items-center gap-1 text-[10px] text-text/40">
              <Clock size={10} />
              <span>{new Date(log.timestamp).toLocaleString()}</span>
              <span>•</span>
              <span className={log.status === 'missed' ? 'text-red-500' : ''}>{log.status}</span>
            </div>
          </div>
          <span className="text-[10px] text-text/30">{log.duration || ''}</span>
        </div>
      ))}
    </div>
  );
}

// --- AI Tab ---

function AITab({ me }: { me: UserProfile | null }) {
  const [messages, setMessages] = useState<{ 
    role: 'user' | 'ai', 
    text?: string, 
    imageUrl?: string, 
    audioUrl?: string,
    location?: { lat: number, lng: number },
    timestamp: number 
  }[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Load chat history from local storage
  useEffect(() => {
    const saved = localStorage.getItem(`ai_chat_${me?.uid}`);
    if (saved) {
      setMessages(JSON.parse(saved));
    } else {
      setMessages([{
        role: 'ai',
        text: "Hello! I'm your Ar Chat AI Assistant. How can I help you today?",
        timestamp: Date.now()
      }]);
    }
  }, [me?.uid]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    if (me?.uid && messages.length > 0) {
      localStorage.setItem(`ai_chat_${me.uid}`, JSON.stringify(messages));
    }
  }, [messages]);

  const handleImproveTone = async () => {
    if (!inputText.trim() || isImproving) return;
    setIsImproving(true);
    const improved = await geminiService.improveTone(inputText);
    if (improved) setInputText(improved);
    setIsImproving(false);
  };

  const handleGenerateImage = async () => {
    if (!inputText.trim() || isGeneratingImage) return;
    setIsGeneratingImage(true);
    const userMsg = { 
      role: 'user' as const, 
      text: `Generate an image: ${inputText}`, 
      timestamp: Date.now() 
    };
    setMessages(prev => [...prev, userMsg]);
    const prompt = inputText;
    setInputText('');
    
    const imageUrl = await geminiService.generateImage(prompt);
    if (imageUrl) {
      setMessages(prev => [...prev, {
        role: 'ai',
        imageUrl,
        text: `Here is the image I generated for: "${prompt}"`,
        timestamp: Date.now()
      }]);
    } else {
      setMessages(prev => [...prev, {
        role: 'ai',
        text: "Sorry, I couldn't generate that image.",
        timestamp: Date.now()
      }]);
    }
    setIsGeneratingImage(false);
  };

  const handleSend = async (
    e?: React.FormEvent, 
    payload?: { 
      imageUrl?: string, 
      audioUrl?: string,
      location?: { lat: number, lng: number }
    }
  ) => {
    e?.preventDefault();
    if ((!inputText.trim() && !payload) || isTyping) return;

    const userMsg = { 
      role: 'user' as const, 
      text: inputText, 
      imageUrl: payload?.imageUrl,
      audioUrl: payload?.audioUrl,
      location: payload?.location,
      timestamp: Date.now() 
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const contents = messages.concat(userMsg).map(m => {
        const parts: any[] = [];
        if (m.text) parts.push({ text: m.text });
        if (m.location) parts.push({ text: `My current location is: Latitude ${m.location.lat}, Longitude ${m.location.lng}` });
        
        if (m.imageUrl) {
          const [mime, data] = m.imageUrl.split(';base64,');
          parts.push({
            inlineData: {
              mimeType: mime.split(':')[1],
              data: data
            }
          });
        }
        
        if (m.audioUrl) {
          const [mime, data] = m.audioUrl.split(';base64,');
          parts.push({
            inlineData: {
              mimeType: mime.split(':')[1],
              data: data
            }
          });
        }

        return {
          role: m.role === 'user' ? 'user' : 'model',
          parts
        };
      });

      const model = ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents,
        config: {
          systemInstruction: "You are a helpful and friendly AI assistant integrated into 'Ar Chats', a modern chat application. Keep your responses concise and mobile-friendly. You can see images and hear audio if provided."
        }
      });

      const response = await model;
      const aiText = response.text || "I'm sorry, I couldn't process that.";
      
      setMessages(prev => [...prev, {
        role: 'ai',
        text: aiText,
        timestamp: Date.now()
      }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        role: 'ai',
        text: "Sorry, I'm having trouble connecting right now.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      alert("File too large. Please select a file smaller than 1MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (file.type.startsWith('image/')) {
        handleSend(undefined, { imageUrl: base64 });
      } else {
        // For AI, we'll just send the text description if it's not an image/audio
        handleSend(undefined, { imageUrl: undefined }); // Fallback or handle as text
        alert("AI currently only supports image and audio analysis. Sending as text description.");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleLocationShare = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition((position) => {
      setIsLocating(false);
      handleSend(undefined, {
        location: {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }
      });
    }, (error) => {
      setIsLocating(false);
      let msg = "Unable to retrieve your location";
      if (error.code === error.PERMISSION_DENIED) msg = "Location permission denied. Please enable it in your browser settings.";
      else if (error.code === error.POSITION_UNAVAILABLE) msg = "Location information is unavailable.";
      else if (error.code === error.TIMEOUT) msg = "Location request timed out.";
      alert(msg);
    }, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          handleSend(undefined, { audioUrl: base64 });
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("Could not access microphone: " + err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const clearChat = () => {
    if (window.confirm("Clear AI chat history?")) {
      setMessages([{
        role: 'ai',
        text: "Chat cleared. How can I help you now?",
        timestamp: Date.now()
      }]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b border-white/5 flex justify-between items-center bg-container/30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
            <Bot size={18} />
          </div>
          <h2 className="font-bold text-sm">AI Assistant</h2>
        </div>
        <button onClick={clearChat} className="text-[10px] text-text/40 hover:text-red-500 transition-colors uppercase font-bold tracking-tighter">
          Clear
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex flex-col max-w-[85%]", msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start")}>
            <div className={cn(
              "p-3 rounded-2xl text-sm leading-relaxed",
              msg.role === 'user' 
                ? "bg-primary text-background rounded-tr-none" 
                : "bg-white/5 text-text rounded-tl-none border border-white/5"
            )}>
              {msg.imageUrl && (
                <img 
                  src={msg.imageUrl} 
                  alt="" 
                  className="max-w-full rounded-lg mb-2" 
                  referrerPolicy="no-referrer"
                />
              )}
              {msg.audioUrl && (
                <div className="mb-2">
                  <audio controls src={msg.audioUrl} className="w-full h-8 custom-audio-player" />
                </div>
              )}
              {msg.location && (
                <div className="flex items-center gap-2 text-[10px] text-primary mb-2">
                  <MapPin size={12} />
                  <span>Shared Location ({msg.location.lat.toFixed(4)}, {msg.location.lng.toFixed(4)})</span>
                </div>
              )}
              {msg.text}
            </div>
            <span className="text-[8px] text-text/30 mt-1">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        {isTyping && (
          <div className="flex items-center gap-2 text-[10px] text-text/40 italic">
            <div className="flex gap-1">
              <span className="w-1 h-1 bg-primary rounded-full animate-bounce" />
              <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
            AI is thinking...
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="p-4 border-t border-white/5 bg-container/20 flex flex-col gap-2">
        {isRecording && (
          <div className="flex items-center justify-between bg-primary/10 p-2 rounded-xl border border-primary/20 animate-pulse mb-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
              <span className="text-[10px] font-medium text-primary">Recording AI Voice Prompt...</span>
            </div>
            <button 
              type="button" 
              onClick={stopRecording}
              className="p-1.5 bg-primary text-background rounded-full"
            >
              <Square size={12} fill="currentColor" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileChange}
          />
          <button 
            type="button" 
            onClick={handleFileClick}
            className="p-2 text-text/40 hover:text-primary transition-colors"
            disabled={isTyping}
          >
            <Paperclip size={18} />
          </button>
          <button 
            type="button" 
            onClick={handleLocationShare}
            className={cn(
              "p-2 transition-colors",
              isLocating ? "text-primary animate-pulse" : "text-text/40 hover:text-primary"
            )}
            disabled={isTyping || isLocating}
            title={isLocating ? "Locating..." : "Share Location"}
          >
            <MapPin size={18} />
          </button>
          <button 
            type="button" 
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            className={cn(
              "p-2 transition-colors",
              isRecording ? "text-red-500" : "text-text/40 hover:text-primary"
            )}
            disabled={isTyping}
          >
            <Mic size={18} />
          </button>
          <input 
            type="text" 
            placeholder="Ask AI anything..."
            className="flex-1 bg-background border border-white/10 rounded-full px-4 py-2 text-sm focus:border-primary outline-none transition-all"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isTyping || isGeneratingImage}
          />
          {inputText.trim() && (
            <div className="flex gap-1">
              <button 
                type="button"
                onClick={handleImproveTone}
                disabled={isImproving}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border border-primary/20 text-primary hover:bg-primary/10 transition-all",
                  isImproving && "animate-spin"
                )}
                title="Improve Tone"
              >
                <Zap size={18} />
              </button>
              <button 
                type="button"
                onClick={handleGenerateImage}
                disabled={isGeneratingImage}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border border-primary/20 text-primary hover:bg-primary/10 transition-all",
                  isGeneratingImage && "animate-pulse"
                )}
                title="Generate Image"
              >
                <ImageIcon size={18} />
              </button>
            </div>
          )}
          <button 
            type="submit"
            className="w-10 h-10 bg-primary text-background rounded-full flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
            disabled={(!inputText.trim() && !isRecording) || isTyping || isGeneratingImage}
          >
            <Zap size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}

// --- Chat Screen ---

function ChatScreen({ me, contact, onClose }: { me: UserProfile, contact: Contact, onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherIsTyping, setOtherIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [transcriptions, setTranscriptions] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    // Reset unread count
    set(ref(db, `unreadCounts/${me.uid}/${contact.chatId}`), 0);

    // Listen for messages
    const messagesRef = ref(db, `messages/${contact.chatId}`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setMessages([]);
        return;
      }
      const list = Object.keys(data).map(id => ({ id, ...data[id] }));
      setMessages(list);
      setTimeout(scrollToBottom, 100);
    });

    // Listen for typing
    const typingRef = ref(db, `typing/${contact.chatId}/${contact.uid}`);
    onValue(typingRef, (snapshot) => {
      setOtherIsTyping(!!snapshot.val());
    });

    return () => {
      off(messagesRef);
      off(typingRef);
    };
  }, [contact.chatId]);

  // Fetch smart replies
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.senderId !== me.uid && lastMsg.text) {
      const fetchReplies = async () => {
        const recentText = messages.slice(-5).map(m => m.text).filter(Boolean) as string[];
        const replies = await geminiService.getSmartReplies(recentText);
        setSmartReplies(replies);
      };
      fetchReplies();
    } else {
      setSmartReplies([]);
    }
  }, [messages, me.uid]);

  const handleSummarize = async () => {
    setIsSummarizing(true);
    const msgData = messages.map(m => ({
      sender: m.senderId === me.uid ? 'Me' : contact.profile?.name || 'Them',
      text: m.text || (m.imageUrl ? '[Image]' : '[File]')
    }));
    const res = await geminiService.summarizeChat(msgData);
    setSummary(res || "Could not summarize.");
    setIsSummarizing(false);
  };

  const handleImproveTone = async () => {
    if (!inputText.trim() || isImproving) return;
    setIsImproving(true);
    const improved = await geminiService.improveTone(inputText);
    if (improved) setInputText(improved);
    setIsImproving(false);
  };

  const handleTranslate = async (msgId: string, text: string) => {
    if (translatingId) return;
    setTranslatingId(msgId);
    const translated = await geminiService.translateMessage(text);
    if (translated) {
      setTranslations(prev => ({ ...prev, [msgId]: translated }));
    }
    setTranslatingId(null);
  };

  const handleTranscribe = async (msgId: string, audioUrl: string) => {
    if (transcribingId) return;
    setTranscribingId(msgId);
    const transcribed = await geminiService.transcribeAudio(audioUrl);
    if (transcribed) {
      setTranscriptions(prev => ({ ...prev, [msgId]: transcribed }));
    }
    setTranscribingId(null);
  };

  const handleAIReply = async (text: string) => {
    setIsTyping(true);
    const reply = await geminiService.generateResponse(`The user said: "${text}". Suggest a good reply.`);
    if (reply) setInputText(reply);
    setIsTyping(false);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleSend = async (
    e?: React.FormEvent, 
    payload?: { 
      imageUrl?: string, 
      fileUrl?: string, 
      fileName?: string, 
      fileType?: string,
      location?: { lat: number, lng: number },
      audioUrl?: string
    }
  ) => {
    e?.preventDefault();
    if (!inputText.trim() && !payload) return;

    const msgData: any = {
      senderId: me.uid,
      timestamp: serverTimestamp()
    };

    if (inputText.trim()) msgData.text = inputText;
    if (payload) {
      if (payload.imageUrl) msgData.imageUrl = payload.imageUrl;
      if (payload.fileUrl) {
        msgData.fileUrl = payload.fileUrl;
        msgData.fileName = payload.fileName;
        msgData.fileType = payload.fileType;
      }
      if (payload.location) msgData.location = payload.location;
      if (payload.audioUrl) msgData.audioUrl = payload.audioUrl;
    }

    const newMsgRef = push(ref(db, `messages/${contact.chatId}`));
    await set(newMsgRef, msgData);
    
    // Update unread count for other
    const unreadRef = ref(db, `unreadCounts/${contact.uid}/${contact.chatId}`);
    const snap = await get(unreadRef);
    await set(unreadRef, (snap.val() || 0) + 1);

    setInputText('');
    handleTyping(false);
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (limit to 1MB for Realtime Database)
    if (file.size > 1024 * 1024) {
      alert("File too large. Please select a file smaller than 1MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (file.type.startsWith('image/')) {
        handleSend(undefined, { imageUrl: base64 });
      } else {
        handleSend(undefined, { 
          fileUrl: base64, 
          fileName: file.name, 
          fileType: file.type 
        });
      }
    };
    reader.readAsDataURL(file);
    
    // Reset input
    e.target.value = '';
  };

  const handleLocationShare = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition((position) => {
      setIsLocating(false);
      handleSend(undefined, {
        location: {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }
      });
    }, (error) => {
      setIsLocating(false);
      let msg = "Unable to retrieve your location";
      if (error.code === error.PERMISSION_DENIED) msg = "Location permission denied. Please enable it in your browser settings.";
      else if (error.code === error.POSITION_UNAVAILABLE) msg = "Location information is unavailable.";
      else if (error.code === error.TIMEOUT) msg = "Location request timed out.";
      alert(msg);
    }, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          handleSend(undefined, { audioUrl: base64 });
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("Could not access microphone: " + err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleTyping = (typing: boolean) => {
    if (typing === isTyping) return;
    setIsTyping(typing);
    set(ref(db, `typing/${contact.chatId}/${me.uid}`), typing ? true : null);

    if (typing) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => handleTyping(false), 3000);
    }
  };

  const startCall = async (type: 'voice' | 'video') => {
    // Ensure Tone is started on user interaction
    Tone.start();
    const callId = push(ref(db, 'calls')).key;
    const callData = {
      callerId: me.uid,
      calleeId: contact.uid,
      type,
      status: 'ringing',
      timestamp: serverTimestamp()
    };
    
    await set(ref(db, `calls/${callId}`), callData);

    // Log outgoing call for caller
    const logData = {
      type,
      otherId: contact.uid,
      otherName: contact.profile?.name,
      status: 'outgoing',
      timestamp: Date.now()
    };
    push(ref(db, `callLogs/${me.uid}`), logData);
  };

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute inset-0 bg-background z-50 flex flex-col"
    >
      {/* Header */}
      <header className="p-4 flex items-center gap-3 border-b border-white/5 bg-container/50 backdrop-blur-md">
        <button onClick={onClose} className="p-1 text-text/60">
          <ArrowLeft size={24} />
        </button>
        <div className="flex-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10">
            <img src={contact.profile?.dpUrl} alt="" className="w-full h-full object-cover" />
          </div>
          <div>
            <h3 className="font-bold text-sm leading-tight">{contact.profile?.name}</h3>
            <p className="text-[10px] text-primary">
              {otherIsTyping ? 'typing...' : contact.status}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <button 
            onClick={handleSummarize} 
            disabled={isSummarizing}
            className={cn("p-2 text-text/60 hover:text-primary", isSummarizing && "animate-pulse")}
            title="Summarize Chat"
          >
            <Sparkles size={20} />
          </button>
          <button onClick={() => startCall('voice')} className="p-2 text-text/60 hover:text-primary">
            <Phone size={20} />
          </button>
          <button onClick={() => startCall('video')} className="p-2 text-text/60 hover:text-primary">
            <Video size={20} />
          </button>
          <button className="p-2 text-text/60 hover:text-primary">
            <MoreVertical size={20} />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
      >
        {summary && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-primary/10 border border-primary/20 p-4 rounded-2xl mb-4 relative"
          >
            <button 
              onClick={() => setSummary(null)}
              className="absolute top-2 right-2 text-text/40 hover:text-text"
            >
              <X size={14} />
            </button>
            <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2 flex items-center gap-2">
              <Sparkles size={12} />
              AI Summary
            </h4>
            <div className="text-xs text-text/80 leading-relaxed whitespace-pre-wrap">
              {summary}
            </div>
          </motion.div>
        )}
        
        {messages.map((msg) => {
          const isMe = msg.senderId === me.uid;
          return (
            <div 
              key={msg.id}
              className={cn(
                "flex flex-col max-w-[80%]",
                isMe ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              <div className={cn(
                "p-3 rounded-2xl text-sm",
                isMe 
                  ? "bg-primary text-background rounded-tr-none" 
                  : "bg-white/5 text-text rounded-tl-none border border-white/5"
              )}>
                {msg.imageUrl && (
                  <img 
                    src={msg.imageUrl} 
                    alt="" 
                    className="max-w-full rounded-lg mb-2" 
                    referrerPolicy="no-referrer"
                  />
                )}
                {msg.fileUrl && (
                  <div className="flex items-center gap-3 p-2 bg-white/5 rounded-xl border border-white/10 mb-2">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                      <File size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{msg.fileName}</p>
                      <p className="text-[10px] opacity-50 uppercase">{msg.fileType?.split('/')[1] || 'file'}</p>
                    </div>
                    <a 
                      href={msg.fileUrl} 
                      download={msg.fileName}
                      className="p-2 hover:text-primary transition-colors"
                    >
                      <Download size={18} />
                    </a>
                  </div>
                )}
                {msg.location && (
                  <a 
                    href={`https://www.google.com/maps?q=${msg.location.lat},${msg.location.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-2 bg-white/5 rounded-xl border border-white/10 mb-2 hover:bg-white/10 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                      <MapPin size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium">Shared Location</p>
                      <p className="text-[10px] opacity-50">View on Google Maps</p>
                    </div>
                  </a>
                )}
                {msg.audioUrl && (
                  <div className="mb-2">
                    <audio controls src={msg.audioUrl} className="w-full h-8 custom-audio-player" />
                    {transcriptions[msg.id] && (
                      <div className="mt-2 p-2 bg-black/20 rounded-lg text-[10px] italic border border-white/5">
                        <div className="flex items-center gap-1 mb-1 text-primary font-bold uppercase tracking-widest text-[7px]">
                          <Mic size={8} /> Transcript
                        </div>
                        {transcriptions[msg.id]}
                      </div>
                    )}
                  </div>
                )}
                {msg.text}
                {translations[msg.id] && (
                  <div className="mt-2 pt-2 border-t border-white/10 text-[11px] italic text-text/60">
                    <div className="flex items-center gap-1 mb-1 text-primary font-bold uppercase tracking-widest text-[8px]">
                      <Zap size={8} /> Translated
                    </div>
                    {translations[msg.id]}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[8px] text-text/30">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.text && !translations[msg.id] && (
                  <button 
                    onClick={() => handleTranslate(msg.id, msg.text!)}
                    disabled={!!translatingId}
                    className="text-[8px] text-primary hover:underline uppercase font-bold tracking-tighter"
                  >
                    {translatingId === msg.id ? 'Translating...' : 'Translate'}
                  </button>
                )}
                {msg.audioUrl && !transcriptions[msg.id] && (
                  <button 
                    onClick={() => handleTranscribe(msg.id, msg.audioUrl!)}
                    disabled={!!transcribingId}
                    className="text-[8px] text-primary hover:underline uppercase font-bold tracking-tighter"
                  >
                    {transcribingId === msg.id ? 'Transcribing...' : 'Transcribe'}
                  </button>
                )}
                {!isMe && msg.text && (
                  <button 
                    onClick={() => handleAIReply(msg.text!)}
                    className="text-[8px] text-primary hover:underline uppercase font-bold tracking-tighter"
                  >
                    AI Reply
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {otherIsTyping && (
          <div className="flex items-center gap-2 text-[10px] text-text/40 italic">
            <div className="flex gap-1">
              <span className="w-1 h-1 bg-text/40 rounded-full animate-bounce" />
              <span className="w-1 h-1 bg-text/40 rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1 h-1 bg-text/40 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
            {contact.profile?.name} is typing
          </div>
        )}
      </div>

      {/* Smart Replies */}
      {smartReplies.length > 0 && (
        <div className="px-4 py-2 flex gap-2 overflow-x-auto custom-scrollbar no-scrollbar">
          {smartReplies.map((reply, i) => (
            <button
              key={i}
              onClick={() => {
                setInputText(reply);
                setSmartReplies([]);
              }}
              className="whitespace-nowrap px-4 py-2 bg-white/5 border border-white/10 rounded-full text-xs text-text/70 hover:bg-primary/10 hover:border-primary/30 transition-all"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 bg-container/50 border-t border-white/5 flex flex-col gap-3">
        {isRecording && (
          <div className="flex items-center justify-between bg-primary/10 p-3 rounded-2xl border border-primary/20 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
              <span className="text-xs font-medium text-primary">Recording Voice Message...</span>
            </div>
            <button 
              type="button" 
              onClick={stopRecording}
              className="p-2 bg-primary text-background rounded-full"
            >
              <Square size={16} fill="currentColor" />
            </button>
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileChange}
          />
          <button 
            type="button" 
            onClick={handleFileClick}
            className="p-2 text-text/40 hover:text-primary transition-colors"
            title="Attach File"
          >
            <Paperclip size={20} />
          </button>
          <button 
            type="button" 
            onClick={handleLocationShare}
            className={cn(
              "p-2 transition-colors",
              isLocating ? "text-primary animate-pulse" : "text-text/40 hover:text-primary"
            )}
            title={isLocating ? "Locating..." : "Share Location"}
            disabled={isLocating}
          >
            <MapPin size={20} />
          </button>
          <button 
            type="button" 
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            className={cn(
              "p-2 transition-colors",
              isRecording ? "text-red-500" : "text-text/40 hover:text-primary"
            )}
            title="Hold to Record"
          >
            <Mic size={20} />
          </button>
          <input 
            type="text" 
            placeholder="Type a message..."
            className="flex-1 bg-background border border-white/10 rounded-full px-4 py-2 text-sm focus:border-primary outline-none"
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              handleTyping(true);
            }}
          />
          {inputText.trim() && (
            <button 
              type="button"
              onClick={handleImproveTone}
              disabled={isImproving}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center border border-primary/20 text-primary hover:bg-primary/10 transition-all",
                isImproving && "animate-spin"
              )}
              title="Improve Tone"
            >
              <Zap size={18} />
            </button>
          )}
          <button 
            type="submit"
            className="w-10 h-10 bg-primary text-background rounded-full flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
            disabled={!inputText.trim() && !isRecording}
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </motion.div>
  );
}

// --- Modals ---

function SideMenu({ profile, onClose, onLogout, currentTheme, onThemeChange, onOpenSettings, onOpenCallLogs }: any) {
  return (
    <motion.div 
      initial={{ x: '-100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%' }}
      className="absolute inset-0 z-[60] flex"
    >
      <div className="w-3/4 bg-container h-full shadow-2xl flex flex-col border-r border-white/5">
        <div className="p-8 bg-primary/10 border-b border-white/5">
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-primary mb-4">
            <img src={profile.dpUrl} alt="" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-xl font-bold">{profile.name}</h2>
          <p className="text-xs text-primary font-mono">{profile.userId}</p>
          <p className="text-xs text-text/50 mt-2 italic">"{profile.bio}"</p>
        </div>
        
        <div className="flex-1 p-4 space-y-6 overflow-y-auto custom-scrollbar">
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold text-text/30 uppercase tracking-widest px-2">Menu</h3>
            <MenuButton icon={<Settings size={20} />} label="Settings" onClick={onOpenSettings} />
            <MenuButton icon={<Users size={20} />} label="Groups" />
            <MenuButton icon={<Phone size={20} />} label="Call Logs" onClick={onOpenCallLogs} />
          </div>

          <div className="space-y-3 px-2">
            <h3 className="text-[10px] font-bold text-text/30 uppercase tracking-widest">Theme Background</h3>
            <div className="flex flex-wrap gap-3">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onThemeChange(t.id)}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center",
                    currentTheme === t.id ? "border-primary scale-110" : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: t.color }}
                  title={t.name}
                >
                  {currentTheme === t.id && <Check size={14} className={t.id === 'classic' ? "text-black" : "text-white"} />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/5">
          <button 
            onClick={onLogout}
            className="w-full p-4 flex items-center gap-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
          >
            <LogOut size={20} />
            <span className="font-bold">Logout</span>
          </button>
        </div>
      </div>
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
    </motion.div>
  );
}

function MenuButton({ icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className="w-full p-4 flex items-center gap-3 text-text/70 hover:text-primary hover:bg-white/5 rounded-xl transition-all"
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}

function AddFriendModal({ me, onClose }: { me: UserProfile, onClose: () => void }) {
  const [searchId, setSearchId] = useState('');
  const [foundUser, setFoundUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSearch = async () => {
    setError('');
    setFoundUser(null);
    setSent(false);
    
    if (!searchId.startsWith('ar-')) {
      setError('Invalid Ar ID format (ar-xxxx)');
      return;
    }

    const idSnap = await get(ref(db, `userIds/${searchId}`));
    const uid = idSnap.val();
    
    if (!uid) {
      setError('User not found');
      return;
    }

    if (uid === me.uid) {
      setError("You can't add yourself!");
      return;
    }

    const profileSnap = await get(ref(db, `users/${uid}`));
    setFoundUser(profileSnap.val());
  };

  const sendRequest = async () => {
    if (!foundUser) return;
    const reqId = push(ref(db, `requests/${foundUser.uid}`)).key;
    await set(ref(db, `requests/${foundUser.uid}/${reqId}`), me.uid);
    setSent(true);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="absolute inset-0 z-[70] bg-background/90 backdrop-blur-md flex items-center justify-center p-6"
    >
      <div className="w-full bg-container rounded-3xl p-6 border border-white/10 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-primary">Add Friend</h2>
          <button onClick={onClose} className="p-2 text-text/40"><X size={24} /></button>
        </div>

        <div className="flex gap-2 mb-6">
          <input 
            type="text" 
            placeholder="ar-xxxx"
            className="flex-1 bg-background border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary outline-none"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
          />
          <button 
            onClick={handleSearch}
            className="bg-primary text-background p-3 rounded-xl active:scale-95 transition-transform"
          >
            <Search size={20} />
          </button>
        </div>

        {error && <p className="text-red-500 text-xs mb-4 text-center">{error}</p>}

        {foundUser && (
          <div className="bg-background/50 p-4 rounded-2xl flex flex-col items-center text-center border border-white/5">
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-primary mb-3">
              <img src={foundUser.dpUrl} alt="" className="w-full h-full object-cover" />
            </div>
            <h3 className="font-bold text-lg">{foundUser.name}</h3>
            <p className="text-xs text-text/50 mb-4">{foundUser.bio}</p>
            
            {sent ? (
              <div className="flex items-center gap-2 text-primary font-bold">
                <Check size={20} />
                Request Sent
              </div>
            ) : (
              <button 
                onClick={sendRequest}
                className="w-full py-3 bg-primary text-background font-bold rounded-xl active:scale-95 transition-transform"
              >
                Send Friend Request
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function SettingsModal({ profile, onClose }: { profile: UserProfile, onClose: () => void }) {
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio);
  const [emoji, setEmoji] = useState(profile.emoji);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await update(ref(db, `users/${profile.uid}`), {
        name: name.trim(),
        bio: bio.trim(),
        emoji,
        dpUrl: emojiToSVG(emoji)
      });
      onClose();
    } catch (err) {
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute inset-0 z-[70] bg-background/90 backdrop-blur-md flex items-center justify-center p-6"
    >
      <div className="w-full bg-container rounded-3xl p-6 border border-white/10 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Settings</h2>
          <button onClick={onClose} className="p-2 text-text/40"><X size={20} /></button>
        </div>
        
        <div className="space-y-4">
          <div className="flex justify-center mb-4">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-4xl border-2 border-primary">
              {emoji}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text/30 uppercase tracking-widest px-1">Display Name</label>
            <input 
              type="text" 
              className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text/30 uppercase tracking-widest px-1">Bio</label>
            <input 
              type="text" 
              className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary outline-none"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text/30 uppercase tracking-widest px-1">Profile Emoji</label>
            <div className="grid grid-cols-6 gap-2">
              {['😎', '🐱', '🤖', '🌟', '🔥', '🎨', '🎮', '🍕', '🚀', '🌈', '💎', '🍀'].map(e => (
                <button 
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-xl border transition-all",
                    emoji === e ? "border-primary bg-primary/10" : "border-white/5 hover:bg-white/5"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={handleSave}
            disabled={saving}
            className="w-full p-4 bg-primary text-background font-bold rounded-xl active:scale-95 transition-transform disabled:opacity-50 mt-4"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// --- Call Manager ---

function CallManager({ me }: { me: UserProfile | null }) {
  const [activeCall, setActiveCall] = useState<any>(null);
  const activeCallRef = useRef<any>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const ringtoneRef = useRef<Tone.Player | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!me?.uid) return;
    
    // Setup Tone.js ringtone
    const player = new Tone.Player({
      url: "https://tonejs.github.io/audio/berlin/ringtone.mp3",
      loop: true,
      onload: () => {
        // If we're already in a ringing state when loaded, start it
        const currentCall = activeCallRef.current;
        if (currentCall?.status === 'ringing' && currentCall?.calleeId === me.uid) {
          player.start();
        }
      }
    }).toDestination();
    ringtoneRef.current = player;

    // Listen for incoming calls
    const callsRef = ref(db, 'calls');
    const unsubscribe = onValue(callsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      const myCallId = Object.keys(data).find(id => {
        const call = data[id];
        return (call.calleeId === me.uid || call.callerId === me.uid) && call.status !== 'ended';
      });

      if (myCallId) {
        const callData = { id: myCallId, ...data[myCallId] };
        setActiveCall(callData);
        activeCallRef.current = callData;
        
        if (callData.status === 'ringing' && callData.calleeId === me.uid) {
          // Only start if loaded and not already playing
          if (player.loaded && player.state !== 'started') {
            player.start();
          }
        }
      } else {
        activeCallRef.current = null;
        endCallLocally();
      }
    });

    return () => {
      off(callsRef);
      endCallLocally();
      player.dispose();
    };
  }, [me?.uid]);

  const endCallLocally = () => {
    if (ringtoneRef.current && ringtoneRef.current.state === 'started') {
      ringtoneRef.current.stop();
    }
    localStream?.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    setRemoteStream(null);
    pc.current?.close();
    pc.current = null;
    setActiveCall(null);
  };

  const handleAccept = async () => {
    if (!activeCall || !me?.uid) return;
    // Ensure Tone is started on user interaction
    Tone.start();
    if (ringtoneRef.current && ringtoneRef.current.state === 'started') {
      ringtoneRef.current.stop();
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: activeCall.type === 'video'
      });
      setLocalStream(stream);

      pc.current = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      stream.getTracks().forEach(track => pc.current?.addTrack(track, stream));

      pc.current.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      pc.current.onicecandidate = (event) => {
        if (event.candidate) {
          const candidatesRef = ref(db, `calls/${activeCall.id}/candidates/${me.uid}`);
          push(candidatesRef, event.candidate.toJSON());
        }
      };

      // Listen for remote candidates
      const otherUid = activeCall.callerId === me.uid ? activeCall.calleeId : activeCall.callerId;
      const remoteCandidatesRef = ref(db, `calls/${activeCall.id}/candidates/${otherUid}`);
      onValue(remoteCandidatesRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          Object.values(data).forEach((candidate: any) => {
            pc.current?.addIceCandidate(new RTCIceCandidate(candidate));
          });
        }
      });

      if (activeCall.calleeId === me.uid) {
        // Log incoming call for callee
        const incomingLogData = {
          type: activeCall.type,
          otherId: activeCall.callerId,
          otherName: 'Incoming Call', // We could fetch the name if we had it, but for now this works
          status: 'incoming',
          timestamp: Date.now()
        };
        push(ref(db, `callLogs/${me.uid}`), incomingLogData);

        // Callee: Listen for offer, create answer
        onValue(ref(db, `calls/${activeCall.id}/offer`), async (snapshot) => {
          const offer = snapshot.val();
          if (offer && !pc.current?.remoteDescription) {
            await pc.current?.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.current?.createAnswer();
            await pc.current?.setLocalDescription(answer);
            await set(ref(db, `calls/${activeCall.id}/answer`), {
              type: answer?.type,
              sdp: answer?.sdp
            });
          }
        });
      }

      await update(ref(db, `calls/${activeCall.id}`), { status: 'active' });
    } catch (err: any) {
      console.error("Failed to accept call:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionError("Camera/Microphone permission denied. Please enable them in your browser settings.");
      } else {
        setPermissionError("Could not access camera/microphone. Please check your hardware.");
      }
      setTimeout(() => {
        handleEnd();
      }, 3000);
    }
  };

  // Caller logic: Create offer
  useEffect(() => {
    if (activeCall && activeCall.status === 'ringing' && activeCall.callerId === me?.uid && !pc.current) {
      const startCaller = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: activeCall.type === 'video'
          });
          setLocalStream(stream);

          pc.current = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
          });

          stream.getTracks().forEach(track => pc.current?.addTrack(track, stream));

          pc.current.ontrack = (event) => {
            setRemoteStream(event.streams[0]);
          };

          pc.current.onicecandidate = (event) => {
            if (event.candidate) {
              const candidatesRef = ref(db, `calls/${activeCall.id}/candidates/${me?.uid}`);
              push(candidatesRef, event.candidate.toJSON());
            }
          };

          const offer = await pc.current.createOffer();
          await pc.current.setLocalDescription(offer);
          await set(ref(db, `calls/${activeCall.id}/offer`), {
            type: offer.type,
            sdp: offer.sdp
          });

          // Listen for answer
          onValue(ref(db, `calls/${activeCall.id}/answer`), async (snapshot) => {
            const answer = snapshot.val();
            if (answer && !pc.current?.remoteDescription) {
              await pc.current?.setRemoteDescription(new RTCSessionDescription(answer));
            }
          });

          // Listen for remote candidates
          const otherUid = activeCall.calleeId;
          const remoteCandidatesRef = ref(db, `calls/${activeCall.id}/candidates/${otherUid}`);
          onValue(remoteCandidatesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
              Object.values(data).forEach((candidate: any) => {
                pc.current?.addIceCandidate(new RTCIceCandidate(candidate));
              });
            }
          });
        } catch (err: any) {
          console.error("Failed to start call:", err);
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setPermissionError("Camera/Microphone permission denied. Please enable them in your browser settings.");
          } else {
            setPermissionError("Could not access camera/microphone. Please check your hardware.");
          }
          setTimeout(() => {
            handleEnd();
          }, 3000);
        }
      };
      startCaller();
    }
  }, [activeCall, me?.uid]);

  const handleEnd = async () => {
    if (!activeCall) return;
    setPermissionError(null);
    await update(ref(db, `calls/${activeCall.id}`), { status: 'ended' });
    endCallLocally();
  };

  if (!activeCall) return null;

  return (
    <motion.div 
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      className="absolute inset-0 z-[100] bg-background flex flex-col items-center justify-center p-8"
    >
      <div className="flex flex-col items-center text-center mb-12">
        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary mb-6 animate-pulse">
          <img 
            src={activeCall.callerId === me.uid ? emojiToSVG('📞') : emojiToSVG('Incoming')} 
            alt="" 
            className="w-full h-full object-cover" 
          />
        </div>
        <h2 className="text-2xl font-bold mb-2">
          {activeCall.type === 'video' ? 'Video Call' : 'Voice Call'}
        </h2>
        <p className="text-primary animate-pulse uppercase tracking-widest text-xs font-bold">
          {permissionError ? permissionError : (activeCall.status === 'ringing' ? 'Ringing...' : 'In Call')}
        </p>
      </div>

      {permissionError && (
        <div className="mb-8 p-4 bg-red-500/20 border border-red-500/50 rounded-2xl text-red-500 text-sm text-center">
          {permissionError}
        </div>
      )}

      {activeCall.status === 'active' && activeCall.type === 'video' && (
        <div className="relative w-full aspect-[9/16] bg-container rounded-3xl overflow-hidden mb-8 border border-white/10">
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover"
            srcObject={remoteStream as any}
          />
          <div className="absolute top-4 right-4 w-1/3 aspect-[9/16] bg-background rounded-xl overflow-hidden border border-primary shadow-xl">
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover"
              srcObject={localStream as any}
            />
          </div>
        </div>
      )}

      <div className="flex gap-8">
        {activeCall.status === 'ringing' && activeCall.calleeId === me.uid ? (
          <>
            <button 
              onClick={handleAccept}
              className="w-16 h-16 bg-primary text-background rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-primary/20"
            >
              <Phone size={32} />
            </button>
            <button 
              onClick={handleEnd}
              className="w-16 h-16 bg-red-500 text-white rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-red-500/20"
            >
              <Phone size={32} className="rotate-[135deg]" />
            </button>
          </>
        ) : (
          <button 
            onClick={handleEnd}
            className="w-16 h-16 bg-red-500 text-white rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-red-500/20"
          >
            <Phone size={32} className="rotate-[135deg]" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
