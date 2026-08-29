import React, { useState, useEffect, useRef } from 'react';
import { Send, Cpu, User, Loader2 } from 'lucide-react';

export default function AssistantChat() {
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState(() => {
    const saved = sessionStorage.getItem('assistant_chat');
    return saved ? JSON.parse(saved) : [
      { role: 'assistant', text: 'How can I assist you with this geospatial mission today?' }
    ];
  });
  const bottomRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    sessionStorage.setItem('assistant_chat', JSON.stringify(messages));
  }, [messages]);

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    const userMsg = chatInput;
    const newMessages = [...messages, { role: 'user', text: userMsg }];
    setMessages(newMessages);
    setChatInput('');
    
    try {
      setMessages(prev => [...prev, { role: 'assistant', isLoading: true }]);
      
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages })
      });
      
      const data = await response.json();
      
      setMessages(prev => {
        const withoutLoading = prev.filter(m => !m.isLoading);
        return [...withoutLoading, { role: 'assistant', text: data.response }];
      });
    } catch (error) {
      setMessages(prev => {
        const withoutLoading = prev.filter(m => !m.isLoading);
        return [...withoutLoading, { role: 'assistant', text: 'Connection to AI Engine failed. Is the Python backend running?' }];
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden animate-in fade-in zoom-in-95">
      <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-5 font-mono text-sm hide-scrollbar">
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            {/* Header / Avatar */}
            <div className={`flex items-center gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`flex items-center justify-center w-6 h-6 rounded-full border shadow-lg ${
                msg.role === 'user' 
                  ? 'bg-mc-panel border-mc-border/50 text-mc-muted' 
                  : 'bg-mc-primary/20 border-mc-primary/40 text-mc-primary shadow-[0_0_10px_rgba(47,129,247,0.3)]'
              }`}>
                {msg.role === 'user' ? <User size={12} /> : <Cpu size={12} />}
              </div>
              <span className="text-[10px] text-mc-muted/80 uppercase tracking-widest font-semibold">
                {msg.role === 'user' ? 'Commander' : 'GeoLens AI'}
              </span>
            </div>

            {/* Message Bubble */}
            <div className={`
              px-4 py-3 rounded-2xl max-w-[90%] text-[13px] leading-relaxed shadow-xl
              ${msg.role === 'user' 
                ? 'bg-mc-panel/80 text-mc-text border border-mc-border/40 rounded-tr-sm' 
                : 'bg-gradient-to-br from-mc-primary/10 to-transparent border border-mc-primary/30 text-mc-text rounded-tl-sm shadow-[0_0_15px_rgba(47,129,247,0.1)]'
              }
            `}>
              {msg.isLoading ? (
                <div className="flex items-center gap-2 py-1 px-2">
                  <Loader2 size={14} className="animate-spin text-mc-primary" />
                  <span className="text-mc-primary/80 animate-pulse text-xs tracking-wider">Processing query...</span>
                </div>
              ) : (
                msg.text
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      
      {/* Input Area */}
      <form onSubmit={handleChatSubmit} className="mt-5 relative shrink-0 flex items-center">
        <div className="absolute inset-0 bg-gradient-to-t from-mc-bg via-mc-bg to-transparent -top-6 -z-10 pointer-events-none" />
        <input 
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Ask a question about the mission..."
          className="w-full bg-mc-panel/90 backdrop-blur shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] border border-mc-border/80 text-mc-text font-mono text-xs p-3.5 pr-12 rounded-xl outline-none focus:border-mc-primary/70 focus:shadow-[0_0_15px_rgba(47,129,247,0.2)] transition-all placeholder:text-mc-muted/60"
        />
        <button 
          type="submit"
          disabled={!chatInput.trim()}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-mc-primary hover:bg-mc-primary/20 hover:text-white disabled:text-mc-muted/40 disabled:hover:bg-transparent transition-all cursor-pointer"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
