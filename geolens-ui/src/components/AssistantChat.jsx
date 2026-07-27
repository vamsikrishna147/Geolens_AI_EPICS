import React, { useState } from 'react';
import { Send } from 'lucide-react';

export default function AssistantChat() {
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'How can I assist you with this mission?' }
  ]);

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    const userMsg = chatInput;
    const newMessages = [...messages, { role: 'user', text: userMsg }];
    setMessages(newMessages);
    setChatInput('');
    
    try {
      // Add loading state
      setMessages(prev => [...prev, { role: 'assistant', text: '...', isLoading: true }]);
      
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
        return [...withoutLoading, { role: 'assistant', text: 'Connection to AI Engine failed.' }];
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden animate-in fade-in zoom-in-95">
      <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3 font-mono text-sm">
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <span className={`text-[10px] text-mc-muted mb-1 uppercase tracking-wider`}>{msg.role === 'user' ? 'Commander' : 'AI Assistant'}</span>
            <div className={`p-3 rounded-lg max-w-[90%] ${msg.role === 'user' ? 'bg-mc-primary/20 text-mc-text border border-mc-primary/50' : 'bg-mc-panel border border-mc-border text-mc-muted'}`}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>
      
      <form onSubmit={handleChatSubmit} className="mt-4 relative shrink-0">
        <input 
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Ask a question..."
          className="w-full bg-mc-panel border border-mc-border text-mc-text font-mono text-xs p-3 pr-10 rounded-lg outline-none focus:border-mc-primary/50 transition-colors placeholder:text-mc-border"
        />
        <button 
          type="submit"
          disabled={!chatInput.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-mc-primary hover:text-mc-text disabled:text-mc-border transition-colors cursor-pointer"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
