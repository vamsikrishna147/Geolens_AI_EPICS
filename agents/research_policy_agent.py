"""
GeoLens AI - Research & Policy RAG Agent
===========================================
Synthesizes scientific literature (OpenAlex), government open data (data.gov.in),
and disaster management guidelines (NDMA, FSI) to provide scientific context,
regulatory benchmarks, and policy compliance guidance for spatial findings.

Position in pipeline:
  Planner -> Dataset Discovery -> Weather & Climate -> Research & Policy RAG -> Data Acquisition ...
"""

import os
from crewai import Agent, LLM

from tools.research_tool import ResearchTool
from tools.india_gov_tool import IndiaGovTool
from tools.web_search_tool import WebSearchTool


def create_research_policy_agent(llm: LLM = None) -> Agent:
    """
    Create and return the Research & Policy RAG Agent.

    Args:
        llm: Optional LLM instance. Defaults to Gemini from env.

    Returns:
        A configured CrewAI Agent with Research, IndiaGov, and WebSearch tools.
    """
    if llm is None:
        llm = LLM(
            model=os.getenv("GEMINI_MODEL", "gemini/gemini-2.0-flash"),
            api_key=os.getenv("GEMINI_API_KEY"),
            temperature=0.2,
        )

    tools = [
        ResearchTool(),
        IndiaGovTool(),
        WebSearchTool(),
    ]

    agent = Agent(
        role="Geospatial Research & Governance Policy RAG Specialist",
        goal=(
            "Retrieve, analyze, and synthesize peer-reviewed scientific papers, government disaster management frameworks "
            "(NDMA, NIDM, FSI), and municipal land-use policy documents relevant to the user's geospatial query. "
            "Provide peer-reviewed scientific citations, historical benchmark comparisons, policy compliance guidelines, "
            "and legal/regulatory context that ground satellite metrics in scientific authority and governance standards."
        ),
        backstory=(
            "You are a Senior Geospatial Policy Researcher, Bibliometrician, and Public Governance Advisor with 20+ years "
            "of experience working alongside environmental ministries, space agencies (ISRO/NASA), and emergency management "
            "authorities (NDMA/FMA).\n\n"
            "Your Capabilities:\n"
            "- **Academic RAG**: Query OpenAlex and scientific repositories (`ResearchTool`) for peer-reviewed studies on regional remote sensing, soil erosion models, flood return periods, and urban heat island dynamics.\n"
            "- **Government Datasets**: Fetch official government datasets and policy briefs (`IndiaGovTool`) from data.gov.in, state disaster authorities, and environmental survey reports.\n"
            "- **Policy Benchmark Synthesis**: Cross-reference satellite measurements against established safety thresholds, environmental protection acts, and emergency protocol standards.\n\n"
            "Your Output Approach:\n"
            "1. Extract academic paper titles, authors, publication years, and DOI links relevant to the spatial domain.\n"
            "2. Identify governing disaster management frameworks (e.g., NDMA Flood Management Guidelines, Forest Conservation Act standards).\n"
            "3. Provide explicit citations and compliance notes that explain how satellite findings align with or violate official policy benchmarks."
        ),
        tools=tools,
        llm=llm,
        verbose=True,
        allow_delegation=False,
        max_iter=15,
    )

    return agent
