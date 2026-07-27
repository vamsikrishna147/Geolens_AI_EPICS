import React, { useRef } from 'react';
import { useMission } from '../context/MissionContext';
import { X, Download, Share2, ShieldAlert, BarChart3, Layers } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

export default function ScientificReport({ onClose }) {
  const { finalReport } = useMission();
  const reportRef = useRef(null);

  if (!finalReport || !finalReport.official_report) return null;

  const report = finalReport.official_report;

  const handleDownload = () => {
    // In a real app, use html2canvas + jsPDF here
    alert("Official Report downloaded securely to encrypted local storage.");
  };

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-8 overflow-y-auto">
      
      {/* Close Button Top Right */}
      <button 
        onClick={onClose}
        className="absolute top-6 right-8 p-3 bg-mc-panel text-white hover:bg-mc-danger hover:text-white rounded-full transition-colors z-[70]"
      >
        <X size={24} />
      </button>

      {/* The Printable A4-style Document Container */}
      <div 
        ref={reportRef}
        className="bg-[#EAECEE] w-full max-w-5xl shadow-2xl flex flex-col text-[#1A1A1A] font-body relative animate-in slide-in-from-bottom-8 duration-500 rounded-sm"
        style={{ minHeight: '80vh' }}
      >
        {/* TOP SECRET Header Block */}
        <div className="w-full bg-[#11161F] text-white p-2 text-center font-mono text-xs font-bold tracking-[0.2em] uppercase border-b-4 border-mc-primary">
          {report.classification || 'UNCLASSIFIED // FOUO'}
        </div>

        <div className="p-12 flex-1 flex flex-col">
          
          {/* Right: Map / Visualization */}
          <div className="flex-1 bg-mc-bg relative flex flex-col mb-8" style={{ minHeight: '300px' }}>
            {finalReport.gis_processing && finalReport.gis_processing.maps_generated && finalReport.gis_processing.maps_generated.length > 0 ? (
              <iframe 
                src={`http://localhost:8000/maps/${finalReport.gis_processing.maps_generated[0].split('/').pop().split('\\').pop()}`}
                className="w-full h-full border-none" 
                title="Analysis Map" 
              />
            ) : (
              <div className="flex-1 flex items-center justify-center flex-col gap-4 text-gray-500">
                <Layers size={48} className="opacity-20" />
                <p className="font-mono text-sm">Rendering Spatial Vectors...</p>
              </div>
            )}
            
            <div className="absolute bottom-6 right-6 bg-black/90 backdrop-blur border border-gray-700 p-4 rounded shadow-xl max-w-xs text-white">
              <h4 className="font-heading text-sm mb-1">Impact Analysis</h4>
              <p className="text-xs text-gray-300">Area affected: <strong>{report.analytics?.total_area_affected_km2 || 'N/A'} km²</strong><br/>Estimated damage: <strong>{report.analytics?.severity || 'UNKNOWN'}</strong></p>
            </div>
          </div>

          {/* Header Metadata */}
          <div className="flex justify-between items-start border-b-2 border-[#1A1A1A] pb-6 mb-8">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <ShieldAlert size={32} className="text-[#11161F]" />
                <h1 className="font-heading text-4xl font-bold uppercase tracking-tight text-[#11161F]">
                  Earth Observation Brief
                </h1>
              </div>
              <h2 className="text-xl font-medium text-gray-700 mt-2">{report.title}</h2>
            </div>
            
            <div className="text-right font-mono text-xs text-gray-600 flex flex-col gap-1">
              <span>REPORT ID: <strong className="text-black">{report.report_id}</strong></span>
              <span>DATE: <strong className="text-black">{new Date().toISOString().split('T')[0]}</strong></span>
              <span>CONFIDENCE: <strong className="text-[#1A1A1A] text-sm">{report.confidence_score}%</strong></span>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="mb-8">
            <h3 className="font-heading font-bold text-lg border-b border-gray-300 pb-2 mb-3 uppercase tracking-wider">I. Executive Summary</h3>
            <p className="text-gray-800 leading-relaxed text-lg">
              {report.executive_summary}
            </p>
          </div>

          {/* Grid Layout for Analytics and Tables */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            
            {/* Analytics Section */}
            <div>
              <h3 className="font-heading font-bold text-lg border-b border-gray-300 pb-2 mb-3 uppercase tracking-wider">II. Core Analytics</h3>
              <div className="bg-white border border-gray-300 p-4 rounded shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 font-mono text-sm uppercase">Total Area Affected</span>
                  <span className="text-2xl font-bold font-mono">{report.analytics?.total_area_affected_km2 || 'N/A'} km²</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 font-mono text-sm uppercase">Severity</span>
                  <span className={`font-bold font-mono px-2 py-0.5 rounded text-white ${report.analytics?.severity === 'HIGH' ? 'bg-red-600' : 'bg-orange-500'}`}>
                    {report.analytics?.severity || 'UNKNOWN'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-mono text-sm uppercase">Primary Impact</span>
                  <span className="font-bold">{report.analytics?.primary_impact || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Data Sources */}
            <div>
              <h3 className="font-heading font-bold text-lg border-b border-gray-300 pb-2 mb-3 uppercase tracking-wider">III. Satellite Telemetry</h3>
              <table className="w-full text-left text-sm border-collapse bg-white border border-gray-300 shadow-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3 border-b border-gray-300 font-mono text-xs uppercase text-gray-600">Constellation</th>
                    <th className="p-3 border-b border-gray-300 font-mono text-xs uppercase text-gray-600">Resolution</th>
                  </tr>
                </thead>
                <tbody>
                  {report.data_sources?.map((ds, idx) => (
                    <tr key={idx} className="border-b last:border-0 border-gray-200">
                      <td className="p-3 font-semibold">{ds.name}</td>
                      <td className="p-3 text-gray-600 font-mono">{ds.resolution}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recharts Graphs Section */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="font-heading font-bold text-lg border-b border-gray-300 pb-2 mb-4 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 size={20} />
                IV. Temporal Analysis Data
              </h3>
              <div className="w-full h-64 bg-white border border-gray-300 p-4 rounded shadow-sm">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={report.chart_data}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2F81F7" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#2F81F7" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
                    <Tooltip contentStyle={{backgroundColor: '#11161F', color: 'white', border: 'none', borderRadius: '4px'}} />
                    <Area type="monotone" dataKey="value" stroke="#2F81F7" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h3 className="font-heading font-bold text-lg border-b border-gray-300 pb-2 mb-4 uppercase tracking-wider flex items-center gap-2">
                <Layers size={20} />
                V. Composition Analysis
              </h3>
              <div className="w-full h-64 bg-white border border-gray-300 p-4 rounded shadow-sm flex items-center justify-center relative">
                {report.composition_data ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={report.composition_data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {report.composition_data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color || '#2F81F7'} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{backgroundColor: '#11161F', color: 'white', border: 'none', borderRadius: '4px'}} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-gray-400 font-mono text-sm">No composition data available</div>
                )}
                {report.composition_data && (
                  <div className="absolute top-4 right-4 flex flex-col gap-2">
                    {report.composition_data.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs font-mono">
                        <div className="w-3 h-3 rounded-full" style={{backgroundColor: entry.color || '#2F81F7'}}></div>
                        <span>{entry.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Granular Table Data */}
          {report.table_data && report.table_data.length > 0 && (
            <div className="mb-8">
              <h3 className="font-heading font-bold text-lg border-b border-gray-300 pb-2 mb-4 uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert size={20} />
                VI. Regional Risk Assessment
              </h3>
              <div className="bg-white border border-gray-300 rounded shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-gray-100 border-b border-gray-300">
                    <tr>
                      <th className="p-4 font-mono text-xs uppercase text-gray-600">Region / Sector</th>
                      <th className="p-4 font-mono text-xs uppercase text-gray-600">Change (%)</th>
                      <th className="p-4 font-mono text-xs uppercase text-gray-600">Assessed Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.table_data.map((row, idx) => (
                      <tr key={idx} className="border-b last:border-0 border-gray-200 hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-semibold text-gray-800">{row.region}</td>
                        <td className="p-4 font-mono text-gray-700">{row.change_pct}</td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                            row.risk.toLowerCase() === 'high' ? 'bg-red-100 text-red-700' :
                            row.risk.toLowerCase() === 'medium' ? 'bg-orange-100 text-orange-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {row.risk}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* TOP SECRET Footer Block */}
        <div className="w-full bg-[#11161F] text-white p-2 text-center font-mono text-xs font-bold tracking-[0.2em] uppercase border-t-4 border-mc-primary flex justify-between px-10">
          <span>{report.classification || 'UNCLASSIFIED // FOUO'}</span>
          <span>GEOLENS AI AUTOMATED INTELLIGENCE SYSTEM</span>
        </div>
        
      </div>

      {/* Download Action Float */}
      <button 
        onClick={handleDownload}
        className="fixed bottom-10 right-10 bg-mc-primary hover:bg-mc-secondary text-white font-mono text-sm px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 transition-colors z-[70] shadow-blue-500/50"
      >
        <Download size={20} />
        DOWNLOAD SECURE PDF
      </button>

    </div>
  );
}
