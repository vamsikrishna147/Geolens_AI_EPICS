"""
GeoLens AI - Web Search Tool
==============================
Gives agents the ability to search the internet for news, reports, and datasets
using the Serper (Google Search) API.

Requires SERPER_API_KEY in .env.
"""

import json
import os
from typing import Optional, Type

import requests
from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from storage.storage_manager import StorageManager


class WebSearchToolInput(BaseModel):
    query: str = Field(..., description="The search query to look up on Google (e.g., 'Uttarakhand landslide 2024 report')")
    max_results: int = Field(5, description="Maximum number of results to return (default 5, max 10).")
    site_filter: Optional[str] = Field(
        None, 
        description="Optional domain to restrict search to, e.g., 'gov.in' or 'ndma.gov.in'. Do not use 'site:' prefix."
    )
    query_id: Optional[str] = Field("", description="Query ID for storage tracking.")


class WebSearchTool(BaseTool):
    """
    Searches the internet for recent news, government reports, and dataset links.
    Uses Google Search (via Serper API) to return titles, snippets, and URLs.
    """

    name: str = "Web Search Tool"
    description: str = (
        "Searches the internet via Google to find recent news, disaster reports, "
        "academic discussions, or dataset download pages. You can restrict the "
        "search to specific domains like 'gov.in'. Use this when fixed APIs do "
        "not have the specific report or news context you need."
    )
    args_schema: Type[BaseModel] = WebSearchToolInput

    def _run(
        self,
        query: str,
        max_results: int = 5,
        site_filter: Optional[str] = None,
        query_id: str = "",
    ) -> str:
        api_key = os.getenv("SERPER_API_KEY")
        if not api_key or api_key == "paste_your_key_here":
            return json.dumps({"error": "SERPER_API_KEY is not set in .env. Cannot perform web search."})

        # Apply site filter if provided
        search_query = query
        if site_filter:
            search_query = f"{query} site:{site_filter}"

        print(f"[WebSearchTool] Searching Google for: '{search_query}'")

        url = "https://google.serper.dev/search"
        payload = json.dumps({
            "q": search_query,
            "num": min(max_results, 10)
        })
        headers = {
            'X-API-KEY': api_key,
            'Content-Type': 'application/json'
        }

        try:
            response = requests.post(url, headers=headers, data=payload, timeout=15)
            response.raise_for_status()
            data = response.json()
        except requests.RequestException as e:
            return json.dumps({"error": f"Web search failed: {str(e)}"})

        # Extract organic results
        organic = data.get("organic", [])
        
        results = []
        for item in organic:
            results.append({
                "title": item.get("title", ""),
                "snippet": item.get("snippet", ""),
                "link": item.get("link", ""),
                "date": item.get("date", "Unknown")
            })

        summary = {
            "query": search_query,
            "result_count": len(results),
            "results": results,
            "source": "Google Search (via Serper)"
        }

        # Store result
        storage = StorageManager(query_id=query_id or None)
        storage.save_metadata(summary, result_type="web_search")

        # Format readable string for agent
        readable = f"Found {len(results)} search results for '{search_query}':\n\n"
        for i, res in enumerate(results, 1):
            readable += f"{i}. {res['title']}\n"
            if res['date'] != "Unknown":
                readable += f"   Date: {res['date']}\n"
            readable += f"   Snippet: {res['snippet']}\n"
            readable += f"   URL: {res['link']}\n\n"

        return json.dumps({"summary": readable, "data": summary})
