import React, { createContext, useContext, useState, useRef } from 'react';
import axios from 'axios';

const MissionContext = createContext();

export function useMission() {
  return useContext(MissionContext);
}

// Maps CrewAI log substrings → agent state keys
// Must align with role= strings in agents/*.py
const AGENT_LOG_MAP = [
  { match: 'Geospatial Analysis Planner',  key: 'planner'     },
  { match: 'Data Acquisition Specialist',  key: 'acquisition' },
  { match: 'GIS Processing Technician',    key: 'gis'         },
  { match: 'Earth Observation',            key: 'satellite'   },
  { match: 'Government Intelligence',      key: 'report'      },
  { match: 'Senior Government',            key: 'report'      },
];

const INITIAL_AGENTS = {
  planner:     'idle',
  acquisition: 'idle',
  gis:         'idle',
  satellite:   'idle',
  report:      'idle',
};

export function MissionProvider({ children }) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [agents, setAgents]           = useState({ ...INITIAL_AGENTS });
  const [logs, setLogs]               = useState([]);
  const [finalReport, setFinalReport] = useState(null);
  const [changeData, setChangeData]   = useState(null); // TimeLens direct pipeline results
  const [currentQuery, setCurrentQuery] = useState(() => {
    try { return sessionStorage.getItem('geolens_active_query') || ''; } catch (_) { return ''; }
  });

  const pollingRef      = useRef(null);
  const wsRef           = useRef(null);
  const activeAgentRef  = useRef(null);

  const addLog = (msg) =>
    setLogs(prev => (prev[prev.length - 1] === msg ? prev : [...prev, msg]));

  const clearConnections = () => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    if (wsRef.current)      { wsRef.current.close();              wsRef.current = null; }
  };

  /**
   * Parse a CrewAI stdout line and update agent status in real-time.
   * CrewAI emits "Agent: <role>" when a new agent starts, and
   * "Task Completed" / "Finished chain" when a task ends.
   */
  const parseAgentLog = (line) => {
    const isAgentStart = /^Agent:\s/.test(line) || line.includes('Working Agent:');
    const isFinished   =
      line.includes('Task Completed') ||
      line.includes('Finished chain') ||
      line.includes('> Finished') ||
      line.includes('[✓]') ||
      line.includes('Agent Final Answer');

    if (isAgentStart) {
      for (const { match, key } of AGENT_LOG_MAP) {
        if (line.includes(match)) {
          if (activeAgentRef.current && activeAgentRef.current !== key) {
            setAgents(prev => ({ ...prev, [activeAgentRef.current]: 'completed' }));
          }
          activeAgentRef.current = key;
          setAgents(prev => ({ ...prev, [key]: 'running' }));
          break;
        }
      }
    }

    if (isFinished && activeAgentRef.current) {
      setAgents(prev => ({ ...prev, [activeAgentRef.current]: 'completed' }));
    }
  };

  const executeDirective = async (query) => {
    if (!query) return;
    setCurrentQuery(query);
    try { sessionStorage.setItem('geolens_active_query', query); } catch (_) {}
    setIsExecuting(true);
    setFinalReport(null);
    setChangeData(null);
    setLogs([]);
    clearConnections();
    activeAgentRef.current = null;
    setAgents({ ...INITIAL_AGENTS });

    addLog(`> Initiating orbital analysis: "${query}"`);
    addLog('> Connecting to Mission Control...');
    setAgents(prev => ({ ...prev, planner: 'running' }));
    activeAgentRef.current = 'planner';

    try {
      const { data } = await axios.post('/api/analyze', { query });
      const taskId = data.task_id;
      addLog(`> Uplink established — Task ID: ${taskId}`);

      // Real-time WebSocket log stream
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws/logs/${taskId}`);
      ws.onmessage = (evt) => {
        const clean = evt.data.replace(/\x1B\[[0-9;]*m/g, '').trim();
        if (clean) { addLog(clean); parseAgentLog(clean); }
      };
      wsRef.current = ws;

      // Polling every 4 s as a fallback to catch completion
      pollingRef.current = setInterval(async () => {
        try {
          const { data: statusData } = await axios.get(`/api/status/${taskId}`);

          if (statusData.status === 'completed') {
            clearConnections();
            setAgents(Object.fromEntries(Object.keys(INITIAL_AGENTS).map(k => [k, 'completed'])));
            addLog('> MISSION COMPLETE — All 5 agents synchronized.');
            if (statusData.result) setFinalReport(statusData.result);
            setIsExecuting(false);
          }

          if (statusData.status === 'failed') {
            clearConnections();
            addLog(`> CRITICAL FAILURE: ${statusData.error}`);
            setAgents(prev => ({ ...prev, report: 'failed' }));
            setIsExecuting(false);
          }
        } catch (pollErr) {
          console.error('Polling error:', pollErr);
        }
      }, 4000);

    } catch (err) {
      console.error('API error:', err);
      addLog('> SERVER OFFLINE — Start the Python backend to run AI agents:');
      addLog('>   cd autonomous_gis && python -m uvicorn api.server:app --reload');
      addLog('> Tip: The Map & Analyzer and TimeLens panels work without the server.');
      setAgents(prev => ({ ...prev, planner: 'failed' }));
      setIsExecuting(false);
    }
  };

  /** Called by TimeLens page for direct Phase-4 pipeline calls */
  const setPhase4Result = (pipelineKey, data) =>
    setChangeData(prev => ({ ...(prev || {}), [pipelineKey]: data }));

  return (
    <MissionContext.Provider value={{
      isExecuting,
      agents,
      logs,
      finalReport,
      changeData,
      currentQuery,
      setCurrentQuery,
      executeDirective,
      setPhase4Result,
    }}>
      {children}
    </MissionContext.Provider>
  );
}
