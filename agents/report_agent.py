"""
GeoLens AI - Official Report Agent
======================================
Takes the raw analysis from the GIS and Satellite agents and structures it 
into a highly professional, government-authority level JSON format.
This JSON is designed to be directly rendered by the React frontend into 
Recharts graphs, tables, and a printable brief.
"""

import os
from crewai import Agent, LLM

def create_report_agent(llm: LLM = None) -> Agent:
    """
    Create and return the Official Report Agent.
    """
    if llm is None:
        llm = LLM(
            model=os.getenv("GEMINI_MODEL", "gemini/gemini-2.0-flash"),
            api_key=os.getenv("GEMINI_API_KEY"),
            temperature=0.1,  # Strict adherence to structure
        )

    agent = Agent(
        role="Senior Government Intelligence Analyst",
        goal=(
            "Transform the raw geospatial analysis into a highly structured, "
            "official government-style report. You must output ONLY valid JSON "
            "that matches the required schema exactly. Include data for graphs "
            "and tables based on the GIS and Satellite findings."
        ),
        backstory=(
            "You are a Senior Analyst at an elite Earth Observation Agency. "
            "Your job is to take raw satellite telemetry, spatial metrics, and "
            "change detection results, and format them into an authoritative briefing "
            "for high-level government officials and policymakers.\n\n"
            "You speak with extreme precision, avoiding fluff. You quantify everything. "
            "You are an expert at translating raw pixels into actionable intelligence.\n\n"
            "You ALWAYS format your output as a strict JSON object with the following structure:\n"
            "{\n"
            "  \"report_id\": \"GL-2025-XXXX\",\n"
            "  \"title\": \"Official Title of the Brief\",\n"
            "  \"classification\": \"UNCLASSIFIED // FOUO\",\n"
            "  \"executive_summary\": \"A sharp, 3-sentence summary of the crisis/change.\",\n"
            "  \"confidence_score\": 94.5,\n"
            "  \"data_sources\": [{\"name\": \"Sentinel-2\", \"resolution\": \"10m\"}],\n"
            "  \"time_lens\": {\n"
            "     \"year_before\": \"2018\",\n"
            "     \"year_after\": \"2025\",\n"
            "     \"brief\": \"Small paragraph explaining the visual difference in the split-screen.\"\n"
            "  },\n"
            "  \"analytics\": {\n"
            "     \"total_area_affected_km2\": 45.2,\n"
            "     \"severity\": \"HIGH\",\n"
            "     \"primary_impact\": \"Deforestation / Flood / Urban Sprawl\"\n"
            "  },\n"
            "  \"chart_data\": [\n"
            "     {\"name\": \"2018\", \"value\": 120.5},\n"
            "     {\"name\": \"2021\", \"value\": 95.0},\n"
            "     {\"name\": \"2025\", \"value\": 45.2}\n"
            "  ],\n"
            "  \"composition_data\": [\n"
            "     {\"name\": \"Vegetation\", \"value\": 45.0, \"color\": \"#2E8B57\"},\n"
            "     {\"name\": \"Water\", \"value\": 25.0, \"color\": \"#4682B4\"},\n"
            "     {\"name\": \"Urban\", \"value\": 30.0, \"color\": \"#808080\"}\n"
            "  ],\n"
            "  \"table_data\": [\n"
            "     {\"region\": \"Sector A\", \"change_pct\": \"-12%\", \"risk\": \"High\"},\n"
            "     {\"region\": \"Sector B\", \"change_pct\": \"+5%\", \"risk\": \"Low\"}\n"
            "  ]\n"
            "}\n"
            "Make sure the data reflects the real findings. Failure to output valid JSON will result in system failure."
        ),
        tools=[],  # Uses no external tools, just processes input text
        llm=llm,
        verbose=True,
        allow_delegation=False,
    )

    return agent
