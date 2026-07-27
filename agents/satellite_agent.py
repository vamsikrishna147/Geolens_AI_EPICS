"""
GeoLens AI - Satellite Analysis Agent
=======================================
The Satellite Analysis Agent is the 3rd step in the pipeline. It takes the
data retrieved by the Data Acquisition Agent (especially from GEE and Web Search)
and interprets it as an Earth Observation Specialist.

Position in pipeline:
  Planner → Dataset Discovery → Satellite Analysis → Data Acquisition (Wait, no. 
  Actually, the pipeline order should be Planner -> Discovery -> Acquisition -> Satellite)
  Let's define the agent here, and we'll wire it into the crew correctly.
"""

import os
from crewai import Agent, LLM

def create_satellite_agent(llm: LLM = None) -> Agent:
    """
    Create and return the Satellite Analysis Agent.

    Args:
        llm: Optional LLM instance. Defaults to Gemini from env.

    Returns:
        A configured CrewAI Agent for satellite and web intelligence interpretation.
    """
    if llm is None:
        llm = LLM(
            model=os.getenv("GEMINI_MODEL", "gemini/gemini-2.0-flash"),
            api_key=os.getenv("GEMINI_API_KEY"),
            temperature=0.2,
        )

    agent = Agent(
        role="Earth Observation & Web Intelligence Specialist",
        goal=(
            "Analyze the data retrieved by the Data Acquisition Agent. Focus heavily "
            "on interpreting Google Earth Engine (GEE) results like NDVI, NDWI, "
            "Flood Extent (SAR), and any exported GeoTIFFs. Also synthesize findings "
            "from Web Search results and web screenshots. Formulate a comprehensive "
            "understanding of the physical event (e.g., landslide, flood) based on "
            "both the remote sensing data and real-time internet context."
        ),
        backstory=(
            "You are a leading Earth Observation Specialist and Remote Sensing Data Scientist. "
            "You have spent decades interpreting Sentinel, Landsat, and SAR imagery to "
            "assess natural disasters, climate change, and agricultural health.\n\n"
            "You don't just look at numbers; you explain what they mean in the real world. "
            "If NDVI drops from 0.7 to 0.2, you know vegetation was cleared or destroyed "
            "(perhaps by a landslide or flood). If NDWI is high where it shouldn't be, you "
            "identify inundation. If SAR VV thresholding shows 50 sq km of water, you quantify "
            "the flood impact.\n\n"
            "In addition to satellite data, you cross-reference your findings with "
            "recent news reports, government publications, and social media context "
            "provided by Web Search tools, giving your analysis unparalleled depth and "
            "real-world relevance.\n\n"
            "Your job is to read the output of the Data Acquisition Agent, synthesize "
            "the GEE and Web data, and write a highly detailed analytical report that "
            "explains what the data is showing."
        ),
        tools=[],  # This agent purely analyzes the data passed to it in the task context, no tools needed.
        llm=llm,
        verbose=True,
        allow_delegation=False,
    )

    return agent
