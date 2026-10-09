import React, { useState } from 'react';
import { Terminal, Database, Download, Layers, Satellite, Zap, Send, FileText } from 'lucide-react';

export default function Dashboard() {
  const [query, setQuery] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState(['> SYSTEM INITIALIZED...', '> WAITING FOR DIRECTIVE...']);
  
  const handleExecute = (e) => {
    e.preventDefault();
    if (!query) return;
    setIsExecuting(true);
    setTerminalLogs(prev => [...prev, `> DIRECTIVE RECEIVED: "${query}"`, '> DEPLOYING 5-AGENT SWARM...']);
    
    // Mock execution
    setTimeout(() => {
      setTerminalLogs(prev => [...prev, '> OPERATION COMPLETE. GENERATING INTEL REPORT.']);
      setIsExecuting(false);
    }, 3000);
  };

  const setMacro = (text) => setQuery(text);

  return (
    <div className="grid grid-cols-[1fr_300px] gap-2.5 h-full">
      {/* LEFT COL: Main Dashboard */}
      <section className="flex flex-col gap-2.5 overflow-hidden">
        
        <div className="flex gap-2.5">
          {/* Query Box */}
          <form onSubmit={handleExecute} className="flex-1 bg-bgPanel border-2 border-borderColor p-5 shadow-brutal-border hover:border-laserGreen hover:shadow-brutal-orange transition-all flex flex-col gap-2.5">
            <div className="flex justify-between items-center border-b-2 border-borderColor pb-2 mb-2">
              <span className="font-heading font-bold tracking-widest flex items-center gap-2"><Terminal size={18}/> COMMAND INPUT</span>
            </div>
            <textarea 
              className="bg-black border-2 border-laserGreen text-textMain font-mono text-lg p-4 h-24 focus:border-radarOrange focus:shadow-[inset_0_0_15px_rgba(255,69,0,0.2)] outline-none resize-none"
              placeholder="> Enter geospatial intelligence query here..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button 
              type="submit" 
              disabled={isExecuting}
              className="bg-laserGreen text-black border-2 border-black font-heading text-lg font-extrabold uppercase p-4 shadow-brutal-orange hover:bg-radarOrange hover:text-white hover:shadow-brutal-green transform hover:-translate-y-0.5 hover:-translate-x-0.5 transition-all disabled:bg-gray-800 disabled:text-gray-500 disabled:shadow-none disabled:transform-none"
            >
              {isExecuting ? 'EXECUTING...' : 'EXECUTE_DIRECTIVE'}
            </button>
          </form>

          {/* Quick Actions */}
          <div className="w-[250px] bg-bgPanel border-2 border-borderColor p-5 shadow-brutal-border flex flex-col gap-2.5">
            <div className="flex items-center gap-2 border-b-2 border-borderColor pb-2 mb-2 font-heading font-bold tracking-widest uppercase">
              <Zap size={18} className="text-radarOrange"/> QUICK ACTIONS
            </div>
            <button onClick={() => setMacro('Deploy emergency flood scan using Sentinel-1 SAR')} className="bg-transparent text-left border border-borderColor p-2 hover:bg-laserGreen hover:text-black hover:border-laserGreen text-xs uppercase font-mono transition-all">
              [+] FLOOD SCAN
            </button>
            <button onClick={() => setMacro('Calculate NDVI for agricultural anomaly detection')} className="bg-transparent text-left border border-borderColor p-2 hover:bg-laserGreen hover:text-black hover:border-laserGreen text-xs uppercase font-mono transition-all">
              [+] CHECK VEGETATION
            </button>
            <button onClick={() => setMacro('Assess urban damage infrastructure using high-res imagery')} className="bg-transparent text-left border border-borderColor p-2 hover:bg-laserGreen hover:text-black hover:border-laserGreen text-xs uppercase font-mono transition-all">
              [+] URBAN DAMAGE
            </button>
          </div>
        </div>

        {/* Pipeline Tracker */}
        <div className="flex justify-between bg-black border border-borderColor p-5 mt-4">
          {[{i:<Zap size={24}/>, t:'PLANNER'}, {i:<Database size={24}/>, t:'DISCOVERY'}, {i:<Download size={24}/>, t:'ACQUISITION'}, {i:<Layers size={24}/>, t:'GIS_OPS'}, {i:<Satellite size={24}/>, t:'ANALYSIS'}].map((step, idx) => (
            <div key={idx} className={`text-center text-sm font-bold uppercase flex flex-col items-center gap-2 ${isExecuting ? 'text-laserGreen drop-shadow-sm' : 'text-borderColor'}`}>
              {step.i}
              {step.t}
            </div>
          ))}
        </div>

        {/* Terminal Output */}
        <div className="bg-black border-2 border-borderColor p-4 text-textMuted text-sm h-32 overflow-y-auto font-mono flex flex-col gap-1">
          {terminalLogs.map((log, i) => <p key={i}>{log}</p>)}
        </div>

      </section>

      {/* RIGHT COL: Chatbot */}
      <aside className="bg-bgPanel border-2 border-borderColor p-5 shadow-brutal-border flex flex-col h-full hover:border-laserGreen transition-colors">
        <div className="flex items-center gap-2 border-b-2 border-borderColor pb-2 mb-4 font-heading font-bold tracking-widest uppercase">
          <Terminal size={18}/> ASSISTANT
        </div>
        
        <div className="flex-1 bg-black border border-borderColor p-3 overflow-y-auto flex flex-col gap-3 mb-3">
          <div className="p-2 text-sm border border-laserGreen bg-[rgba(0,255,0,0.1)] text-laserGreen self-start max-w-[90%]">
            &gt; How can I assist with your geospatial analysis today?
          </div>
        </div>
        
        <form className="flex gap-2">
          <input type="text" placeholder="> Query AI..." className="flex-1 bg-black border border-borderColor text-white p-2 outline-none focus:border-laserGreen font-mono text-sm" />
          <button type="submit" className="bg-borderColor text-white px-3 hover:bg-laserGreen hover:text-black transition-colors"><Send size={16}/></button>
        </form>
      </aside>

    </div>
  );
}
