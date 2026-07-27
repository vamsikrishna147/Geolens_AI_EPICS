"""
GeoLens AI - Dataset Registry Tool
====================================
A custom CrewAI tool that searches the GeoLens geospatial dataset catalog.
The Dataset Discovery Agent uses this tool to find the most relevant open
data sources for any geospatial analysis task.

The tool loads a comprehensive JSON catalog of 35+ datasets and performs
keyword matching against names, descriptions, use cases, and categories.
"""

import json
import os
from typing import Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field


class DatasetSearchInput(BaseModel):
    """Input schema for the Dataset Registry Search tool."""

    query: str = Field(
        ...,
        description=(
            "Search keywords describing the data you need. Examples: "
            "'satellite imagery for flood detection', 'rainfall data India', "
            "'land cover classification', 'elevation terrain analysis', "
            "'wildfire active fire data'"
        ),
    )
    category: str = Field(
        default="",
        description=(
            "Optional category filter. Valid categories: satellite_imagery, "
            "maps_boundaries, weather_climate, elevation, land_cover, "
            "population, fire, soil, government_data, research_papers. "
            "Leave empty to search all categories."
        ),
    )


class DatasetRegistryTool(BaseTool):
    """
    Searches the GeoLens geospatial dataset registry to find relevant
    open data sources for any geospatial analysis task.

    The registry contains 35+ curated datasets covering satellite imagery,
    maps, weather, elevation, land cover, population, fire, soil,
    government data, and research papers.
    """

    name: str = "Dataset Registry Search"
    description: str = (
        "Search the GeoLens geospatial dataset registry to find the most "
        "relevant open data sources. Provide search keywords describing what "
        "data you need (e.g., 'flood detection satellite imagery', 'rainfall "
        "data', 'administrative boundaries India'). Optionally filter by "
        "category. Returns matched datasets with details on provider, access "
        "method, resolution, and use cases."
    )
    args_schema: Type[BaseModel] = DatasetSearchInput

    def _run(self, query: str, category: str = "") -> str:
        """
        Search the dataset registry and return matching datasets.

        Args:
            query: Search keywords describing the data needed.
            category: Optional category filter.

        Returns:
            JSON string with matched datasets ranked by relevance.
        """
        # Load the dataset catalog
        catalog = self._load_catalog()
        if not catalog:
            return json.dumps({
                "error": "Failed to load dataset catalog.",
                "datasets": [],
            })

        datasets = catalog.get("datasets", [])

        # Filter by category if specified
        if category:
            category_lower = category.lower().strip()
            datasets = [
                d for d in datasets
                if d.get("category", "").lower() == category_lower
            ]

        # Score and rank datasets by relevance to the query
        query_keywords = self._extract_keywords(query)
        scored_datasets = []

        for dataset in datasets:
            score = self._calculate_relevance(dataset, query_keywords)
            if score > 0:
                scored_datasets.append((score, dataset))

        # Sort by score (highest first) and take top 10
        scored_datasets.sort(key=lambda x: x[0], reverse=True)
        top_results = scored_datasets[:10]

        # Format the results
        results = []
        for score, dataset in top_results:
            results.append({
                "name": dataset.get("name", ""),
                "category": dataset.get("category", ""),
                "provider": dataset.get("provider", ""),
                "access_method": dataset.get("access_method", ""),
                "description": dataset.get("description", ""),
                "use_cases": dataset.get("use_cases", []),
                "spatial_resolution": dataset.get("spatial_resolution", ""),
                "temporal_range": dataset.get("temporal_range", ""),
                "url": dataset.get("url", ""),
                "relevance_score": round(score, 2),
            })

        # Build response
        response = {
            "query": query,
            "category_filter": category if category else "all",
            "total_matches": len(results),
            "datasets": results,
        }

        return json.dumps(response, indent=2)

    def _load_catalog(self) -> dict:
        """Load the dataset catalog from the config/datasets.json file."""
        # Try multiple possible paths to find the catalog
        possible_paths = [
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", "datasets.json"),
            os.path.join(os.getcwd(), "config", "datasets.json"),
            os.path.join(os.path.dirname(__file__), "..", "config", "datasets.json"),
        ]

        for path in possible_paths:
            abs_path = os.path.abspath(path)
            if os.path.exists(abs_path):
                try:
                    with open(abs_path, "r", encoding="utf-8") as f:
                        return json.load(f)
                except (json.JSONDecodeError, IOError) as e:
                    print(f"[DatasetRegistry] Error loading {abs_path}: {e}")
                    continue

        print("[DatasetRegistry] WARNING: Could not find config/datasets.json")
        return {}

    def _extract_keywords(self, query: str) -> list[str]:
        """
        Extract meaningful keywords from the search query.
        Filters out common stop words and normalizes text.
        """
        stop_words = {
            "the", "a", "an", "and", "or", "but", "in", "on", "at", "to",
            "for", "of", "with", "by", "from", "is", "are", "was", "were",
            "be", "been", "being", "have", "has", "had", "do", "does", "did",
            "will", "would", "could", "should", "may", "might", "can", "shall",
            "this", "that", "these", "those", "i", "me", "my", "we", "our",
            "you", "your", "it", "its", "they", "them", "their", "what",
            "which", "who", "whom", "how", "when", "where", "why", "all",
            "each", "every", "both", "few", "more", "most", "some", "any",
            "no", "not", "only", "same", "than", "too", "very", "just",
            "about", "above", "after", "before", "between", "during", "into",
            "through", "under", "up", "down", "out", "off", "over", "again",
            "find", "search", "get", "show", "give", "need", "want", "use",
            "data", "dataset", "datasets", "information", "source", "sources",
        }

        # Normalize: lowercase, replace common separators with spaces
        normalized = query.lower()
        for char in ["-", "_", "/", ",", ".", "(", ")", "[", "]", ":", ";"]:
            normalized = normalized.replace(char, " ")

        words = normalized.split()
        keywords = [w.strip() for w in words if w.strip() and w.strip() not in stop_words]

        return keywords

    def _calculate_relevance(self, dataset: dict, keywords: list[str]) -> float:
        """
        Calculate a relevance score for a dataset based on keyword matching.

        Scoring weights:
        - Name match: 10 points per keyword
        - Use case match: 8 points per keyword
        - Category match: 6 points per keyword
        - Description match: 3 points per keyword
        - Provider match: 2 points per keyword

        Returns the total relevance score.
        """
        if not keywords:
            return 1.0  # Return all datasets if no keywords

        score = 0.0
        name_lower = dataset.get("name", "").lower()
        category_lower = dataset.get("category", "").lower()
        description_lower = dataset.get("description", "").lower()
        provider_lower = dataset.get("provider", "").lower()
        use_cases = [uc.lower() for uc in dataset.get("use_cases", [])]
        use_cases_str = " ".join(use_cases)

        for keyword in keywords:
            # Name match (highest weight)
            if keyword in name_lower:
                score += 10.0

            # Use case match (high weight)
            if keyword in use_cases_str:
                score += 8.0
            # Also check partial matches in use cases
            for uc in use_cases:
                if keyword in uc or uc in keyword:
                    score += 4.0
                    break

            # Category match
            if keyword in category_lower:
                score += 6.0

            # Description match
            if keyword in description_lower:
                score += 3.0

            # Provider match
            if keyword in provider_lower:
                score += 2.0

        return score
