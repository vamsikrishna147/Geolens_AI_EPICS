"""
GeoLens AI - Screenshot Tool
==============================
Captures screenshots of web portals (like ISRO Bhuvan, NDMA) that lack APIs.
Uses Playwright to render JavaScript and save a PNG.
"""

import json
import os
import uuid
from datetime import datetime
from typing import Optional, Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field
from playwright.sync_api import sync_playwright

from storage.storage_manager import StorageManager


class ScreenshotToolInput(BaseModel):
    url: str = Field(..., description="The full URL to capture, e.g., 'https://bhuvan-app1.nrsc.gov.in/disaster/'")
    description: str = Field(..., description="What this screenshot is meant to show (used for metadata logging).")
    wait_time_seconds: int = Field(5, description="How long to wait (in seconds) for maps/data to load before capturing.")
    query_id: Optional[str] = Field("", description="Query ID for storage tracking.")


class ScreenshotTool(BaseTool):
    """
    Captures high-resolution screenshots of web pages. Use this when a data source 
    (like a government dashboard or ISRO portal) doesn't have an API.
    """

    name: str = "Web Screenshot Tool"
    description: str = (
        "Opens a URL in a headless browser, waits for the map or data to load, and "
        "captures a full-page screenshot. Use this to visually document data from "
        "portals like ISRO Bhuvan or NDMA that lack programmatic API access."
    )
    args_schema: Type[BaseModel] = ScreenshotToolInput

    def _run(
        self,
        url: str,
        description: str,
        wait_time_seconds: int = 5,
        query_id: str = "",
    ) -> str:
        print(f"[ScreenshotTool] Capturing {url} (Waiting {wait_time_seconds}s)")
        
        # Ensure screenshot directory exists
        storage = StorageManager(query_id=query_id or None)
        screenshot_dir = os.path.join(storage.data_root, "screenshots")
        os.makedirs(screenshot_dir, exist_ok=True)
        
        filename = f"screenshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}.png"
        filepath = os.path.join(screenshot_dir, filename)

        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                page = browser.new_page(viewport={"width": 1920, "height": 1080})
                
                # Navigate and wait for network to be idle
                page.goto(url, wait_until="networkidle", timeout=30000)
                
                # Wait additional time for maps/js to render
                page.wait_for_timeout(wait_time_seconds * 1000)
                
                # Capture full page screenshot
                page.screenshot(path=filepath, full_page=True)
                browser.close()
                
        except Exception as e:
            return json.dumps({"error": f"Failed to capture screenshot: {str(e)}"})

        # Metadata
        summary = {
            "url": url,
            "description": description,
            "filepath": filepath,
            "filename": filename,
            "timestamp": datetime.now().isoformat(),
            "source": "Web Screenshot"
        }

        # Store metadata in DB
        storage.save_metadata(summary, result_type="screenshot")

        # Format readable string for agent
        readable = (
            f"✅ Successfully captured screenshot of {url}\n"
            f"   Description: {description}\n"
            f"   Saved at: {filepath}\n\n"
            f"You can now inform the user that the visual data has been securely saved to their local drive."
        )

        return json.dumps({"summary": readable, "data": summary})
