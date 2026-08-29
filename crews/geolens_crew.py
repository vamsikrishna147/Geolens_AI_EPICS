"""
GeoLens AI - Crew Orchestration (5-Agent Pipeline)
===================================================
Pipeline:
  Planner → Data Acquisition → GIS Processing → Earth Observation → Report Intelligence
"""

import os
from typing import Optional

from crewai import Agent, Crew, LLM, Process, Task
from pydantic import BaseModel, Field

from utils.llm_manager import get_llm, run_with_key_rotation

from agents.planner_agent import create_planner_agent
from agents.data_sourcing_agent import create_data_sourcing_agent
from agents.gis_agent import create_gis_agent
from agents.earth_observation_agent import create_earth_observation_agent
from agents.final_reporting_agent import create_final_reporting_agent


# ── Structured Output Models ──────────────────────────────────────────

class AnalysisPlan(BaseModel):
    query_summary: str = Field(description="Summary of the geospatial request.")
    location: str = Field(description="Area of Interest (AOI).")
    time_period: str = Field(description="Relevant time period for analysis.")
    analysis_types: list[str] = Field(description="Analysis types needed (e.g. NDVI, flood).")
    data_requirements: list[str] = Field(description="Satellite/data categories required.")
    expected_outputs: list[str] = Field(description="Expected deliverables from the pipeline.")
    priority_notes: str = Field(default="", description="Special urgency or priority notes.")


class DatasetMatch(BaseModel):
    name: str
    provider: str
    access_method: str
    why_recommended: str
    spatial_resolution: str = ""
    temporal_range: str = ""


class DataAcquisitionResult(BaseModel):
    recommended_datasets: list[DatasetMatch] = Field(description="Best datasets for this query.")
    acquired_data: list[dict] = Field(description="Successfully retrieved datasets with paths.")
    failed_acquisitions: list[str] = Field(default=[], description="Datasets that failed retrieval.")
    storage_summary: str = Field(description="Summary of where data is stored.")
    next_steps: str = Field(description="Recommended next processing steps.")


class GISProcessingResult(BaseModel):
    operations_performed: list[str] = Field(description="GIS operations executed.")
    output_files: list[str] = Field(description="Output file paths generated.")
    maps_generated: list[str] = Field(default=[], description="Interactive HTML map paths.")
    gis_summary: str = Field(description="Summary of GIS processing results.")


class EarthObservationResult(BaseModel):
    baseline_year: str = Field(description="Baseline year for comparison (e.g. 2018).")
    comparison_year: str = Field(description="Comparison year (e.g. 2025).")
    change_summary: str = Field(description="Narrative description of landscape change.")
    detected_anomalies: list[str] = Field(default=[], description="Detected anomalies in the data.")
    event_summary: str = Field(description="Physical event summary (flood, fire, deforestation, etc.).")
    gee_interpretation: str = Field(description="Google Earth Engine data interpretation.")
    confidence_score: str = Field(description="Confidence level: High, Medium, or Low.")


class ChartDataPoint(BaseModel):
    name: str
    value: float


class CompositionDataPoint(BaseModel):
    name: str
    value: float
    color: str = Field(description="Hex color code for chart rendering.")


class TableDataRow(BaseModel):
    region: str
    change_pct: str
    risk: str


class AnalyticsData(BaseModel):
    total_area_affected_km2: str = Field(description="Total affected area in km².")
    severity: str = Field(description="Severity level: HIGH, MEDIUM, or LOW.")
    primary_impact: str = Field(description="Primary environmental or human impact.")


class OfficialReport(BaseModel):
    report_id: str
    title: str
    classification: str
    executive_summary: str
    confidence_score: float
    data_sources: list[dict]
    time_lens: dict
    analytics: AnalyticsData
    chart_data: list[ChartDataPoint]
    composition_data: list[CompositionDataPoint]
    table_data: list[TableDataRow]


# ── Crew Class ────────────────────────────────────────────────────────

class GeoLensCrew:
    """Orchestrates the 5-agent GeoLens AI pipeline."""

    # Maps task index → output dict key
    _OUTPUT_KEYS = [
        "analysis_plan",
        "data_acquisition",
        "gis_processing",
        "earth_observation",
        "official_report",
    ]

    def __init__(self, llm: Optional[LLM] = None, verbose: bool = True):
        self.verbose = verbose

        # Intelligent LLM Routing
        # Heavy data-processing agents strictly use Gemini for speed and large context windows.
        # Reasoning agents use the general round-robin pool (which includes local Ollama).
        llm_pool   = llm if llm is not None else get_llm(require_gemini=False)
        llm_gemini = llm if llm is not None else get_llm(require_gemini=True)

        self.planner          = create_planner_agent(llm=llm_pool)
        self.data_agent       = create_data_sourcing_agent(llm=llm_pool)
        self.gis_agent        = create_gis_agent(llm=llm_gemini)
        self.eo_agent         = create_earth_observation_agent(llm=llm_gemini)
        self.reporting_agent  = create_final_reporting_agent(llm=llm_pool)

    def _build_tasks(self, user_query: str) -> list[Task]:
        """Build the sequential 5-task pipeline."""

        # Task 1 — Planner
        task_plan = Task(
            description=(
                f"Analyze this geospatial query and produce a structured analysis plan.\n"
                f"USER QUERY: \"{user_query}\""
            ),
            expected_output="Structured analysis plan with location, time period, and required datasets.",
            agent=self.planner,
            output_pydantic=AnalysisPlan,
        )

        # Task 2 — Data Acquisition
        task_data = Task(
            description=(
                "Search the GeoLens dataset registry for the best satellite and open datasets "
                "matching the analysis plan, then fetch them using acquisition tools. "
                "Prioritise Sentinel-2, Landsat 8/9, and MODIS where applicable."
            ),
            expected_output="Dataset recommendations with acquired file paths, metadata, and next-step guidance.",
            agent=self.data_agent,
            context=[task_plan],
            output_pydantic=DataAcquisitionResult,
        )

        # Task 3 — GIS Processing
        task_gis = Task(
            description=(
                "Process the acquired satellite and vector datasets using standard GIS operations: "
                "clip to AOI, buffer, reproject, compute spectral indices. "
                "Generate interactive Folium/Leaflet HTML maps for the web dashboard."
            ),
            expected_output="GIS processing report with operation log, output files, and HTML map paths.",
            agent=self.gis_agent,
            context=[task_plan, task_data],
            output_pydantic=GISProcessingResult,
        )

        # Task 4 — Earth Observation & TimeLens
        task_eo = Task(
            description=(
                "Perform multi-temporal satellite change detection (TimeLens). "
                "Interpret GEE spectral indices (NDVI, NDWI, NBR) and synthesise the physical event "
                "(flood, wildfire, deforestation, urban sprawl, etc.). "
                "Provide a confidence score for your findings."
            ),
            expected_output="Earth observation report covering temporal change, anomaly detection, and event synthesis.",
            agent=self.eo_agent,
            context=[task_plan, task_data, task_gis],
            output_pydantic=EarthObservationResult,
        )

        # Task 5 — Report Intelligence
        task_report = Task(
            description=(
                "Synthesise all upstream findings into a government-grade intelligence brief. "
                "Include analytics (affected area, severity), chart data, composition breakdown, "
                "regional risk table, and an executive summary. "
                "Output strictly structured JSON conforming to the OfficialReport schema."
            ),
            expected_output=(
                "Strictly structured JSON OfficialReport with analytics, chart_data, "
                "composition_data, table_data, and executive_summary."
            ),
            agent=self.reporting_agent,
            context=[task_plan, task_eo, task_gis],
            output_pydantic=OfficialReport,
        )

        return [task_plan, task_data, task_gis, task_eo, task_report]

    def run(self, user_query: str) -> dict:
        """Run the 5-agent pipeline and return structured outputs."""
        tasks = self._build_tasks(user_query)

        crew = Crew(
            agents=[
                self.planner,
                self.data_agent,
                self.gis_agent,
                self.eo_agent,
                self.reporting_agent,
            ],
            tasks=tasks,
            process=Process.sequential,
            verbose=self.verbose,
        )

        result = run_with_key_rotation(lambda: crew.kickoff(), max_attempts=6)

        # Build output dict — one key per task
        output = {key: None for key in self._OUTPUT_KEYS}
        output["raw_output"] = result.raw if hasattr(result, "raw") else str(result)

        for idx, task in enumerate(tasks):
            if task.output and hasattr(task.output, "pydantic") and task.output.pydantic:
                output[self._OUTPUT_KEYS[idx]] = task.output.pydantic.model_dump()

        return output
