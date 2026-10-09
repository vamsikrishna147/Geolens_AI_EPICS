import urllib.request
import json

payload = {
    "official_report": {
        "report_id": "TEST_MISSION_99",
        "title": "Valencia Flood Assessment",
        "classification": "OFFICIAL GEOSPATIAL ASSESSMENT",
        "executive_summary": "Extensive flooding detected across the Turia basin following catastrophic rainfall.",
        "confidence_score": 98.4,
        "analytics": {
            "total_area_affected_km2": "142.5",
            "severity": "HIGH",
            "primary_impact": "Severe inundation of agricultural and urban lowlands."
        },
        "satellite_imagery": {
            "url_before": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-0.45,39.40,-0.30,39.55&bboxSR=4326&imageSR=4326&size=800,600&format=png&f=image",
            "url_after": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-0.45,39.40,-0.30,39.55&bboxSR=4326&imageSR=4326&size=800,600&format=png&f=image",
            "primary_url": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-0.45,39.40,-0.30,39.55&bboxSR=4326&imageSR=4326&size=800,600&format=png&f=image",
            "baseline_year": "2018",
            "comparison_year": "2024"
        }
    },
    "analysis_plan": {
        "location": "Valencia, Spain",
        "time_period": "2018–2024"
    },
    "earth_observation": {
        "baseline_year": "2018",
        "comparison_year": "2024"
    },
    "mode": "full_analysis"
}

req = urllib.request.Request(
    "http://localhost:8000/api/report/export",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        html = resp.read().decode("utf-8")
        print("Report export success! HTTP status:", resp.status)
        print("HTML length:", len(html))
        print("Contains img tag:", "<img" in html)
        print("Contains url_before:", "url_before" in html or "arcgisonline.com" in html)
except Exception as e:
    print("Report export error:", e)
