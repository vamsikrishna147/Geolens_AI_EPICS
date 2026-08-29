"""
GeoLens AI — CLI Entry Point
==============================
Interactive CLI for the 5-agent geospatial intelligence pipeline.

Usage:
    python main.py                               # Interactive mode
    python main.py "Analyze floods in Assam"    # Direct query
    python main.py --examples                    # Run example queries
    python main.py --help                        # Show help
"""

import json
import os
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

from dotenv import load_dotenv


# ── Output Formatters ─────────────────────────────────────────────────

def print_banner():
    print("""
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ██████╗ ███████╗ ██████╗ ██╗     ███████╗███╗   ██╗███████╗  ║
║  ██╔════╝ ██╔════╝██╔═══██╗██║     ██╔════╝████╗  ██║██╔════╝  ║
║  ██║  ███╗█████╗  ██║   ██║██║     █████╗  ██╔██╗ ██║███████╗  ║
║  ██║   ██║██╔══╝  ██║   ██║██║     ██╔══╝  ██║╚██╗██║╚════██║  ║
║  ╚██████╔╝███████╗╚██████╔╝███████╗███████╗██║ ╚████║███████║  ║
║   ╚═════╝ ╚══════╝ ╚═════╝ ╚══════╝╚══════╝╚═╝  ╚═══╝╚══════╝  ║
║                                                              ║
║       AI-Powered Autonomous Geospatial Intelligence          ║
║              5-Agent Pipeline  ·  v2.0                       ║
╚══════════════════════════════════════════════════════════════╝
""")


def _section(title: str, emoji: str = ""):
    sep = "═" * 60
    print(f"\n{sep}\n  {emoji}  {title}\n{sep}")


def print_analysis_plan(plan: dict):
    _section("MISSION PLAN", "📋")
    print(f"\n  Summary:   {plan.get('query_summary', 'N/A')}")
    print(f"  Location:  {plan.get('location', 'N/A')}")
    print(f"  Period:    {plan.get('time_period', 'N/A')}")
    types = plan.get("analysis_types", [])
    if types:
        print(f"  Analysis:  {', '.join(types)}")
    reqs = plan.get("data_requirements", [])
    if reqs:
        print(f"  Datasets:  {', '.join(reqs)}")
    outputs = plan.get("expected_outputs", [])
    if outputs:
        print(f"  Outputs:   {', '.join(outputs)}")
    if plan.get("priority_notes"):
        print(f"  Notes:     {plan['priority_notes']}")


def print_data_acquisition(res: dict):
    _section("DATA ACQUISITION", "📥")
    acquired = res.get("acquired_data", [])
    print(f"\n  ✅ {len(acquired)} dataset(s) acquired.")
    for ds in acquired:
        print(f"     · {ds.get('name', 'Dataset')}")
    failed = res.get("failed_acquisitions", [])
    if failed:
        print(f"\n  ❌ {len(failed)} failed:")
        for f in failed:
            print(f"     · {f}")
    print(f"\n  Storage: {res.get('storage_summary', 'N/A')}")
    print(f"  Next:    {res.get('next_steps', 'N/A')}")


def print_gis_result(gis: dict):
    _section("GIS PROCESSING", "🗺️")
    ops = gis.get("operations_performed", [])
    print(f"\n  {len(ops)} operation(s) performed:")
    for op in ops:
        print(f"     · {op}")
    maps = gis.get("maps_generated", [])
    if maps:
        print(f"\n  Interactive maps:")
        for m in maps:
            print(f"     🌐 {m}")
    print(f"\n  {gis.get('gis_summary', 'N/A')}")


def print_earth_observation(eo: dict):
    _section("EARTH OBSERVATION  ·  TIMELENS", "🛰️")
    print(f"\n  Baseline:   {eo.get('baseline_year', 'N/A')}  →  {eo.get('comparison_year', 'N/A')}")
    print(f"\n  Changes:    {eo.get('change_summary', 'N/A')}")
    anomalies = eo.get("detected_anomalies", [])
    if anomalies:
        print(f"\n  Anomalies:")
        for a in anomalies:
            print(f"     ⚠ {a}")
    print(f"\n  Synthesis:  {eo.get('event_summary', 'N/A')}")
    score = eo.get("confidence_score", "N/A")
    icon  = "🟢" if "high" in str(score).lower() else "🟡" if "medium" in str(score).lower() else "🔴"
    print(f"\n  {icon} Confidence: {score}")


def print_official_report(report: dict):
    _section("INTELLIGENCE REPORT", "📄")
    print(f"\n  ID:         {report.get('report_id', 'N/A')}")
    print(f"  Title:      {report.get('title', 'N/A')}")
    print(f"  Class:      {report.get('classification', 'N/A')}")
    print(f"\n  Executive Summary:\n  {report.get('executive_summary', 'N/A')}")
    analytics = report.get("analytics", {})
    if analytics:
        print(f"\n  Impact:     {analytics.get('primary_impact', 'N/A')}")
        print(f"  Area:       {analytics.get('total_area_affected_km2', 'N/A')} km²")
        print(f"  Severity:   {analytics.get('severity', 'N/A')}")
    print(f"  Confidence: {report.get('confidence_score', 'N/A')}")


# ── Example queries ───────────────────────────────────────────────────

EXAMPLE_QUERIES = [
    ("Flood Analysis",
     "Analyze flooding in Konaseema district, Andhra Pradesh during the "
     "last seven days and compare it with the same period last year."),
    ("Deforestation Detection",
     "Show deforestation in the Amazon rainforest between 2020 and 2024. "
     "Identify areas with the most significant forest loss."),
    ("NDVI Agriculture",
     "What is the NDVI trend for agricultural land near Hyderabad, India "
     "over the past year? Identify any drought-affected areas."),
]


# ── Pipeline runner ───────────────────────────────────────────────────

def run_query(query: str, verbose: bool = True) -> dict:
    """Run a geospatial query through the 5-agent pipeline."""
    from crews.geolens_crew import GeoLensCrew

    print(f'\n🌍 Processing: "{query}"\n')
    print("⏳ 5 AI agents are collaborating...\n")

    crew   = GeoLensCrew(verbose=verbose)
    result = crew.run(query)

    # Print each phase result
    if result.get("analysis_plan"):
        print_analysis_plan(result["analysis_plan"])
    if result.get("data_acquisition"):
        print_data_acquisition(result["data_acquisition"])
    if result.get("gis_processing"):
        print_gis_result(result["gis_processing"])
    if result.get("earth_observation"):
        print_earth_observation(result["earth_observation"])
    if result.get("official_report"):
        print_official_report(result["official_report"])

    _section("COMPLETE", "✅")
    print("\n  GeoLens AI mission complete.\n")
    return result


# ── Interactive REPL ──────────────────────────────────────────────────

def interactive_mode():
    print_banner()
    print("  Welcome to GeoLens AI — 5-Agent Satellite Intelligence Platform\n")
    print("  Quick examples:")
    for i, (name, q) in enumerate(EXAMPLE_QUERIES, 1):
        print(f"    {i}. [{name}]  {q[:70]}…")
    print("\n  Type 'examples' to run all, or 'quit' to exit.\n")

    while True:
        try:
            user_input = input("🌍 GeoLens> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n\nGoodbye! 👋")
            break

        if not user_input:
            continue
        if user_input.lower() in ("quit", "exit", "q"):
            print("\nGoodbye! 👋")
            break
        if user_input.lower() == "examples":
            for name, q in EXAMPLE_QUERIES:
                print(f"\n{'='*60}\n  Example: {name}\n{'='*60}")
                run_query(q)
            continue
        if user_input.isdigit():
            idx = int(user_input) - 1
            if 0 <= idx < len(EXAMPLE_QUERIES):
                run_query(EXAMPLE_QUERIES[idx][1])
                continue
        run_query(user_input)


# ── Entry point ───────────────────────────────────────────────────────

def main():
    load_dotenv()

    if not os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY") == "your_gemini_api_key_here":
        # Allow Ollama-only setups
        if not os.getenv("OLLAMA_MODEL"):
            print("\n❌ ERROR: No LLM configured.")
            print("   Set GEMINI_API_KEY or OLLAMA_MODEL in your .env file.")
            print("   Get a free Gemini key at: https://aistudio.google.com/apikey\n")
            sys.exit(1)

    if len(sys.argv) > 1:
        if sys.argv[1] == "--examples":
            print_banner()
            for name, q in EXAMPLE_QUERIES:
                print(f"\n{'='*60}\n  Example: {name}\n{'='*60}")
                run_query(q)
        elif sys.argv[1] == "--help":
            print("GeoLens AI — Autonomous Geospatial Intelligence (5-Agent Pipeline)")
            print("\nUsage:")
            print('  python main.py                        # Interactive mode')
            print('  python main.py "your query here"     # Single query')
            print('  python main.py --examples             # Run examples')
            print('  python main.py --help                 # Show this help')
        else:
            print_banner()
            run_query(" ".join(sys.argv[1:]))
    else:
        interactive_mode()


if __name__ == "__main__":
    main()
