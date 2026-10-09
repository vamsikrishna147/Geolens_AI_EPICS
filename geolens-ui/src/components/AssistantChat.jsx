import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, Cpu, User, Loader2, Sparkles, Trash2, MapPin, Compass, ArrowRight } from 'lucide-react';
import { apiFetch } from '../config/api';

export default function AssistantChat({ context = {}, storageKey = 'assistant_chat' }) {
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch (_) {}

    const isTimeLens = context.scope === 'timelens';
    const loc = context.location || 'Area of Interest';
    const intro = isTimeLens
      ? `Greetings Commander. I am your TimeLens Copilot for ${loc}. Ask me to analyze multi-temporal satellite differences, calculate spectral index shifts (NDVI, NDWI, NBR), or evaluate physical anomalies.`
      : `Greetings Commander. GeoLens AI mission assistant is online. I can interpret satellite imagery, explain pipeline findings, calculate risk metrics, or answer questions about your active directive.`;

    return [{ role: 'assistant', text: intro }];
  });

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages));
    } catch (_) {}
  }, [messages, storageKey]);

  // Context-specific quick suggestion questions
  const suggestions = useMemo(() => {
    const isTimeLens = context.scope === 'timelens';
    const loc = context.location || 'this location';
    if (isTimeLens) {
      return [
        `Explain the land changes in ${loc}`,
        `What does the ${context.activeTab ? context.activeTab.toUpperCase() : 'NDVI'} index indicate here?`,
        `Are there flood or drought anomalies detected?`,
        `Which satellite sensors captured these images?`
      ];
    }
    return [
      `Summarize the key findings for ${loc}`,
      `What are the primary environmental risks?`,
      `Explain the satellite sensors used in this scan`,
      `What GIS operations were performed?`
    ];
  }, [context]);

  const handleClearHistory = () => {
    const isTimeLens = context.scope === 'timelens';
    const loc = context.location || 'Area of Interest';
    const freshIntro = [{
      role: 'assistant',
      text: isTimeLens
        ? `Telemetry session reset. Ready to inspect ${loc} temporal changes.`
        : `Mission copilot reset. How can I assist with your geospatial directives?`
    }];
    setMessages(freshIntro);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(freshIntro));
    } catch (_) {}
  };

  const executeSend = async (messageText) => {
    const textToSend = (messageText || chatInput).trim();
    if (!textToSend) return;

    const newMessages = [...messages, { role: 'user', text: textToSend }];
    setMessages(newMessages);
    setChatInput('');

    try {
      setMessages(prev => [...prev, { role: 'assistant', isLoading: true }]);

      const response = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          context: {
            ...context,
            timestamp: new Date().toISOString()
          }
        })
      }, 30000);

      const data = await response.json();
      const reply = data.response || 'No response returned from the intelligence engine.';
      const provider = data.provider;
      const model = data.model;

      setMessages(prev => {
        const withoutLoading = prev.filter(m => !m.isLoading);
        return [...withoutLoading, {
          role: 'assistant',
          text: reply,
          provider: provider ? `${provider.toUpperCase()}${model ? ` · ${model}` : ''}` : null
        }];
      });
    } catch (error) {
      setMessages(prev => {
        const withoutLoading = prev.filter(m => !m.isLoading);
        return [...withoutLoading, {
          role: 'assistant',
          text: `Connection to intelligence engine failed: ${error.message}. Telemetry systems remain online.`
        }];
      });
    }
  };

  const handleChatSubmit = (e) => {
    e.preventDefault();
    executeSend();
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden animate-in fade-in">
      {/* ── Active Context Banner & Controls ── */}
      <div className="px-3 py-2 bg-mc-bg/90 border-b border-mc-border/60 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Compass size={13} className="text-mc-primary shrink-0" />
          <span className="text-[10px] font-mono text-mc-muted truncate">
            {context.location ? (
              <>TARGET: <b className="text-white">{context.location}</b>{context.yearBefore ? ` (${context.yearBefore} vs ${context.yearAfter})` : ''}</>
            ) : (
              <>ACTIVE DIRECTIVE: <b className="text-white">{context.query ? context.query.slice(0, 24) + '...' : 'Global Telemetry'}</b></>
            )}
          </span>
        </div>
        <button
          onClick={handleClearHistory}
          title="Clear chat history"
          className="text-mc-muted hover:text-mc-danger p-1 rounded transition-colors cursor-pointer shrink-0"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* ── Messages Feed ── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-4 font-body text-sm hide-scrollbar">
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            {/* Header / Avatar */}
            <div className={`flex items-center gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`flex items-center justify-center w-6 h-6 rounded-full border shadow-sm ${
                msg.role === 'user'
                  ? 'bg-mc-panel border-mc-border/50 text-mc-muted'
                  : 'bg-mc-primary/20 border-mc-primary/40 text-mc-primary shadow-sm'
              }`}>
                {msg.role === 'user' ? <User size={12} /> : <Cpu size={12} />}
              </div>
              <span className="text-[10px] text-mc-muted/80 uppercase tracking-widest font-mono font-semibold">
                {msg.role === 'user' ? 'Commander' : 'GeoLens AI'}
              </span>
              {msg.provider && (
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-mc-panel border border-mc-border text-mc-primary/90">
                  {msg.provider}
                </span>
              )}
            </div>

            {/* Message Bubble */}
            <div className={`
              px-3.5 py-2.5 rounded-xl max-w-[92%] text-[12px] leading-relaxed shadow-sm font-body whitespace-pre-wrap
              ${msg.role === 'user'
                ? 'bg-mc-primary/15 text-white border border-mc-primary/30 rounded-tr-sm'
                : 'bg-mc-panel border border-mc-border/80 text-mc-text rounded-tl-sm shadow-sm'
              }
            `}>
              {msg.isLoading ? (
                <div className="flex items-center gap-2 py-1 px-1">
                  <Loader2 size={13} className="animate-spin text-mc-primary" />
                  <span className="text-mc-primary/80 text-xs tracking-wider font-mono">Synthesizing intelligence...</span>
                </div>
              ) : (
                msg.text
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Contextual Quick Prompts ── */}
      {messages.length <= 3 && suggestions.length > 0 && (
        <div className="px-3 py-1.5 border-t border-mc-border/40 flex flex-wrap gap-1.5 shrink-0 bg-mc-panel/40">
          <div className="w-full flex items-center gap-1 text-[10px] font-mono text-mc-muted mb-0.5">
            <Sparkles size={11} className="text-mc-primary" />
            <span>Suggested Inquiries:</span>
          </div>
          {suggestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => executeSend(q)}
              className="px-2 py-1 rounded bg-mc-bg hover:bg-mc-panel border border-mc-border/60 hover:border-mc-primary text-[10px] font-mono text-mc-muted hover:text-white transition-all text-left truncate max-w-full cursor-pointer flex items-center gap-1"
            >
              <ArrowRight size={10} className="text-mc-primary shrink-0" />
              <span className="truncate">{q}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Input Bar ── */}
      <form onSubmit={handleChatSubmit} className="p-3 bg-mc-panel border-t border-mc-border relative shrink-0 flex items-center">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Ask Copilot (or paste Groq gsk_ key)..."
          className="w-full bg-mc-bg shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] border border-mc-border text-mc-text font-body text-xs p-2.5 pr-10 rounded-lg outline-none focus:border-mc-primary transition-all placeholder:text-mc-muted/60"
        />
        <button
          type="submit"
          disabled={!chatInput.trim()}
          className="absolute right-4.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-mc-primary hover:bg-mc-primary/20 hover:text-white disabled:text-mc-muted/40 disabled:hover:bg-transparent transition-all cursor-pointer"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
