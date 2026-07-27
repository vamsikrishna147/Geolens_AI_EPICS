import React, { createContext, useContext, useState, useRef } from 'react';
import axios from 'axios';

const MissionContext = createContext();

export function useMission() {
  return useContext(MissionContext);
}

// Map agent name substrings from CrewAI logs to our agent keys
const AGENT_LOG_MAP = [
  { match: 'Mission Planner',                     key: 'planner' },
  { match: 'Dataset Discovery',                   key: 'discovery' },
  { match: 'Weather',                              key: 'weather_climate' },
  { match: 'Climate',                              key: 'weather_climate' },
  { match: 'Research',                             key: 'research_policy' },
  { match: 'Policy',                               key: 'research_policy' },
  { match: 'Data Acquisition',                     key: 'acquisition' },
  { match: 'GIS Analyst',                          key: 'gis' },
  { match: 'Temporal',                             key: 'temporal' },
  { match: 'TimeLens',                             key: 'temporal' },
  { match: 'Satellite',                            key: 'satellite' },
  { match: 'Recommendation',                       key: 'recommendation' },
  { match: 'Decision Support',                     key: 'recommendation' },
  { match: 'Government Intelligence',              key: 'report' },
  { match: 'Report',                               key: 'report' },
];

const INITIAL_AGENTS = {
  planner:          'idle',
  discovery:        'idle',
  weather_climate:  'idle',
  research_policy:  'idle',
  acquisition:      'idle',
  gis:              'idle',
  temporal:         'idle',
  satellite:        'idle',
  recommendation:   'idle',
  report:           'idle',
};

export function MissionProvider({ children }) {
  const [isExecuting, setIsExecuting]   = useState(false);
  const [agents, setAgents]             = useState({ ...INITIAL_AGENTS });
  const [logs, setLogs]                 = useState([]);
  const [finalReport, setFinalReport]   = useState(null);
  // Structured sub-results for page-level consumers
  const [temporalData, setTemporalData] = useState(null);
  const [weatherData, setWeatherData]   = useState(null);
  const [researchData, setResearchData] = useState(null);
  const [changeData, setChangeData]     = useState(null); // Phase 4 pipeline results

  const pollingInterval = useRef(null);
  const wsRef           = useRef(null);
  const activeAgentRef  = useRef(null); // tracks the currently-running agent key

  const addLog = (message) => setLogs(prev => {
    if (prev[prev.length - 1] === message) return prev;
    return [...prev, message];
  });

  const clearPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  /**
   * Parse a real-time CrewAI log line and advance agent statuses.
   * CrewAI emits lines like: "Working Agent: Mission Planner Agent"
   */
  const parseAgentLog = (logLine) => {
    const isWorking   = logLine.includes('Working Agent:');
    const isFinished  = logLine.includes('Finished chain') || logLine.includes('> Finished') || logLine.includes('[\u2713]');

    if (isWorking) {
      for (const { match, key } of AGENT_LOG_MAP) {
        if (logLine.includes(match)) {
          // Mark previous active agent as completed
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
    setIsExecuting(true);
    setFinalReport(null);
    setTemporalData(null);
    setWeatherData(null);
    setResearchData(null);
    setChangeData(null);
    setLogs([]);
    clearPolling();
    activeAgentRef.current = null;

    // Reset all agents to idle
    setAgents({ ...INITIAL_AGENTS });
    addLog(`> Initiating orbital analysis for: "${query}"`);

    try {
      addLog('> Planner Agent connecting to Mission Control...');
      setAgents(prev => ({ ...prev, planner: 'running' }));
      activeAgentRef.current = 'planner';

      const response = await axios.post('/api/analyze', { query });
      const taskId = response.data.task_id;
      addLog(`> Secure uplink established. Task ID: ${taskId}`);

      // If cached, result arrives immediately
      if (response.data.status === 'completed' && response.data.result) {
        const result = response.data.result;
        _applyResult(result);
        addLog('> CACHE HIT \u2014 Mission loaded from Redis.');
        return;
      }

      // Real-time WebSocket logs
      if (taskId !== 'cached') {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws/logs/${taskId}`);
        ws.onmessage = (event) => {
          // Strip ANSI colour codes
          const cleanLog = event.data.replace(/\x1B\[[0-9;]*m/g, '').trim();
          if (cleanLog) {
            addLog(cleanLog);
            parseAgentLog(cleanLog);
          }
        };
        wsRef.current = ws;
      }

      // Polling loop every 4 seconds
      pollingInterval.current = setInterval(async () => {
        try {
          const statusRes  = await axios.get(`/api/status/${taskId}`);
          const statusData = statusRes.data;

          if (statusData.status === 'completed') {
            clearPolling();
            // Mark all agents complete
            setAgents(Object.fromEntries(Object.keys(INITIAL_AGENTS).map(k => [k, 'completed'])));
            addLog('> MISSION COMPLETE.');
            if (statusData.result) _applyResult(statusData.result);
            setIsExecuting(false);
          }

          if (statusData.status === 'failed') {
            clearPolling();
            addLog(`> CRITICAL FAILURE: ${statusData.error}`);
            setAgents(prev => ({ ...prev, report: 'failed' }));
            setIsExecuting(false);
          }
        } catch (pollErr) {
          console.error('Polling Error:', pollErr);
        }
      }, 4000);

    } catch (error) {
      console.error('API Error:', error);
      addLog('> CRITICAL FAILURE: Could not connect to Mission Control (http://localhost:8000). Is the Python server running?');
      setAgents(prev => ({ ...prev, planner: 'failed' }));
      setIsExecuting(false);
    }
  };

  /** Distribute API result to correct state slots */
  function _applyResult(result) {
    setFinalReport(result);
    if (result.temporal_analysis)       setTemporalData(result.temporal_analysis);
    if (result.weather_climate)         setWeatherData(result.weather_climate);
    if (result.research_policy)         setResearchData(result.research_policy);
  }

  /** Called by Phase 4 API endpoints (TimeLens page direct calls) */
  const setPhase4Result = (pipelineKey, data) => {
    setChangeData(prev => ({ ...(prev || {}), [pipelineKey]: data }));
  };

  const value = {
    isExecuting,
    agents,
    logs,
    finalReport,
    temporalData,
    weatherData,
    researchData,
    changeData,
    executeDirective,
    setPhase4Result,
  };

  return (
    <MissionContext.Provider value={value}>
      {children}
    </MissionContext.Provider>
  );
}
