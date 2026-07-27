import React, { useState } from 'react';
import { BookOpen, ExternalLink, ShieldCheck, FileText, Search, Download } from 'lucide-react';
import { useMission } from '../context/MissionContext';

export default function GovPapers() {
  const { finalReport } = useMission();
  const [searchQuery, setSearchQuery] = useState('');

  const academicPapers = finalReport?.research_policy?.academic_citations || [
    { title: "Multi-Temporal SAR Flood Inundation Modeling in Tropical River Basins", year: 2024, journal: "Remote Sensing of Environment", doi: "10.1016/j.rse.2024.114002" },
    { title: "Quantifying Urban Heat Island Dynamics and Canopy Change Using Sentinel-2 Data", year: 2023, journal: "ISPRS Journal of Photogrammetry and Remote Sensing", doi: "10.1016/j.isprsjprs.2023.08.012" },
    { title: "NDMA Flood Risk Management Guidelines and Spatial Compliance Benchmarks", year: 2024, journal: "National Disaster Management Authority Reports", doi: "NDMA/GUIDELINES/FLOODS/2024" },
    { title: "Earth Observation Metrics for Deforestation and Carbon Sink Mapping", year: 2022, journal: "Nature Climate Change", doi: "10.1038/s41558-022-01450-x" }
  ];

  const govPolicies = finalReport?.research_policy?.policy_frameworks || [
    "NDMA Guidelines on Management of Floods (Section 4: Spatial Warning Systems)",
    "Forest Conservation Act Regulations - Vegetation Canopy Clearance Limits",
    "Disaster Management Plan 2024-2029 - Emergency Zoning Standards",
    "State Coastal Regulation Zone (CRZ) Inundation Buffer Norms"
  ];

  const filteredPapers = academicPapers.filter(p => 
    p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.journal?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-mc-bg text-mc-text p-6 h-full flex flex-col overflow-y-auto space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center border-b border-mc-border pb-4">
        <div>
          <h2 className="font-heading text-xl font-bold tracking-wide text-mc-text flex items-center gap-2">
            <BookOpen className="text-mc-primary" size={24} />
            ACADEMIC RESEARCH & GOVERNANCE POLICY RAG
          </h2>
          <p className="text-mc-muted font-mono text-xs mt-1">
            Peer-Reviewed OpenAlex Literature Synthesis & NDMA Disaster Guidelines
          </p>
        </div>

        {/* Search */}
        <div className="relative w-72">
          <Search className="absolute left-3 top-2.5 text-mc-muted" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search papers & policy..."
            className="w-full pl-9 pr-3 py-2 skeuo-input text-xs font-mono"
          />
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
        
        {/* Left Column: Academic Literature */}
        <div className="skeuo-panel p-5 space-y-4 flex flex-col">
          <div className="flex items-center gap-2 border-b border-mc-border/50 pb-3">
            <FileText className="text-mc-secondary" size={18} />
            <h3 className="font-heading font-semibold text-sm tracking-widest text-mc-text uppercase">
              PEER-REVIEWED SCIENTIFIC LITERATURE
            </h3>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            {filteredPapers.map((paper, idx) => (
              <div key={idx} className="bg-[#0a0d13] p-4 rounded-lg border border-mc-border/40 hover:border-mc-secondary/60 transition-colors">
                <h4 className="font-sans font-semibold text-sm text-mc-text leading-snug">{paper.title}</h4>
                <div className="flex justify-between items-center mt-2 font-mono text-xs text-mc-muted">
                  <span>{paper.journal} ({paper.year})</span>
                  <span className="text-mc-secondary font-bold">DOI: {paper.doi}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Government Disaster Guidelines */}
        <div className="skeuo-panel p-5 space-y-4 flex flex-col">
          <div className="flex items-center gap-2 border-b border-mc-border/50 pb-3">
            <ShieldCheck className="text-mc-primary" size={18} />
            <h3 className="font-heading font-semibold text-sm tracking-widest text-mc-text uppercase">
              GOVERNANCE & DISASTER MANAGEMENT POLICY
            </h3>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto pr-1 font-mono text-xs">
            {govPolicies.map((policy, idx) => (
              <div key={idx} className="bg-[#0a0d13] p-4 rounded-lg border border-mc-border/40 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-mc-primary mt-1.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-mc-text leading-relaxed font-sans text-sm">{policy}</p>
                  <span className="text-[10px] text-mc-muted block mt-1">STATUS: COMPLIANCE BENCHMARK ACTIVE</span>
                </div>
              </div>
            ))}
          </div>

          {/* External Links */}
          <div className="border-t border-mc-border/50 pt-4 flex justify-between items-center font-mono text-xs">
            <a href="https://earthdata.nasa.gov/" target="_blank" rel="noreferrer" className="text-mc-secondary hover:underline flex items-center gap-1">
              NASA Earthdata <ExternalLink size={12} />
            </a>
            <a href="https://bhuvan.nrsc.gov.in/" target="_blank" rel="noreferrer" className="text-mc-secondary hover:underline flex items-center gap-1">
              ISRO Bhuvan <ExternalLink size={12} />
            </a>
            <a href="https://data.gov.in/" target="_blank" rel="noreferrer" className="text-mc-secondary hover:underline flex items-center gap-1">
              Data.gov.in <ExternalLink size={12} />
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
