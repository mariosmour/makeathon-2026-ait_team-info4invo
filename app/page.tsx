'use client';

import { useState, useRef, useEffect } from 'react';
import Tesseract from 'tesseract.js';

// --- THE MAGIC HIGHLIGHT COMPONENT ---
const HighlightedImage = ({ imageUrl, highlightText }: { imageUrl: string, highlightText: string }) => {
  const [box, setBox] = useState<{ x0: number, y0: number, x1: number, y1: number } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let isMounted = true;

    const runScan = async () => {
      if (!imageRef.current || !imageLoaded) return;
      setIsScanning(true);

      try {
        await new Promise(res => setTimeout(res, 500));
        
        const bypassUrl = `${imageUrl}?t=${Date.now()}`;
        
        // 1. Fetch the image securely
        const response = await fetch(bypassUrl);
        if (!response.ok) throw new Error("Network blocked the image download!");
        const imageBlob = await response.blob();
        
        // 2. THE ULTIMATE BYPASS: Convert the file into a pure Base64 Text String
        const base64Image = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(imageBlob);
        });
        
        // 3. Give the pure string to Tesseract. It cannot fail to read this.
        const { data }: { data: any } = await Tesseract.recognize(base64Image, 'eng');
        
        if (!isMounted) return;

        const wordsArray = data?.words || []; 
        const targetNumbers = highlightText.replace(/[^0-9]/g, ''); 
        const searchChunk = targetNumbers.length > 4 ? targetNumbers.substring(0, 4) : targetNumbers;

        const foundWord = wordsArray.find((w: any) => {
          const wordNumbers = w.text.replace(/[^0-9]/g, '');
          return wordNumbers.length >= 2 && (wordNumbers.includes(searchChunk) || searchChunk.includes(wordNumbers));
        });
        
        if (foundWord) {
          setBox(foundWord.bbox);
          console.log("✅ Match found!");
        } else {
          console.log(`❌ Couldn't find: "${highlightText}" (Numbers only: ${targetNumbers})`);
          console.log("What Tesseract saw:", wordsArray.map((w:any) => w.text).join(' '));
        }
      } catch (error) {
        console.error("🚨 Scan Error:", error);
      } finally {
        if (isMounted) setIsScanning(false);
      }
    };

    runScan();

    return () => { isMounted = false; };
  }, [imageUrl, highlightText, imageLoaded]); // Wait for the image to load first!

  return (
    <div className="relative mt-3 border border-[#d0e8da] rounded-xl overflow-hidden bg-gray-50">
      {isScanning && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 backdrop-blur-sm text-sm font-medium text-[#1a7a4a] animate-pulse">
          Scanning document pixels...
        </div>
      )}
      
      <img 
        ref={imageRef} 
        src={`${imageUrl}?t=${Date.now()}`} 
        crossOrigin="anonymous"
        alt="Source Document" 
        className="w-full h-auto block" 
        onLoad={() => setImageLoaded(true)} 
      />
      
      {box && imageLoaded && imageRef.current && (
        <div 
          style={{
            position: 'absolute',
            border: '3px solid #ef4444', 
            backgroundColor: 'rgba(239, 68, 68, 0.2)', 
            borderRadius: '4px',
            boxShadow: '0 0 0 2px white',
            left: `${(box.x0 / imageRef.current.naturalWidth) * 100}%`,
            top: `${(box.y0 / imageRef.current.naturalHeight) * 100}%`,
            width: `${((box.x1 - box.x0) / imageRef.current.naturalWidth) * 100}%`,
            height: `${((box.y1 - box.y0) / imageRef.current.naturalHeight) * 100}%`,
          }}
        />
      )}
    </div>
  );
};


// --- THE MAIN APP ---
export default function Home() {
  // Notice the messages state now accepts image_url and highlight_text!
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string, image_url?: string, highlight_text?: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCurrentFile(e.target.files[0]);
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

  const saveToDatabase = async () => {
    if (!currentFile) return;
    setIsLoading(true);
    setMessages((prev) => [...prev, { role: 'ai', text: `Saving ${currentFile.name} to the Cloud...` }]);

    try {
      const base64Image = await getBase64(currentFile);
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image, filename: currentFile.name }),
      });

      const data = await response.json();
      if (data.success) {
        setMessages((prev) => [...prev, { role: 'ai', text: `✅ ${currentFile.name} is saved and ready to search!` }]);
        setCurrentFile(null);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'ai', text: "❌ Failed to save document." }]);
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

      // We now save the extra JSON data to the message state!
      setMessages((prev) => [...prev, { 
        role: 'ai', 
        text: data.answer || data.error || "Κάτι πήγε στραβά.",
        image_url: data.image_url,
        highlight_text: data.highlight_text
      }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'ai', text: "Σφάλμα σύνδεσης." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const showWelcomeScreen = messages.length === 0 && !currentFile;

  return (
    <main className="flex flex-col min-h-screen bg-[#f4f8f6] text-[#0f1f17] font-sans">
      
      {/* Top Bar */}
      <div className="flex items-center gap-2 px-10 py-3 bg-white border-b border-[#d0e8da]">
        <div className="w-[29px] h-[29px] bg-[#1a7a4a] rounded-lg flex items-center justify-center">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <rect x="3" y="3" width="8" height="10" rx="1.5" fill="white" opacity=".9"/>
            <rect x="13" y="3" width="8" height="6" rx="1.5" fill="white" opacity=".6"/>
            <rect x="3" y="15" width="18" height="6" rx="1.5" fill="white" opacity=".75"/>
          </svg>
        </div>
        <span className="text-[0.98rem] font-semibold tracking-tight">info4invo</span>
        <span className="text-[0.68rem] font-medium bg-[#d6f5e6] text-[#1a7a4a] px-2 py-0.5 rounded-full">Vision Engine</span>
      </div>

      {/* Center Column */}
      <div className="flex-1 w-full max-w-[700px] mx-auto flex flex-col pt-10 px-5 overflow-hidden">
        
        {showWelcomeScreen ? (
          <div className="text-center mt-12 mb-8">
            <h1 className="text-[1.4rem] font-semibold text-[#0f1f17] tracking-tight mb-2">Build your Knowledge Base</h1>
            <p className="text-[0.86rem] text-[#5a7a6a] max-w-[370px] mx-auto mb-7 leading-relaxed">
              Upload an invoice, save it to the database, and ask questions. We'll find the exact spot on the page.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pb-6 space-y-4 scrollbar-hide">
            {messages.map((msg, index) => (
              <div key={index} className={`w-full border rounded-2xl p-4 shadow-sm ${
                msg.role === 'user' ? 'bg-[#f0faf5] border-[#b8e8cf]' : 'bg-white border-[#d0e8da]'
              }`}>
                <p className="text-[0.89rem] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                
                {/* RENDER THE IMAGE AND BOX IF IT EXISTS! */}
                {msg.image_url && msg.highlight_text && (
                  <HighlightedImage imageUrl={msg.image_url} highlightText={msg.highlight_text} />
                )}
              </div>
            ))}
            {isLoading && (
              <div className="text-[#5a7a6a] text-sm animate-pulse ml-2">info4invo is searching and scanning...</div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Bottom Input Bar */}
      <div className="w-full border-t border-[#d0e8da] bg-[#f4f8f6] pb-6 pt-3">
        <div className="max-w-[700px] mx-auto px-5">
          
          <div className="flex items-center gap-2 mb-2">
            <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileUpload} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-[1.5px] border-[#d0e8da] bg-white text-[#5a7a6a] text-[0.75rem] font-medium hover:border-[#22a060] hover:text-[#1a7a4a] transition-colors">
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Attach {currentFile ? '' : 'document'}
            </button>

            {currentFile && (
              <>
                <div className="inline-flex items-center gap-1.5 bg-[#d6f5e6] border border-[#a8dfc0] rounded-full px-3 py-1 text-[0.73rem] text-[#1a7a4a] font-medium max-w-[200px] truncate">
                  <svg width="11" height="11" fill="none" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#1a7a4a" strokeWidth="2" strokeLinejoin="round"/><polyline points="14 2 14 8 20 8" stroke="#1a7a4a" strokeWidth="2"/></svg>
                  {currentFile.name}
                </div>
                <button type="button" onClick={saveToDatabase} disabled={isLoading} className="inline-flex items-center gap-1 px-3 py-1 bg-[#1a7a4a] text-white rounded-full text-[0.75rem] font-medium hover:bg-[#22a060] transition-colors disabled:opacity-50">
                  Save to Database
                </button>
              </>
            )}
          </div>

          <form onSubmit={sendMessage} className="relative flex items-center">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Search your saved documents..." disabled={isLoading} className="w-full bg-white border-[1.5px] border-[#d0e8da] rounded-xl pl-4 pr-12 py-3 text-[#0f1f17] text-[0.89rem] shadow-sm focus:outline-none focus:border-[#22a060] focus:ring-2 focus:ring-[#22a060]/10 disabled:bg-gray-100 disabled:cursor-not-allowed" />
            <button type="submit" disabled={isLoading || !input.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#1a7a4a] rounded-lg flex items-center justify-center hover:bg-[#22a060] transition-colors disabled:opacity-50">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </form>

        </div>
      </div>
      
    </main>
  );
}