'use client';

import { useState, useRef, useEffect } from 'react';

// --- HELPER: Generate Calendar Days ---
const getDaysInMonth = (year: number, month: number) => {
  const date = new Date(year, month, 1);
  const days = [];
  // Adjust to make Monday the first day of the week (Greek standard)
  let firstDay = date.getDay() - 1;
  if (firstDay === -1) firstDay = 6; 
  
  for (let i = 0; i < firstDay; i++) days.push(null); // Empty slots
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
};

export default function Home() {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string, image_url?: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Calendar State
  const currentDate = new Date(); // Or hardcode to September 2026 for the demo: new Date(2026, 8, 1)
  const [currentMonth, setCurrentMonth] = useState(currentDate.getMonth());
  const [currentYear, setCurrentYear] = useState(currentDate.getFullYear());
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
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCurrentFile(file);
      saveToDatabase(file); // Auto-save on select to mimic the smooth mockup flow
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
    setIsLoading(true);
    setMessages((prev) => [...prev, { role: 'ai', text: `Αποθήκευση του ${file.name} στη βάση δεδομένων...` }]);

    try {
      const base64Image = await getBase64(file);
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image, filename: file.name }),
      });

      const data = await response.json();
      if (data.success) {
        setMessages((prev) => [...prev, { role: 'ai', text: `✅ Το έγγραφο ${file.name} αναλύθηκε και αποθηκεύτηκε με ασφάλεια.` }]);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'ai', text: "❌ Αποτυχία αποθήκευσης εγγράφου." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input;
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMsg }),
      });
      const data = await response.json();
      setMessages((prev) => [...prev, { role: 'ai', text: data.answer || data.error || "Προέκυψε κάποιο σφάλμα.", image_url: data.image_url }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'ai', text: "Σφάλμα σύνδεσης." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    // HACKATHON NOTE: Here is where you would fetch from Supabase!
    // e.g. supabase.from('documents').select('*').eq('created_at', date)
    console.log("Fetching documents for:", date.toISOString());
  };

  return (
    <main className="flex h-screen w-full bg-gradient-to-br from-[#f0f9f4] to-[#e2f1e9] text-[#2d3748] font-sans overflow-hidden">
      
      {/* --- SIDEBAR --- */}
      <div className={`${isSidebarOpen ? 'w-[300px]' : 'w-0'} transition-all duration-300 ease-in-out bg-white/80 backdrop-blur-md border-r border-[#d0e8da] flex flex-col overflow-hidden shrink-0 shadow-sm`}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100/50">
          <div className="text-[1.1rem] font-bold tracking-tight text-gray-800">
            info<span className="bg-[#1a7a4a] text-white px-1 py-0.5 rounded-md mx-0.5">4</span>invo
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-1 hover:bg-gray-100 rounded-md text-gray-500">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"></path></svg>
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          {/* New Chat Button */}
          <button onClick={() => { setMessages([]); setCurrentFile(null); }} className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-[#d0e8da] rounded-xl hover:border-[#1a7a4a] hover:bg-[#f4fbf7] transition-all text-sm font-medium text-gray-700 shadow-sm mb-4">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"></path></svg>
            Νέα Συνομιλία
          </button>

          {/* Search Bar */}
          <div className="relative mb-6">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input type="text" placeholder="Αναζήτηση συνομιλιών..." className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#1a7a4a]" />
          </div>

          {/* Calendar Widget */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-bold text-sm text-gray-800">{monthNames[currentMonth]}</div>
                <div className="text-[0.65rem] text-gray-400 font-medium tracking-wide uppercase">Ετος {currentYear}</div>
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
              {days.map((date, i) => (
                <div key={i} className="aspect-square flex items-center justify-center">
                  {date && (
                    <button 
                      onClick={() => handleDayClick(date)}
                      className={`w-7 h-7 flex items-center justify-center rounded-full text-xs transition-all
                        ${selectedDate?.toDateString() === date.toDateString() ? 'bg-[#1a7a4a] text-white font-bold shadow-md' : 'text-gray-600 hover:bg-gray-100'}
                        ${date.toDateString() === new Date().toDateString() && selectedDate?.toDateString() !== date.toDateString() ? 'border border-[#1a7a4a] text-[#1a7a4a] font-bold' : ''}
                      `}
                    >
                      {date.getDate()}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-gray-400 text-center mt-8">Δεν βρέθηκαν συνομιλίες/έγγραφα.</div>
        </div>
      </div>

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 flex flex-col relative min-w-0">
        
        {/* Top bar (only visible if sidebar is closed) */}
        {!isSidebarOpen && (
          <div className="absolute top-4 left-4 z-10">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-white/80 backdrop-blur-sm border border-[#d0e8da] rounded-lg shadow-sm text-gray-600 hover:text-[#1a7a4a] transition-colors">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 pb-32 pt-12 flex flex-col items-center">
          
          {/* HERO SECTION (Upload State) */}
          {messages.length === 0 ? (
            <div className="max-w-[700px] w-full flex flex-col items-center justify-center mt-10 lg:mt-24">
              <h1 className="text-[2.8rem] font-bold tracking-tight text-gray-800 mb-4">
                info<span className="bg-[#1a7a4a] text-white px-2 py-0.5 rounded-lg mx-0.5">4</span>invo
              </h1>
              <p className="text-gray-500 text-center mb-10 max-w-[450px]">
                Ανεβάστε το τιμολόγιο. Όλα τα δεδομένα σας αναλύονται και αποθηκεύονται με ασφάλεια στη βάση δεδομένων.
              </p>

              {/* Drag & Drop Upload Box */}
              <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileUpload} />
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="w-full max-w-[600px] aspect-[2.5/1] border-2 border-dashed border-gray-300 rounded-[2rem] bg-white/50 hover:bg-white hover:border-[#1a7a4a] hover:shadow-lg transition-all flex flex-col items-center justify-center gap-3 group"
              >
                <div className="text-gray-400 group-hover:text-[#1a7a4a] transition-colors">
                  <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                </div>
                <div>
                  <div className="font-semibold text-gray-700 text-lg">Επιλέξτε ή σύρετε το τιμολόγιο εδώ</div>
                  <div className="text-sm text-gray-400 mt-1 uppercase tracking-wider">PDF, PNG, JPG</div>
                </div>
              </button>
            </div>
          ) : (
            
            /* CHAT FEED SECTION */
            <div className="max-w-[750px] w-full space-y-6">
              {messages.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-5 shadow-sm text-[0.95rem] leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-white border border-gray-100 text-gray-800' 
                      : 'bg-transparent text-gray-800'
                  }`}>
                    {/* Bot Logo Header */}
                    {msg.role === 'ai' && (
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-[24px] h-[24px] bg-[#1a7a4a] rounded flex items-center justify-center">
                          <span className="text-white text-xs font-bold">4</span>
                        </div>
                        <span className="font-bold text-gray-800 text-sm">info4invo</span>
                      </div>
                    )}
                    
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    
                    {/* Render Image Response */}
                    {msg.image_url && (
                      <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
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
              <input 
                type="text" 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                placeholder="Ρωτήστε το info4invo οτιδήποτε..." 
                disabled={isLoading} 
                className="w-full bg-transparent pl-6 pr-14 py-4 text-gray-800 text-[0.95rem] focus:outline-none disabled:opacity-50" 
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