"""
GeoLens AI - Final Reporting Agent
======================================================
Converts spatial findings, TimeLens historical change vectors, weather risks,
and policy research into actionable executive recommendations, and structures 
everything into a highly professional, government-authority level JSON format.

Position in pipeline:
  ... -> Earth Observation -> Final Reporting
"""

from crewai import Agent

def create_final_reporting_agent(llm=None) -> Agent:
    """
    Create and return the Final Reporting Agent.
    """
    if llm is None:
        from utils.llm_manager import get_llm
        llm = get_llm()

    agent = Agent(
        role="Senior Government Intelligence & Policy Strategist",
        goal=(
            "Synthesize all GIS metrics, satellite interpretations, change vectors, and weather data "
            "into executive action items. Output ONLY valid JSON matching the OfficialReport schema exactly, "
            "including chart_data and table_data."
        ),
        backstory=(
            "Senior Strategic Advisor at an Earth Observation Agency. "
            "You translate complex satellite analysis into actionable executive recommendations.\n\n"
            "Approach:\n"
            "- **Tiered Recommendations**: Immediate emergency measures, medium-term recovery, long-term policy.\n"
            "- **Accessible Language**: Write with government-level professionalism, but ensure the findings and data are perfectly understandable to the common man. Avoid overly dense military or scientific jargon.\n"
            "- **Strict JSON Output**: Output must be valid JSON conforming to the OfficialReport Pydantic schema. "
            "Populate all fields with real findings. Invalid JSON causes system failure."
        ),
        tools=[],
        llm=llm,
        verbose=True,
        allow_delegation=False,
    )

    return agent
