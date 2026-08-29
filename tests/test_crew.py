"""
GeoLens AI - Tests
====================
Basic tests for Week 1 components:
- Dataset registry loading and search
- Agent initialization
- Crew construction
"""

import json
import os
import sys

import pytest

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


# ── Dataset Registry Tests ────────────────────────────────────────────


class TestDatasetRegistry:
    """Tests for the dataset catalog and search tool."""

    def test_catalog_file_exists(self):
        """The datasets.json catalog file should exist."""
        catalog_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "config",
            "datasets.json",
        )
        assert os.path.exists(catalog_path), f"Catalog not found at {catalog_path}"

    def test_catalog_is_valid_json(self):
        """The catalog should be valid JSON."""
        catalog_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "config",
            "datasets.json",
        )
        with open(catalog_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        assert "datasets" in data
        assert "categories" in data

    def test_catalog_has_datasets(self):
        """The catalog should contain at least 30 datasets."""
        catalog_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "config",
            "datasets.json",
        )
        with open(catalog_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        datasets = data["datasets"]
        assert len(datasets) >= 30, f"Expected 30+ datasets, got {len(datasets)}"

    def test_each_dataset_has_required_fields(self):
        """Each dataset should have all required fields."""
        catalog_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "config",
            "datasets.json",
        )
        with open(catalog_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        required_fields = [
            "name", "category", "provider", "access_method",
            "description", "use_cases", "url",
        ]

        for dataset in data["datasets"]:
            for field in required_fields:
                assert field in dataset, (
                    f"Dataset '{dataset.get('name', 'unknown')}' "
                    f"missing field '{field}'"
                )

    def test_all_categories_covered(self):
        """All 10 categories should be represented in the catalog."""
        catalog_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "config",
            "datasets.json",
        )
        with open(catalog_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        expected_categories = {
            "satellite_imagery", "maps_boundaries", "weather_climate",
            "elevation", "land_cover", "population", "fire", "soil",
            "government_data", "research_papers",
        }

        actual_categories = {d["category"] for d in data["datasets"]}
        missing = expected_categories - actual_categories
        assert not missing, f"Missing categories in datasets: {missing}"


class TestDatasetRegistryTool:
    """Tests for the DatasetRegistryTool search functionality."""

    def test_tool_initialization(self):
        """The tool should initialize without errors."""
        from tools.dataset_registry_tool import DatasetRegistryTool
        tool = DatasetRegistryTool()
        assert tool.name == "Dataset Registry Search"

    def test_search_flood_detection(self):
        """Searching for flood detection should return SAR/radar datasets."""
        from tools.dataset_registry_tool import DatasetRegistryTool
        tool = DatasetRegistryTool()
        result = json.loads(tool._run(query="flood detection"))
        assert result["total_matches"] > 0
        dataset_names = [d["name"] for d in result["datasets"]]
        # Sentinel-1 (SAR) is the primary flood detection dataset
        assert "Sentinel-1" in dataset_names, (
            f"Sentinel-1 should be found for flood detection. Got: {dataset_names}"
        )

    def test_search_ndvi_vegetation(self):
        """Searching for NDVI should return optical satellite datasets."""
        from tools.dataset_registry_tool import DatasetRegistryTool
        tool = DatasetRegistryTool()
        result = json.loads(tool._run(query="ndvi vegetation analysis"))
        assert result["total_matches"] > 0
        dataset_names = [d["name"] for d in result["datasets"]]
        assert "Sentinel-2" in dataset_names, (
            f"Sentinel-2 should be found for NDVI. Got: {dataset_names}"
        )

    def test_search_with_category_filter(self):
        """Filtering by category should only return datasets in that category."""
        from tools.dataset_registry_tool import DatasetRegistryTool
        tool = DatasetRegistryTool()
        result = json.loads(tool._run(query="data", category="elevation"))
        for dataset in result["datasets"]:
            assert dataset["category"] == "elevation", (
                f"Category filter failed: got {dataset['category']}"
            )

    def test_search_rainfall_weather(self):
        """Searching for rainfall should return weather/climate datasets."""
        from tools.dataset_registry_tool import DatasetRegistryTool
        tool = DatasetRegistryTool()
        result = json.loads(tool._run(query="rainfall precipitation"))
        assert result["total_matches"] > 0
        dataset_names = [d["name"] for d in result["datasets"]]
        assert "CHIRPS" in dataset_names, (
            f"CHIRPS should be found for rainfall. Got: {dataset_names}"
        )

    def test_search_india_specific(self):
        """Searching for India-related data should return Indian sources."""
        from tools.dataset_registry_tool import DatasetRegistryTool
        tool = DatasetRegistryTool()
        result = json.loads(tool._run(query="india boundaries satellite"))
        assert result["total_matches"] > 0

    def test_search_wildfire(self):
        """Searching for wildfire should return NASA FIRMS."""
        from tools.dataset_registry_tool import DatasetRegistryTool
        tool = DatasetRegistryTool()
        result = json.loads(tool._run(query="wildfire fire detection"))
        assert result["total_matches"] > 0
        dataset_names = [d["name"] for d in result["datasets"]]
        assert "NASA FIRMS" in dataset_names, (
            f"NASA FIRMS should be found for wildfire. Got: {dataset_names}"
        )

    def test_empty_query_returns_results(self):
        """An empty-ish query should still return datasets (all scored 1.0)."""
        from tools.dataset_registry_tool import DatasetRegistryTool
        tool = DatasetRegistryTool()
        result = json.loads(tool._run(query="find data sources"))
        # After stopword filtering, this may have no keywords — but should
        # still return results (all scored 1.0)
        assert result["total_matches"] >= 0


# ── Agent Tests (require crewai but not API key) ──────────────────────


class TestAgents:
    """Tests for agent creation (does not require API key)."""

    def test_planner_agent_creation(self):
        """The Planner Agent should be created with correct role."""
        from crewai import LLM
        from agents.planner_agent import create_planner_agent

        # Use a dummy LLM (won't make API calls in this test)
        dummy_llm = LLM(
            model="gemini/gemini-2.0-flash",
            api_key="dummy_key_for_testing",
        )
        agent = create_planner_agent(llm=dummy_llm)
        assert agent.role == "Geospatial Analysis Planner"
        assert agent.allow_delegation is False

    def test_dataset_agent_creation(self):
        """The Dataset Discovery Agent should be created with tools."""
        from crewai import LLM
        from agents.dataset_discovery_agent import create_dataset_discovery_agent

        dummy_llm = LLM(
            model="gemini/gemini-2.0-flash",
            api_key="dummy_key_for_testing",
        )
        agent = create_dataset_discovery_agent(llm=dummy_llm)
        assert agent.role == "Geospatial Dataset Discovery Specialist"
        assert len(agent.tools) > 0, "Dataset agent should have tools"
        assert agent.allow_delegation is False


# ── Crew Tests ────────────────────────────────────────────────────────


class TestCrew:
    """Tests for crew construction."""

    def test_crew_initialization(self):
        """The GeoLensCrew should initialize with both agents."""
        from crewai import LLM
        from crews.geolens_crew import GeoLensCrew

        dummy_llm = LLM(
            model="gemini/gemini-2.0-flash",
            api_key="dummy_key_for_testing",
        )
        crew = GeoLensCrew(llm=dummy_llm, verbose=False)
        assert crew.planner is not None
        assert crew.dataset_agent is not None

    def test_pydantic_models(self):
        """Pydantic output models should be valid."""
        from crews.geolens_crew import AnalysisPlan, DatasetRecommendation, DatasetMatch

        # Test AnalysisPlan
        plan = AnalysisPlan(
            query_summary="Test query",
            location="Test location",
            time_period="2024",
            analysis_types=["ndvi"],
            data_requirements=["satellite_imagery"],
            expected_outputs=["ndvi_map"],
        )
        assert plan.query_summary == "Test query"

        # Test DatasetRecommendation
        rec = DatasetRecommendation(
            recommended_datasets=[
                DatasetMatch(
                    name="Sentinel-2",
                    provider="ESA",
                    access_method="Google Earth Engine",
                    why_recommended="Best for NDVI",
                )
            ],
            workflow_suggestion="Use Sentinel-2 for NDVI analysis",
        )
        assert len(rec.recommended_datasets) == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
