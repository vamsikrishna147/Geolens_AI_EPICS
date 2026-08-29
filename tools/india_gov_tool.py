"""
GeoLens AI - India Government Data Tool (data.gov.in)
=======================================================
Searches and retrieves datasets from India's Open Government Data
(OGD) Platform at data.gov.in.

Free API key required: https://data.gov.in/user/register
Without key: searches are still possible but with lower rate limits.

API docs: https://data.gov.in/ogdp-userguide/docs/api
"""

import json
import os
from typing import Optional, Type

import requests
from crewai.tools import BaseTool
from pydantic import BaseModel, Field
from typing import ClassVar

from storage.storage_manager import StorageManager


class IndiaGovToolInput(BaseModel):
    query: str = Field(..., description="Search keywords, e.g. 'flood Andhra Pradesh', 'rainfall district wise', 'forest cover India'")
    max_results: Optional[int] = Field(10, description="Max number of datasets to return.")
    format_filter: Optional[str] = Field("", description="Filter by format: 'csv', 'json', 'xml', 'pdf', 'shp'. Leave empty for all.")
    query_id: Optional[str] = Field("", description="Query ID for storage tracking.")


class IndiaGovTool(BaseTool):
    """
    Searches datasets on India's Open Government Data platform (data.gov.in).
    Provides access to 400,000+ Indian government datasets on agriculture,
    demographics, infrastructure, water resources, disasters, and more.
    """

    name: str = "India Government Open Data Tool"
    description: str = (
        "Searches 400,000+ datasets from India's Open Government Data platform (data.gov.in). "
        "Provides access to official Indian data on agriculture, flood records, rainfall, "
        "forest cover, demographics, infrastructure, water resources, disaster records, "
        "and administrative statistics. Returns dataset metadata and download links. "
        "Best for India-specific analysis requiring official government data."
    )
    args_schema: Type[BaseModel] = IndiaGovToolInput

    BASE_URL: ClassVar[str] = "https://api.data.gov.in/lists"

    def _run(
        self,
        query: str,
        max_results: Optional[int] = 10,
        format_filter: Optional[str] = "",
        query_id: str = "",
    ) -> str:
        api_key = os.getenv("INDIA_GOV_API_KEY", "")
        has_key = bool(api_key and api_key != "your_india_gov_api_key_here")

        if not has_key:
            return json.dumps({
                "status": "api_key_required",
                "message": (
                    "data.gov.in requires a free API key. "
                    "Register at: https://data.gov.in/user/register\n"
                    "After registration, set INDIA_GOV_API_KEY in your .env file.\n\n"
                    "Alternative: Visit https://data.gov.in and search manually for:\n"
                    f"  '{query}'"
                ),
                "manual_search_url": f"https://data.gov.in/search/?q={query.replace(' ', '+')}",
                "key_env_var": "INDIA_GOV_API_KEY",
            })

        print(f"[IndiaGovTool] Searching data.gov.in for: '{query}'")

        params = {
            "api-key": api_key,
            "format": "json",
            "q": query,
            "count": max_results or 10,
            "offset": 0,
        }
        if format_filter:
            params["filters[format]"] = format_filter.lower()

        try:
            response = requests.get(self.BASE_URL, params=params, timeout=20)
            response.raise_for_status()
            data = response.json()
        except requests.RequestException as e:
            return json.dumps({"error": f"data.gov.in API error: {str(e)}"})

        records = data.get("records", [])
        datasets = []

        for rec in records:
            resources = rec.get("field", [])
            download_links = []
            for res in resources:
                if isinstance(res, dict) and res.get("id") in ("download_url", "source_url"):
                    download_links.append(res.get("value", ""))

            datasets.append({
                "title": rec.get("title", ""),
                "description": rec.get("desc", "")[:200],
                "organization": rec.get("org", [{}])[0].get("name", "") if rec.get("org") else "",
                "format": rec.get("format", ""),
                "updated": rec.get("updated", ""),
                "download_links": download_links,
                "source_url": f"https://data.gov.in/resource/{rec.get('id', '')}",
            })

        result = {
            "query": query,
            "total_found": data.get("total", len(datasets)),
            "returned": len(datasets),
            "datasets": datasets,
            "source": "data.gov.in (Government of India Open Data Platform)",
        }

        storage = StorageManager(query_id=query_id or None)
        storage.save_metadata(result, result_type="india_gov_data")

        lines = [f"India government datasets for '{query}':"]
        for i, ds in enumerate(datasets[:5], 1):
            lines.append(f"\n  {i}. {ds['title']}")
            lines.append(f"     Org: {ds['organization']} | Format: {ds['format']}")
            if ds["download_links"]:
                lines.append(f"     Download: {ds['download_links'][0]}")
        lines.append(f"\n  Source: data.gov.in | Total: {result['total_found']} datasets found")

        return json.dumps({"summary": "\n".join(lines), "count": len(datasets), "data": result})
