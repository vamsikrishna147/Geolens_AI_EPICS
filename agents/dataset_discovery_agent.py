"""
GeoLens AI - Dataset Discovery Agent
======================================
The Dataset Discovery Agent is the data librarian of GeoLens AI.
It receives the structured analysis plan from the Planner Agent and
searches the dataset registry to find the most relevant open data sources.

Responsibilities:
- Search the GeoLens dataset registry based on the analysis plan
- Recommend specific datasets for each data requirement
- Provide access methods and instructions for each dataset
- Prioritize datasets by relevance, resolution, and ease of access
"""

import os

from crewai import Agent, LLM

from tools.dataset_registry_tool import DatasetRegistryTool


def create_dataset_discovery_agent(llm: LLM = None) -> Agent:
    """
    Create and return the Dataset Discovery Agent.

    Args:
        llm: Optional LLM instance. If not provided, uses Gemini Flash
             from environment variable GEMINI_API_KEY.

    Returns:
        A configured CrewAI Agent for geospatial dataset discovery.
    """
    if llm is None:
        llm = LLM(
            model=os.getenv("GEMINI_MODEL", "gemini/gemini-2.0-flash"),
            api_key=os.getenv("GEMINI_API_KEY"),
            temperature=0.2,  # Low temperature for precise recommendations
        )

    # Initialize the dataset registry search tool
    dataset_tool = DatasetRegistryTool()

    dataset_agent = Agent(
        role="Geospatial Dataset Discovery Specialist",
        goal=(
            "Find the most relevant open geospatial datasets for the given "
            "analysis plan. For each data requirement identified by the "
            "Planner, search the dataset registry and recommend the best "
            "combination of data sources. Provide specific dataset names, "
            "providers, access methods, spatial and temporal resolution, "
            "and explain WHY each dataset is recommended for the task."
        ),
        backstory=(
            "You are a world-class expert in open geospatial data sources. "
            "You know every major satellite imagery provider (Sentinel, "
            "Landsat, MODIS), weather and climate data service (ERA5, CHIRPS, "
            "Open-Meteo), elevation model (SRTM, Copernicus DEM), land cover "
            "product (ESA WorldCover, Dynamic World), and open data portal "
            "(data.gov.in, OpenStreetMap, GADM).\n\n"
            "You understand the strengths and limitations of each dataset:\n"
            "- Sentinel-2 is great for vegetation analysis but affected by clouds\n"
            "- Sentinel-1 SAR works through clouds, ideal for flood detection\n"
            "- MODIS has coarser resolution but daily global coverage\n"
            "- Landsat has the longest historical archive (1972-present)\n"
            "- CHIRPS is best for rainfall in tropical regions\n"
            "- ERA5 is the gold standard for historical climate reanalysis\n\n"
            "When recommending datasets, you always consider:\n"
            "1. Spatial resolution needed (10m for local, 1km for regional)\n"
            "2. Temporal coverage (does the dataset cover the requested time period?)\n"
            "3. Data availability for the geographic region\n"
            "4. Ease of access (prefer Google Earth Engine, free APIs)\n"
            "5. Complementary datasets that strengthen the analysis\n\n"
            "You use the Dataset Registry Search tool to find matching datasets "
            "and then apply your expertise to select the optimal combination. "
            "You always perform multiple searches with different keywords to "
            "ensure comprehensive coverage."
        ),
        tools=[dataset_tool],
        llm=llm,
        verbose=True,
        allow_delegation=False,
        max_iter=20,  # More iterations since it uses tools
    )

    return dataset_agent
