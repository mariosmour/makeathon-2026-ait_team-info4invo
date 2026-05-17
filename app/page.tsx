'use client';

import { useState, useRef, useEffect } from 'react';

// --- HELPERS: Διαχείριση Ημερομηνιών ---
const getDaysInMonth = (year: number, month: number) => {
  const date = new Date(year, month, 1);
  const days = [];
  let firstDay = date.getDay() - 1;
  if (firstDay === -1) firstDay = 6;
  
  for (let i = 0; i < firstDay; i++) days.push(null);
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
};

const getDateKey = (date: Date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// --- TYPES ---
interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  image_url?: string;
  box_left?: number;
  box_top?: number;
  box_width?: number;
  box_height?: number;
}

interface ChatSession {
  id: string;
  title: string;
  date: Date;
  messages: ChatMessage[];
  isFile: boolean; 
  fileNames?: string[]; 
  notes?: string; 
}

export default function Home() {
  const [history, setHistory] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  // 🚀 REF ΣΥΓΧΡΟΝΙΣΜΟΥ: Προστατεύει από λάθη γρήγορης πληκτρολόγησης
  const activeSessionRef = useRef<string | null>(null);
  
  const [activeNotes, setActiveNotes] = useState('');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth()); 
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const days = getDaysInMonth(currentYear, currentMonth);
  const monthNames = ["Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος", "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος"];
  const dayNames = ["Δ", "Τ", "Τ", "Π", "Π", "Σ", "Κ"];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Συγχρονίζουμε το Ref με το State για να μην υπάρχουν καθυστερήσεις
  useEffect(() => {
    activeSessionRef.current = activeSessionId;
  }, [activeSessionId]);

  // 🚀 FAST NOTES LOGIC (Με απόλυτη ασφάλεια χάρη στο useRef)
  const handleNotesChange = (text: string) => {
    setActiveNotes(text);
    
    if (activeSessionRef.current) {
      setHistory(prev => prev.map(s => s.id === activeSessionRef.current ? { ...s, notes: text } : s));
    } else {
      const newId = `note_${Date.now()}`;
      setActiveSessionId(newId);
      activeSessionRef.current = newId; // Άμεση ενημέρωση του Ref!
      
      const newSession: ChatSession = {
        id: newId,
        title: `📝 Σημείωση...`,
        date: new Date(),
        messages: [],
        isFile: false,
        notes: text
      };
      setHistory(prev => [newSession, ...prev]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setIsLoading(true);
      
      // 🚀 ΤΥΠΙΚΗ ΑΣΦΑΛΕΙΑ TYPESCRIPT: Δεν θα βγάλει ποτέ null error
      const currentId = activeSessionRef.current || `doc_${Date.now()}`;
      const isExistingSession = !!activeSessionRef.current;
      
      const initialMsg: ChatMessage = { role: 'ai', text: `⏳ Έναρξη ανάλυσης για ${filesArray.length} νέο(α) αρχείο(α)...` };

      if (!isExistingSession) {
        const newSession: ChatSession = {
          id: currentId,
          title: `📄 ${filesArray[0].name} ${filesArray.length > 1 ? `(+${filesArray.length - 1})` : ''}`,
          date: new Date(),
          messages: [initialMsg],
          isFile: true,
          fileNames: filesArray.map(f => f.name),
          notes: activeNotes
        };
        setHistory(prev => [newSession, ...prev]);
        setActiveSessionId(currentId);
        activeSessionRef.current = currentId;
        setMessages([initialMsg]);
      } else {
        setMessages(prev => [...prev, initialMsg]);
        setHistory(prev => prev.map(s => s.id === currentId ? {
          ...s,
          messages: [...s.messages, initialMsg],
          fileNames: [...(s.fileNames || []), ...filesArray.map(f => f.name)], 
          isFile: true 
        } : s));
      }

      try {
        await Promise.all(filesArray.map(file => saveToDatabase(file)));
        
        const successMsg: ChatMessage = { role: 'ai', text: `✨ ${filesArray.length} νέο(α) αρχείο(α) προστέθηκαν στη συνομιλία! Πώς μπορώ να βοηθήσω;` };
        setMessages(prev => [...prev, successMsg]);
        setHistory(prev => prev.map(s => s.id === currentId ? { ...s, messages: [...s.messages, successMsg] } : s));
      } catch (error) {
        console.error("Upload error:", error);
      } finally {
        setIsLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  const getBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const saveToDatabase = async (file: File) => {
    try {
      const base64Image = await getBase64(file);
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image, filename: file.name }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return true;
    } catch (error) {
      throw error;
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsgText = input;
    const userMsgObj: ChatMessage = { role: 'user', text: userMsgText };
    
    setInput('');
    setIsLoading(true);

    let currentId = activeSessionRef.current;
    let nextMsgs = [...messages, userMsgObj];

    if (!currentId) {
      currentId = `chat_${Date.now()}`;
      setActiveSessionId(currentId);
      activeSessionRef.current = currentId;
      const newSession: ChatSession = {
        id: currentId,
        title: `💬 ${userMsgText.slice(0, 22)}${userMsgText.length > 22 ? '...' : ''}`,
        date: new Date(),
        messages: nextMsgs,
        isFile: false,
        notes: activeNotes 
      };
      setHistory(prev => [newSession, ...prev]);
      setMessages(nextMsgs);
    } else {
      setMessages(nextMsgs);
      setHistory(prev => prev.map(s => s.id === currentId ? { ...s, messages: nextMsgs } : s));
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMsgText }),
      });
      const data = await response.json();
      
      const aiMsgObj: ChatMessage = { 
        role: 'ai', 
        text: data.answer || data.error || "Προέκυψε κάποιο σφάλμα.", 
        image_url: data.image_url,
        box_left: data.box_left,
        box_top: data.box_top,
        box_width: data.box_width,
        box_height: data.box_height
      };

      const finalMsgs = [...nextMsgs, aiMsgObj];
      setMessages(finalMsgs);
      setHistory(prev => prev.map(s => s.id === currentId ? { ...s, messages: finalMsgs } : s));
    } catch (error) {
      const errorMsg: ChatMessage = { role: 'ai', text: "Σφάλμα σύνδεσης." };
      setMessages(prev => [...prev, errorMsg]);
      setHistory(prev => prev.map(s => s.id === currentId ? { ...s, messages: [...s.messages, errorMsg] } : s));
    } finally {
      setIsLoading(false);
    }
  };

  const fileCountsByDate: { [key: string]: number } = {};
  history.forEach(session => {
    if (session.isFile && session.fileNames) {
      const key = getDateKey(session.date);
      fileCountsByDate[key] = (fileCountsByDate[key] || 0) + session.fileNames.length;
    }
  });

  const filteredHistory = history.filter(session => {
    if (!selectedDate) return true;
    return getDateKey(session.date) === getDateKey(selectedDate);
  });

  // 🚀 ΑΣΦΑΛΕΙΑ TYPESCRIPT: Αντικατάσταση του flatMap με reduce!
  const selectedDateFiles = filteredHistory
    .filter(s => s.isFile && s.fileNames)
    .reduce((acc, s) => acc.concat(s.fileNames || []), [] as string[]);

  return (
    <main className="flex h-screen w-full bg-gradient-to-br from-[#f0f9f4] to-[#e2f1e9] text-[#2d3748] font-sans overflow-hidden relative">
      
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".pdf,.png,.jpg,.jpeg" 
        multiple 
        onChange={handleFileUpload} 
      />

      {/* --- SIDEBAR --- */}
      <div className={`${isSidebarOpen ? 'w-[300px]' : 'w-0'} transition-all duration-300 ease-in-out bg-white/80 backdrop-blur-md border-r border-[#d0e8da] flex flex-col overflow-hidden shrink-0 shadow-sm z-20`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100/50">
          <div className="text-[1.1rem] font-bold tracking-tight text-gray-800">
            info<span className="bg-[#1a7a4a] text-white px-1 py-0.5 rounded-md mx-0.5">4</span>invo
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-1 hover:bg-gray-100 rounded-md text-gray-500">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"></path></svg>
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-4">
          <button onClick={() => { 
            setActiveSessionId(null); 
            activeSessionRef.current = null;
            setMessages([]); 
            setActiveNotes(''); 
          }} className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-[#d0e8da] rounded-xl hover:border-[#1a7a4a] hover:bg-[#f4fbf7] transition-all text-sm font-medium text-gray-700 shadow-sm shrink-0">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"></path></svg>
            Νέα Συνομιλία
          </button>

          {/* Calendar Widget */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-bold text-sm text-gray-800">{monthNames[currentMonth]}</div>
                <div className="text-[0.65rem] text-gray-400 font-medium tracking-wide uppercase">Έτος {currentYear}</div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setCurrentMonth(prev => prev === 0 ? 11 : prev - 1)} className="p-1.5 hover:bg-gray-100 rounded text-gray-500"><svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"></path></svg></button>
                <button onClick={() => setCurrentMonth(prev => prev === 11 ? 0 : prev + 1)} className="p-1.5 hover:bg-gray-100 rounded text-gray-500"><svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"></path></svg></button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {dayNames.map((d, i) => <div key={i} className="text-[0.65rem] font-bold text-gray-400">{d}</div>)}
            </div>
            
            <div className="grid grid-cols-7 gap-1 text-center">
              {days.map((date, i) => {
                if (!date) return <div key={i} className="aspect-square" />;
                
                const dateKey = getDateKey(date);
                const fileCount = fileCountsByDate[dateKey] || 0;
                const isSelected = selectedDate?.toDateString() === date.toDateString();

                return (
                  <div key={i} className="aspect-square flex items-center justify-center relative">
                    <button 
                      onClick={() => {
                        if (fileCount > 0) {
                          setSelectedDate(isSelected ? null : date);
                        }
                      }}
                      className={`w-7 h-7 flex flex-col items-center justify-center rounded-full text-xs transition-all relative
                        ${isSelected ? 'bg-[#1a7a4a] text-white font-bold shadow-md' : 'text-gray-600 hover:bg-gray-100'}
                        ${fileCount > 0 ? 'cursor-pointer' : 'cursor-default'}
                      `}
                    >
                      <span>{date.getDate()}</span>
                      {fileCount > 0 && !isSelected && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#22a060] text-white rounded-full text-[0.55rem] font-bold flex items-center justify-center border border-white">
                          {fileCount}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedDate && (
            <div className="bg-[#f4fbf7] border border-[#1a7a4a]/20 rounded-xl p-3 shadow-sm animate-fadeIn flex flex-col gap-2 shrink-0">
              <div className="flex items-center justify-between border-b border-[#1a7a4a]/10 pb-2">
                <span className="text-[0.7rem] font-bold text-[#1a7a4a] uppercase tracking-wider">
                  📅 {selectedDate.getDate()} {monthNames[selectedDate.getMonth()]}
                </span>
                <button onClick={() => setSelectedDate(null)} className="text-[#1a7a4a] hover:bg-[#d0e8da] rounded p-0.5 transition-colors" title="Εκκαθάριση φίλτρου">
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
              
              <div className="max-h-[120px] overflow-y-auto space-y-1 mt-1 pr-1">
                {selectedDateFiles.length > 0 ? (
                  selectedDateFiles.map((fname, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-[0.7rem] text-gray-700 bg-white border border-gray-100 rounded-lg p-1.5 truncate shadow-sm">
                      <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" className="text-[#1a7a4a] shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                      <span className="truncate flex-1 font-medium">{fname}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-[0.7rem] text-gray-500 italic text-center py-2">Μόνο συνομιλίες αυτή τη μέρα.</div>
                )}
              </div>
            </div>
          )}

          {/* 🚀 FAST NOTES WIDGET */}
          <div className="bg-[#fffdf0] border border-[#f5e6ab] rounded-2xl p-3 shadow-sm shrink-0 flex flex-col transition-all group">
            <div className="flex items-center gap-1.5 mb-2">
              <svg width="14" height="14" fill="none" stroke="#d4a32b" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
              <span className="text-[0.7rem] font-bold text-[#d4a32b] uppercase tracking-wider">Fast Notes</span>
            </div>
            <textarea
              value={activeNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Σημειώστε κάτι σημαντικό εδώ..."
              className="w-full bg-transparent text-[0.8rem] text-gray-700 resize-none outline-none placeholder:text-[#d4a32b]/50 min-h-[70px]"
            />
          </div>

          {/* ΙΣΤΟΡΙΚΟ ΣΥΝΟΜΙΛΙΩΝ */}
          <div className="flex-1 flex flex-col pt-2 border-t border-gray-100 min-h-0">
            <div className="text-[0.7rem] font-bold text-[#1a7a4a] uppercase tracking-wider mb-3 px-1 shrink-0">
              {selectedDate ? 'Συνομιλιες Ημερας' : 'Ιστορικο Συνομιλιων'}
            </div>
            
            <div className="overflow-y-auto space-y-1 pr-1">
              {filteredHistory.length === 0 ? (
                <div className="text-[0.75rem] text-gray-400 italic text-center py-4">Δεν υπάρχουν συνομιλίες.</div>
              ) : (
                filteredHistory.map(session => (
                  <button 
                    key={session.id}
                    onClick={() => { 
                      setActiveSessionId(session.id); 
                      activeSessionRef.current = session.id;
                      setMessages(session.messages); 
                      setActiveNotes(session.notes || ''); 
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all text-left ${
                      activeSessionId === session.id 
                        ? 'bg-white border border-[#d0e8da] text-[#1a7a4a] font-bold shadow-sm' 
                        : 'text-gray-600 hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <svg className="shrink-0" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
                    </svg>
                    <span className="truncate flex-1">{session.title}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 flex flex-col relative min-w-0">
        
        {!isSidebarOpen && (
          <div className="absolute top-4 left-4 z-10">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-white/80 backdrop-blur-sm border border-[#d0e8da] rounded-lg shadow-sm text-gray-600 hover:text-[#1a7a4a] transition-colors">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 pb-32 pt-12 flex flex-col items-center">
          
          {messages.length === 0 ? (
            <div className="max-w-[700px] w-full flex flex-col items-center justify-center mt-10 lg:mt-24 animate-fadeIn">
              <h1 className="text-[2.8rem] font-bold tracking-tight text-gray-800 mb-4">
                info<span className="bg-[#1a7a4a] text-white px-2 py-0.5 rounded-lg mx-0.5">4</span>invo
              </h1>
              <p className="text-gray-500 text-center mb-10 max-w-[450px]">
                Ανεβάστε το τιμολόγιο. Όλα τα δεδομένα σας αναλύονται και αποθηκεύονται με ασφάλεια στη βάση δεδομένων.
              </p>

              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="w-full max-w-[600px] aspect-[2.5/1] border-2 border-dashed border-gray-300 rounded-[2rem] bg-white/50 hover:bg-white hover:border-[#1a7a4a] hover:shadow-lg transition-all flex flex-col items-center justify-center gap-3 group shadow-sm"
              >
                <div className="text-gray-400 group-hover:text-[#1a7a4a] transition-colors">
                  <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                </div>
                <div>
                  <div className="font-semibold text-gray-700 text-lg">Επιλέξτε ή σύρετε το τιμολόγιο εδώ</div>
                  <div className="text-sm text-gray-400 mt-1 uppercase tracking-wider">Μπορείτε να επιλέξετε πολλά αρχεία (PDF, PNG, JPG)</div>
                </div>
              </button>
            </div>
          ) : (
            
            <div className="max-w-[750px] w-full space-y-6">
              {messages.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] rounded-2xl p-5 shadow-sm text-[0.95rem] leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-white border border-gray-100 text-gray-800' 
                      : 'bg-transparent text-gray-800'
                  }`}>
                    
                    {msg.role === 'ai' && (
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-[24px] h-[24px] bg-[#1a7a4a] rounded flex items-center justify-center">
                          <span className="text-white text-xs font-bold">4</span>
                        </div>
                        <span className="font-bold text-gray-800 text-sm">info4invo</span>
                      </div>
                    )}
                    
                    <p className="whitespace-pre-wrap">{msg.text}</p>

                    {/* 🚀 ΑΣΦΑΛΕΙΑ ΣΤΟ CSS: Δεν εμφανίζεται το πλαίσιο αν κάποιο από τα 4 νούμερα λείπει */}
                    {msg.role === 'ai' && msg.image_url && 
                     msg.box_left !== undefined && msg.box_top !== undefined && 
                     msg.box_width !== undefined && msg.box_height !== undefined && (
                      <div className="mt-4 w-full flex flex-col items-start">
                        <span className="text-[0.65rem] text-[#1a7a4a] font-bold uppercase tracking-wider mb-2 bg-[#d6f5e6] px-2 py-0.5 rounded-md">
                          🔍 Οπτική Τεκμηρίωση
                        </span>
                        
                        <div className="w-full relative h-[160px] rounded-xl border border-[#1a7a4a]/20 overflow-hidden bg-gray-50 shadow-sm flex items-center">
                           <div 
                             className="w-full relative transition-transform duration-500"
                             style={{ transform: `translateY(calc(-${msg.box_top}% + 80px))` }}
                           >
                              <img src={msg.image_url} className="w-full h-auto opacity-90" alt="Evidence" />
                              
                              <div 
                                className="absolute border-[3px] border-[#1a7a4a] rounded-md shadow-[0_0_0_9999px_rgba(255,255,255,0.65)]"
                                style={{
                                  left: `${msg.box_left}%`,
                                  top: `${msg.box_top}%`,
                                  width: `${msg.box_width}%`,
                                  height: `${msg.box_height}%`,
                                }}
                              />
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 text-gray-400 text-sm pl-2">
                   <div className="w-2 h-2 bg-[#1a7a4a] rounded-full animate-bounce"></div>
                   <div className="w-2 h-2 bg-[#1a7a4a] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                   <div className="w-2 h-2 bg-[#1a7a4a] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* --- FIXED BOTTOM INPUT --- */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#e2f1e9] via-[#e2f1e9]/90 to-transparent pt-10 pb-6 px-4 z-10">
          <div className="max-w-[700px] mx-auto">
            <form onSubmit={sendMessage} className="relative flex items-center bg-white rounded-full shadow-lg border border-gray-100">
              
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isLoading}
                title="Επισύναψη νέου εγγράφου"
                className="absolute left-2 top-1/2 -translate-y-1/2 w-[34px] h-[34px] bg-gray-50 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-[#1a7a4a] transition-all disabled:opacity-50"
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
              </button>

              <input 
                type="text" 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                placeholder="Ρωτήστε το info4invo ή επισυνάψτε αρχείο..." 
                disabled={isLoading} 
                className="w-full bg-transparent pl-12 pr-14 py-4 text-gray-800 text-[0.95rem] focus:outline-none disabled:opacity-50" 
              />
              
              <button 
                type="submit" 
                disabled={isLoading || !input.trim()} 
                className="absolute right-2 top-1/2 -translate-y-1/2 w-[34px] h-[34px] bg-gray-100 rounded-full flex items-center justify-center text-gray-400 hover:bg-[#1a7a4a] hover:text-white transition-all disabled:opacity-50"
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>
              </button>
            </form>
            <div className="text-center mt-3 text-[0.65rem] text-gray-400">
              Το info4invo μπορεί να κάνει λάθη. Ελέγξτε τις σημαντικές πληροφορίες.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
