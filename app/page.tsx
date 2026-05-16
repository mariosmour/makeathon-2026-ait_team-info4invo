'use client';

import { useState, useRef, useEffect } from 'react';

export default function Home() {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCurrentFile(e.target.files[0]);
    }
  };

  // ... existing state ...

  // Helper to convert file to base64
  const getBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const saveToDatabase = async () => {
    if (!currentFile) return;
    setIsLoading(true);
    setMessages((prev) => [...prev, { role: 'ai', text: `Saving ${currentFile.name} to the Knowledge Base...` }]);

    try {
      const base64Image = await getBase64(currentFile);
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image, filename: currentFile.name }),
      });

      const data = await response.json();
      if (data.success) {
        setMessages((prev) => [...prev, { role: 'ai', text: `✅ ${currentFile.name} has been successfully read and saved to the database! You can now search for it.` }]);
        setCurrentFile(null); // Clear the file after saving
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'ai', text: "❌ Failed to save document to database." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentFile) return;

    const userMsg = input;
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsLoading(true);

    try {
      // Convert the attached image file to a Base64 string
      const getBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
        });
      };

      const base64Image = await getBase64(currentFile);

      // Send both the question and the image to the backend
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMsg }),
      });

      const data = await response.json();

      setMessages((prev) => [...prev, { 
        role: 'ai', 
        text: data.answer || data.error || "Κάτι πήγε στραβά." 
      }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'ai', text: "Σφάλμα σύνδεσης." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex flex-col min-h-screen bg-[#f4f8f6] text-[#0f1f17] font-sans">
      
      {/* ── Top Bar ── */}
      <div className="flex items-center gap-2 px-10 py-3 bg-white border-b border-[#d0e8da]">
        <div className="w-[29px] h-[29px] bg-[#1a7a4a] rounded-lg flex items-center justify-center">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <rect x="3" y="3" width="8" height="10" rx="1.5" fill="white" opacity=".9"/>
            <rect x="13" y="3" width="8" height="6" rx="1.5" fill="white" opacity=".6"/>
            <rect x="3" y="15" width="18" height="6" rx="1.5" fill="white" opacity=".75"/>
          </svg>
        </div>
        <span className="text-[0.98rem] font-semibold tracking-tight">info4invo</span>
        <span className="text-[0.68rem] font-medium bg-[#d6f5e6] text-[#1a7a4a] px-2 py-0.5 rounded-full">AI</span>
        <span className="ml-auto text-[0.73rem] text-[#5a7a6a]">Financial Document Assistant</span>
      </div>

      {/* ── Center Column ── */}
      <div className="flex-1 w-full max-w-[700px] mx-auto flex flex-col pt-10 px-5 overflow-hidden">
        
        {!currentFile ? (
          /* ── Welcome Screen ── */
          <div className="text-center mt-12 mb-8">
            <div className="w-[50px] h-[50px] bg-[#d6f5e6] rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg width="23" height="23" fill="none" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#1a7a4a" strokeWidth="1.8" strokeLinejoin="round"/>
                <polyline points="14 2 14 8 20 8" stroke="#1a7a4a" strokeWidth="1.8" strokeLinejoin="round"/>
                <line x1="8" y1="13" x2="16" y2="13" stroke="#1a7a4a" strokeWidth="1.8" strokeLinecap="round"/>
                <line x1="8" y1="17" x2="13" y2="17" stroke="#1a7a4a" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <h1 className="text-[1.4rem] font-semibold text-[#0f1f17] tracking-tight mb-2">Ask your financial documents</h1>
            <p className="text-[0.86rem] text-[#5a7a6a] max-w-[370px] mx-auto mb-7 leading-relaxed">
              Upload an invoice, receipt, or bank statement and ask anything — get verified answers with visual proof of the source.
            </p>
            
            <div className="flex flex-wrap gap-3 justify-center">
              {[
                { title: "Accurate Answers", desc: "Grounded responses cited to the source" },
                { title: "Visual Proof", desc: "See exactly where the answer comes from" },
                { title: "Zero Hallucinations", desc: "If it's not in the doc, we say so" }
              ].map((feat, i) => (
                <div key={i} className="bg-white border border-[#d0e8da] rounded-xl p-3 w-[162px] text-left">
                  <div className="w-[7px] h-[7px] bg-[#1a7a4a] rounded-full mb-2"></div>
                  <div className="text-[0.79rem] font-semibold text-[#0f1f17] mb-1">{feat.title}</div>
                  <div className="text-[0.72rem] text-[#5a7a6a] leading-snug">{feat.desc}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ── Chat Messages ── */
          <div className="flex-1 overflow-y-auto pb-6 space-y-3 scrollbar-hide">
            {messages.map((msg, index) => (
              <div key={index} className={`w-full border rounded-2xl p-4 shadow-sm ${
                msg.role === 'user' ? 'bg-[#f0faf5] border-[#b8e8cf]' : 'bg-white border-[#d0e8da]'
              }`}>
                <p className="text-[0.89rem] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              </div>
            ))}
            {isLoading && (
              <div className="text-[#5a7a6a] text-sm animate-pulse ml-2">info4invo is analyzing...</div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* ── Bottom Input Bar ── */}
      <div className="w-full border-t border-[#d0e8da] bg-[#f4f8f6] pb-6 pt-3">
        <div className="max-w-[700px] mx-auto px-5">
          
          {/* Attach Button Row */}
          <div className="flex items-center gap-2 mb-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".pdf,.png,.jpg,.jpeg" 
              onChange={handleFileUpload}
            />
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-[1.5px] border-[#d0e8da] bg-white text-[#5a7a6a] text-[0.75rem] font-medium hover:border-[#22a060] hover:text-[#1a7a4a] transition-colors"
            >
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Attach {currentFile ? '' : 'document'}
            </button>

            {currentFile && (
              <>
                <div className="inline-flex items-center gap-1.5 bg-[#d6f5e6] border border-[#a8dfc0] rounded-full px-3 py-1 text-[0.73rem] text-[#1a7a4a] font-medium max-w-[200px] truncate">
                  <svg width="11" height="11" fill="none" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#1a7a4a" strokeWidth="2" strokeLinejoin="round"/><polyline points="14 2 14 8 20 8" stroke="#1a7a4a" strokeWidth="2"/></svg>
                  {currentFile.name}
                </div>
                
                {/* NEW SAVE BUTTON */}
                <button 
                  type="button"
                  onClick={saveToDatabase}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-[#1a7a4a] text-white rounded-full text-[0.75rem] font-medium hover:bg-[#22a060] transition-colors disabled:opacity-50"
                >
                  Save to Database
                </button>
              </>
            )}
          </div>

          {/* Chat Input */}
          <form onSubmit={sendMessage} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={currentFile ? "Ask anything about your document…" : "Attach a document to start chatting…"}
              disabled={!currentFile || isLoading}
              className="w-full bg-white border-[1.5px] border-[#d0e8da] rounded-xl pl-4 pr-12 py-3 text-[#0f1f17] text-[0.89rem] shadow-sm focus:outline-none focus:border-[#22a060] focus:ring-2 focus:ring-[#22a060]/10 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <button 
              type="submit"
              disabled={!currentFile || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#1a7a4a] rounded-lg flex items-center justify-center hover:bg-[#22a060] transition-colors disabled:opacity-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </form>

        </div>
      </div>
      
    </main>
  );
}