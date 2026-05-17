'use client';

import { useState, useRef, useEffect } from 'react';

// --- HELPERS: Διαχείριση Ημερομηνιών ---
const getDaysInMonth = (year: number, month: number) => {
  const date = new Date(year, month, 1);
  const days = [];
  let firstDay = date.getDay() - 1;
  if (firstDay === -1) firstDay = 6; // Δευτέρα ως πρώτη μέρα
  
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

export default function Home() {
  const [messages, setMessages] = useState<{ 
    role: 'user' | 'ai', 
    text: string, 
    image_url?: string, 
    zoom_x?: number, 
    zoom_y?: number,
    reconciliation?: {
      is_matched: boolean;
      transaction_id: string;
      date: string;
      partner: string;
      amount: string;
      bank_status: string;
    } | null;
  }[]>([]);
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [uploadedFilesByDate, setUploadedFilesByDate] = useState<{ [key: string]: { name: string, url?: string }[] }>({});
  
  // --- ΝΕΑ STATES ΓΙΑ BONUS ΣΤΟΙΧΕΙΑ ---
  const [history, setHistory] = useState<string[]>([
    "Πληρώθηκε το τιμολόγιο UniDOC;",
    "Ποιο είναι το ΦΠΑ της Vodafone;",
    "Σύνολο πληρωμής CAD"
  ]);
  const [notes, setNotes] = useState<string>('');

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(8); // Σεπτέμβριος
  const [currentYear, setCurrentYear] = useState(2026);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const days = getDaysInMonth(currentYear, currentMonth);
  const monthNames = ["Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος", "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος"];
  const dayNames = ["Δ", "Τ", "Τ", "Π", "Π", "Σ", "Κ"];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- API & Upload Logic ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setIsLoading(true);
      
      setMessages((prev) => [...prev, { 
        role: 'ai', 
        text: `⏳ Έναρξη μαζικής επεξεργασίας για ${filesArray.length} αρχεία...` 
      }]);

      try {
        await Promise.all(filesArray.map(file => saveToDatabase(file)));
        setMessages((prev) => [...prev, { 
          role: 'ai', 
          text: `✨ Όλα τα αρχεία (${filesArray.length}) αναλύθηκαν και ταξινομήθηκαν στο ημερολόγιο!` 
        }]);
      } catch (error) {
        console.error(error);
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
      if (data.success) {
        const todayKey = getDateKey(new Date()); 
        setUploadedFilesByDate(prev => ({
          ...prev,
          [todayKey]: [...(prev[todayKey] || []), { name: file.name, url: data.image_url }]
        }));
        return true;
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'ai', text: `❌ Αποτυχία αποθήκευσης για το αρχείο: ${file.name}` }]);
      throw error;
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input;
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsLoading(true);

    // Προσθήκη της ερώτησης στο προσωρινό ιστορικό αν δεν υπάρχει ήδη
    if (!history.includes(userMsg)) {
      setHistory(prev => [userMsg, ...prev.slice(0, 4)]);
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMsg }),
      });
      const data = await response.json();
      
      setMessages((prev) => [...prev, { 
        role: 'ai', 
        text: data.answer || data.error || "Προέκυψε κάποιο σφάλμα.", 
        image_url: data.image_url,
        zoom_x: data.zoom_x,
        zoom_y: data.zoom_y,
        reconciliation: data.reconciliation
      }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'ai', text: "Σφάλμα σύνδεσης." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex h-screen w-full bg-gradient-to-br from-[#f0f9f4] to-[#e2f1e9] text-[#2d3748] font-sans overflow-hidden">
      
      {/* --- SIDEBAR --- */}
      <div className={`${isSidebarOpen ? 'w-[300px]' : 'w-0'} transition-all duration-300 ease-in-out bg-white/80 backdrop-blur-md border-r border-[#d0e8da] flex flex-col overflow-hidden shrink-0 shadow-sm`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100/50">
          <div className="text-[1.1rem] font-bold tracking-tight text-gray-800">
            info<span className="bg-[#1a7a4a] text-white px-1 py-0.5 rounded-md mx-0.5">4</span>invo
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-1 hover:bg-gray-100 rounded-md text-gray-500">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"></path></svg>
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-4 pb-8">
          <button onClick={() => { setMessages([]); }} className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-[#d0e8da] rounded-xl hover:border-[#1a7a4a] hover:bg-[#f4fbf7] transition-all text-sm font-medium text-gray-700 shadow-sm">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"></path></svg>
            Νέα Συνομιλία
          </button>

          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input type="text" placeholder="Αναζήτηση συνομιλιών..." className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#1a7a4a]" />
          </div>

          {/* Calendar Widget */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
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
                const fileCount = uploadedFilesByDate[dateKey]?.length || 0;
                const isSelected = selectedDate?.toDateString() === date.toDateString();

                return (
                  <div key={i} className="aspect-square flex items-center justify-center relative">
                    <button 
                      onClick={() => setSelectedDate(date)}
                      className={`w-7 h-7 flex flex-col items-center justify-center rounded-full text-xs transition-all relative
                        ${isSelected ? 'bg-[#1a7a4a] text-white font-bold shadow-md' : 'text-gray-600 hover:bg-gray-100'}
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
            <div className="bg-white/60 border border-[#d0e8da] rounded-2xl p-3 shadow-sm animate-fadeIn">
              <div className="text-[0.7rem] font-bold text-[#1a7a4a] uppercase tracking-wider mb-2">
                Έγγραφα: {selectedDate.getDate()} {monthNames[selectedDate.getMonth()]}
              </div>
              {uploadedFilesByDate[getDateKey(selectedDate)]?.length > 0 ? (
                <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                  {uploadedFilesByDate[getDateKey(selectedDate)].map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-gray-700 bg-white border border-gray-100 rounded-lg p-2 truncate">
                      <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                      <span className="truncate flex-1">{file.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[0.75rem] text-gray-400 italic text-center py-2">Κανένα τιμολόγιο αυτή τη μέρα.</div>
              )}
            </div>
          )}

          {/* --- ΝΕΟ WIDGET 1: ΠΡΟΣΩΡΙΝΟ ΙΣΤΟΡΙΚΟ --- */}
          <div className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm">
            <div className="text-[0.7rem] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Πρόσφατες Αναζητήσεις
            </div>
            <div className="space-y-1 max-h-[110px] overflow-y-auto">
              {history.map((item, idx) => (
                <button 
                  key={idx} 
                  type="button"
                  onClick={() => setInput(item)} 
                  className="w-full text-left text-xs text-gray-600 hover:text-[#1a7a4a] hover:bg-[#f4fbf7] rounded-lg p-2 truncate block transition-colors border border-transparent hover:border-[#d0e8da]"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* --- ΝΕΟ WIDGET 2: ΣΗΜΕΙΩΣΕΙΣ (SCRATCHPAD) --- */}
          <div className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm">
            <div className="text-[0.7rem] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
              Σημειώσεις Παρουσίασης
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Κρατήστε γρήγορες σημειώσεις, ποσά ή σχόλια των κριτών εδώ..."
              className="w-full h-24 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#1a7a4a] resize-none text-gray-700 placeholder-gray-400 leading-relaxed"
            />
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

              <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.png,.jpg,.jpeg" multiple onChange={handleFileUpload} />
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="w-full max-w-[600px] aspect-[2.5/1] border-2 border-dashed border-gray-300 rounded-[2rem] bg-white/50 hover:bg-white hover:border-[#1a7a4a] hover:shadow-lg transition-all flex flex-col items-center justify-center gap-3 group shadow-sm"
              >
                <div className="text-gray-400 group-hover:text-[#1a7a4a] transition-colors">
                  <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                </div>
                <div>
                  <div className="font-semibold text-gray-700 text-lg">Επιλέξτε ή σύρετε το τιμολόγιο εδώ</div>
                  <div className="text-sm text-gray-400 mt-1 uppercase tracking-wider">Υποστηρίζεται μαζικό ανέβασμα πολλών αρχείων</div>
                </div>
              </button>
            </div>
          ) : (
            
            <div className="max-w-[750px] w-full space-y-6">
              {messages.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-5 shadow-sm text-[0.95rem] leading-relaxed ${
                    msg.role === 'user' ? 'bg-white border border-gray-100 text-gray-800' : 'bg-transparent text-gray-800'
                  }`}>
                    {msg.role === 'ai' && (
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-[24px] h-[24px] bg-[#1a7a4a] rounded flex items-center justify-center">
                          <span className="text-white text-xs font-bold">4</span>
                        </div>
                        <span className="font-bold text-gray-800 text-sm">info4invo</span>
                      </div>
                    )}
                    
                    <div className={`${msg.role === 'ai' ? 'flex flex-col sm:flex-row items-start gap-5' : ''}`}>
                      {/* Zoom Box Component - Οριζόντιο & Ρυθμισμένο */}
                      {msg.role === 'ai' && msg.image_url && msg.zoom_x !== undefined && msg.zoom_y !== undefined && (
                        <div className="flex flex-col items-center shrink-0">
                          <div 
                            className="w-48 h-20 rounded-xl border-2 border-[#1a7a4a]/20 shadow-md bg-white overflow-hidden"
                            style={{
                              backgroundImage: `url(${msg.image_url})`,
                              backgroundSize: '250%', 
                              backgroundPosition: `${Math.min((msg.zoom_x) + 12, 100)}% ${msg.zoom_y}%`,
                              backgroundRepeat: 'no-repeat'
                            }}
                          />
                          <span className="text-[0.65rem] text-[#1a7a4a] font-bold uppercase tracking-wider mt-2 bg-[#d6f5e6] px-2 py-0.5 rounded-md">
                            Απόσπασμα
                          </span>
                        </div>
                      )}
                      
                      <div className="flex-1 space-y-3">
                        <p className="whitespace-pre-wrap mt-1">{msg.text}</p>
                        
                        {/* --- BONUS TASK: VISUAL BANK RECONCILIATION CARD --- */}
                        {msg.role === 'ai' && msg.reconciliation && (
                          <div className={`mt-3 border p-4 rounded-xl shadow-sm ${
                            msg.reconciliation.is_matched 
                              ? 'bg-emerald-50/70 border-emerald-200' 
                              : 'bg-amber-50/70 border-amber-200'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-gray-700">
                                🏦 Διασταύρωση Τράπεζας (Reconciliation)
                              </div>
                              <span className={`text-[0.65rem] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                                msg.reconciliation.is_matched 
                                  ? 'bg-emerald-200 text-emerald-800 border-emerald-300' 
                                  : 'bg-amber-200 text-amber-800 border-amber-300'
                              }`}>
                                {msg.reconciliation.is_matched ? '✓ VERIFIED / PAID' : '⚠ UNMATCHED / UNPAID'}
                              </span>
                            </div>
                            
                            {msg.reconciliation.is_matched ? (
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-gray-600 mt-2">
                                <div><span className="text-gray-400">ID Συναλλαγής:</span> <code className="font-mono bg-white/60 px-1 rounded">{msg.reconciliation.transaction_id}</code></div>
                                <div><span className="text-gray-400">Ημ/νία Πληρωμής:</span> {msg.reconciliation.date}</div>
                                <div><span className="text-gray-400">Δικαιούχος:</span> {msg.reconciliation.partner}</div>
                                <div><span className="text-gray-400">Ποσό Τράπεζας:</span> <span className="font-semibold text-emerald-700">-{msg.reconciliation.amount} €</span></div>
                              </div>
                            ) : (
                              <div className="text-xs text-amber-800 italic mt-1">
                                Ο AI Agent σκάναρε το τραπεζικό statement (CSV) αλλά δεν εντόπισε καμία εξερχόμενη πληρωμή που να αντιστοιχεί στο ποσό αυτού του τιμολογίου.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {msg.image_url && (
                      <div className="mt-5 border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                        <img src={msg.image_url} alt="Source Document" className="w-full h-auto block" />
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
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#e2f1e9] via-[#e2f1e9]/90 to-transparent pt-10 pb-6 px-4">
          <div className="max-w-[700px] mx-auto">
            <form onSubmit={sendMessage} className="relative flex items-center bg-white rounded-full shadow-lg border border-gray-100">
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ρωτήστε το info4invo οτιδήποτε..." disabled={isLoading} className="w-full bg-transparent pl-6 pr-14 py-4 text-gray-800 text-[0.95rem] focus:outline-none disabled:opacity-50" />
              <button type="submit" disabled={isLoading || !input.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 w-[34px] h-[34px] bg-gray-100 rounded-full flex items-center justify-center text-gray-400 hover:bg-[#1a7a4a] hover:text-white transition-all disabled:opacity-50">
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