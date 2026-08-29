"""
GeoLens AI - Research Papers Tool (OpenAlex)
=============================================
Searches scientific literature using the OpenAlex API.
No API key required. 250M+ scholarly works indexed.

OpenAlex: https://openalex.org
API docs: https://docs.openalex.org
"""

import json
from typing import Optional, Type

import requests
from crewai.tools import BaseTool
from pydantic import BaseModel, Field
from typing import ClassVar

from storage.storage_manager import StorageManager


class ResearchToolInput(BaseModel):
    query: str = Field(..., description="Research topic to search, e.g. 'flood detection Andhra Pradesh satellite imagery'")
    max_results: Optional[int] = Field(10, description="Max number of papers to return (1-50).")
    year_from: Optional[int] = Field(2018, description="Minimum publication year.")
    query_id: Optional[str] = Field("", description="Query ID for storage tracking.")


class ResearchTool(BaseTool):
    """
    Searches scientific papers via the OpenAlex API (free, no key needed).
    Returns title, abstract, DOI, year, citation count, and open-access URL.
    """

    name: str = "Scientific Research Paper Search Tool"
    description: str = (
        "Searches 250M+ scientific papers using OpenAlex (free, no API key needed). "
        "Returns relevant papers with title, abstract, DOI, publication year, citation "
        "count, and open-access PDF links. Use this to find research supporting "
        "geospatial analysis, methodology papers, remote sensing studies, or policy "
        "documents relevant to the user's query location and topic."
    )
    args_schema: Type[BaseModel] = ResearchToolInput

    OPENALEX_URL: ClassVar[str] = "https://api.openalex.org/works"

    def _run(
        self,
        query: str,
        max_results: Optional[int] = 10,
        year_from: Optional[int] = 2018,
        query_id: str = "",
    ) -> str:
        max_results = max(1, min(max_results or 10, 50))
        print(f"[ResearchTool] Searching OpenAlex for: '{query}'")

        try:
            response = requests.get(
                self.OPENALEX_URL,
                params={
                    "search": query,
                    "filter": f"publication_year:>{(year_from or 2018) - 1},open_access.is_oa:true",
                    "per-page": max_results,
                    "sort": "relevance_score:desc",
                    "select": "id,title,abstract_inverted_index,doi,publication_year,cited_by_count,open_access,primary_location,concepts",
                    "mailto": "geolens-ai@research.org",  # Polite pool for higher rate limits
                },
                timeout=20,
            )
            response.raise_for_status()
            data = response.json()
        except requests.RequestException as e:
            return json.dumps({"error": f"OpenAlex API error: {str(e)}"})

        results = data.get("results", [])
        papers = []

        for work in results:
            # Reconstruct abstract from inverted index
            abstract = self._reconstruct_abstract(work.get("abstract_inverted_index"))
            # Get open access PDF
            oa = work.get("open_access", {})
            pdf_url = oa.get("oa_url") or oa.get("pdf_url") or ""
            # Get primary venue
            primary_loc = work.get("primary_location") or {}
            source = primary_loc.get("source") or {}
            venue = source.get("display_name", "Unknown journal")

            papers.append({
                "title": work.get("title", "No title"),
                "abstract": abstract[:500] + "..." if abstract and len(abstract) > 500 else abstract,
                "doi": work.get("doi", ""),
                "year": work.get("publication_year"),
                "cited_by": work.get("cited_by_count", 0),
                "venue": venue,
                "open_access_url": pdf_url,
                "is_open_access": oa.get("is_oa", False),
                "concepts": [c["display_name"] for c in (work.get("concepts") or [])[:5]],
            })

        result = {
            "query": query,
            "total_found": data.get("meta", {}).get("count", len(papers)),
            "returned": len(papers),
            "papers": papers,
            "source": "OpenAlex (openalex.org)",
            "api_key_required": False,
        }

        # Store
        storage = StorageManager(query_id=query_id or None)
        storage.save_metadata(result, result_type="research_results")

        # Build readable summary
        lines = [f"Scientific papers found for '{query}' (since {year_from}):"]
        for i, p in enumerate(papers[:5], 1):
            lines.append(f"\n  {i}. {p['title']} ({p['year']})")
            lines.append(f"     Venue: {p['venue']} | Cited: {p['cited_by']} times")
            if p["open_access_url"]:
                lines.append(f"     Free PDF: {p['open_access_url']}")
            if p["abstract"]:
                lines.append(f"     Abstract: {p['abstract'][:200]}...")

        if len(papers) > 5:
            lines.append(f"\n  ... and {len(papers)-5} more papers saved to file.")
        lines.append(f"\n  Source: OpenAlex (free, no API key) | Saved to: {storage.data_root}/research/")

        return json.dumps({"summary": "\n".join(lines), "count": len(papers), "papers": papers})

    def _reconstruct_abstract(self, inverted_index: Optional[dict]) -> str:
        """Reconstruct abstract text from OpenAlex inverted index format."""
        if not inverted_index:
            return ""
        try:
            word_positions = []
            for word, positions in inverted_index.items():
                for pos in positions:
                    word_positions.append((pos, word))
            word_positions.sort(key=lambda x: x[0])
            return " ".join(word for _, word in word_positions)
        except Exception:
            return ""
