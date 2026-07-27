"""
GeoLens AI - Main Entry Point
===============================
Interactive CLI for running the GeoLens AI multi-agent geospatial platform.

Usage:
    python main.py                                          # Interactive mode
    python main.py "Analyze flooding in Konaseema district" # Direct query
    python main.py --examples                               # Run all examples

The platform uses CrewAI to orchestrate AI agents that analyze geospatial
queries and recommend the best open data sources.
"""

import json
import os
import sys

# Fix Windows emoji printing issues
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

from dotenv import load_dotenv


# ── Pretty Output Formatting ─────────────────────────────────────────


def print_banner():
    """Print the GeoLens AI banner."""
    banner = """
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║     ██████╗ ███████╗ ██████╗ ██╗     ███████╗███╗   ██╗███████╗   ║
║    ██╔════╝ ██╔════╝██╔═══██╗██║     ██╔════╝████╗  ██║██╔════╝   ║
║    ██║  ███╗█████╗  ██║   ██║██║     █████╗  ██╔██╗ ██║███████╗   ║
║    ██║   ██║██╔══╝  ██║   ██║██║     ██╔══╝  ██║╚██╗██║╚════██║   ║
║    ╚██████╔╝███████╗╚██████╔╝███████╗███████╗██║ ╚████║███████║   ║
║     ╚═════╝ ╚══════╝ ╚═════╝ ╚══════╝╚══════╝╚═╝  ╚═══╝╚══════╝   ║
║                                                              ║
║          AI-Powered Autonomous Geospatial Intelligence       ║
║                        Platform v0.1                         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    """
    print(banner)


def print_section(title: str, emoji: str = ""):
    """Print a formatted section header."""
    line = "═" * 60
    print(f"\n{line}")
    print(f"  {emoji}  {title}")
    print(f"{line}")


def print_analysis_plan(plan: dict):
    """Pretty-print the structured analysis plan."""
    print_section("ANALYSIS PLAN", "📋")

    print(f"\n  📝 Summary:    {plan.get('query_summary', 'N/A')}")
    print(f"  📍 Location:   {plan.get('location', 'N/A')}")
    print(f"  📅 Time:       {plan.get('time_period', 'N/A')}")

    analysis_types = plan.get("analysis_types", [])
    if analysis_types:
        print(f"  🔬 Analysis:   {', '.join(analysis_types)}")

    data_reqs = plan.get("data_requirements", [])
    if data_reqs:
        print(f"  📊 Data Needs: {', '.join(data_reqs)}")

    outputs = plan.get("expected_outputs", [])
    if outputs:
        print(f"  📦 Outputs:    {', '.join(outputs)}")

    notes = plan.get("priority_notes", "")
    if notes:
        print(f"  ⚠️  Notes:      {notes}")


def print_dataset_recommendations(rec: dict):
    """Pretty-print the dataset recommendations."""
    print_section("DATASET RECOMMENDATIONS", "🗂️")

    datasets = rec.get("recommended_datasets", [])
    for i, ds in enumerate(datasets, 1):
        print(f"\n  {i}. {ds.get('name', 'Unknown')}")
        print(f"     Provider:    {ds.get('provider', 'N/A')}")
        print(f"     Access:      {ds.get('access_method', 'N/A')}")
        print(f"     Resolution:  {ds.get('spatial_resolution', 'N/A')}")
        print(f"     Time Range:  {ds.get('temporal_range', 'N/A')}")
        print(f"     → Why:       {ds.get('why_recommended', 'N/A')}")

    workflow = rec.get("workflow_suggestion", "")
    if workflow:
        print(f"\n  🔄 Suggested Workflow:")
        # Wrap long text
        words = workflow.split()
        line = "     "
        for word in words:
            if len(line) + len(word) + 1 > 75:
                print(line)
                line = "     " + word
            else:
                line += " " + word if line.strip() else "     " + word
        if line.strip():
            print(line)

    notes = rec.get("notes", "")
    if notes:
        print(f"\n  📝 Notes: {notes}")


def print_acquisition_result(res: dict):
    """Pretty-print the data acquisition result."""
    print_section("DATA ACQUISITION", "📥")

    datasets = res.get("acquired_data", [])
    print(f"\n  ✅ Successfully acquired {len(datasets)} datasets.")
    for i, ds in enumerate(datasets, 1):
        print(f"  {i}. {ds.get('name', 'Dataset')}")

    failures = res.get("failed_acquisitions", [])
    if failures:
        print(f"\n  ❌ Failed to acquire {len(failures)} datasets.")
        for i, fail in enumerate(failures, 1):
            print(f"  {i}. {fail}")

    print(f"\n  💾 Storage: {res.get('storage_summary', 'N/A')}")
    print(f"  ⏭️  Next:    {res.get('next_steps', 'N/A')}")


def print_satellite_analysis(sa: dict):
    """Pretty-print the satellite analysis result."""
    print_section("EARTH OBSERVATION INTELLIGENCE", "🛰️")

    print(f"\n  🌍 Event Summary:")
    print(f"     {sa.get('event_summary', 'N/A')}")
    
    print(f"\n  📡 Satellite Data Interpretation:")
    print(f"     {sa.get('gee_interpretation', 'N/A')}")

    print(f"\n  🌐 Web Intelligence Context:")
    print(f"     {sa.get('web_intelligence', 'N/A')}")

    print(f"\n  💥 Estimated Impact / Damage:")
    print(f"     {sa.get('damage_assessment', 'N/A')}")

    score = sa.get('confidence_score', 'N/A')
    emoji = "🟢" if "high" in score.lower() else "🟡" if "medium" in score.lower() else "🔴"
    print(f"\n  {emoji} Confidence Score: {score}")


def print_gis_result(gis: dict):
    """Pretty-print the GIS processing result."""
    print_section("GIS PROCESSING", "🗺️")

    ops = gis.get("operations_performed", [])
    print(f"\n  🔧 Operations performed: {len(ops)}")
    for i, op in enumerate(ops, 1):
        print(f"  {i}. {op}")

    files = gis.get("output_files", [])
    if files:
        print(f"\n  📁 Output files:")
        for f in files:
            print(f"     → {f}")

    maps = gis.get("maps_generated", [])
    if maps:
        print(f"\n  🗺️  Interactive maps generated:")
        for m in maps:
            print(f"     🌐 {m}")

    print(f"\n  📝 {gis.get('gis_summary', 'N/A')}")


def print_raw_output(output: dict):
    """Print raw output as formatted JSON (fallback)."""
    print_section("RAW OUTPUT", "📄")
    print(json.dumps(output, indent=2, default=str))


# ── Example Queries ───────────────────────────────────────────────────

EXAMPLE_QUERIES = [
    (
        "Flood Analysis",
        "Analyze flooding in Konaseema district, Andhra Pradesh during the "
        "last seven days and compare it with the same period last year."
    ),
    (
        "Deforestation Detection",
        "Show me deforestation in the Amazon rainforest between 2020 and 2024. "
        "Identify areas with the most significant forest loss."
    ),
    (
        "NDVI Agriculture",
        "What is the NDVI trend for agricultural land near Hyderabad, India "
        "over the past year? Identify any drought-affected areas."
    ),
]


# ── Main ──────────────────────────────────────────────────────────────


def run_query(query: str, verbose: bool = True):
    """
    Run a geospatial query through the GeoLens AI crew.

    Args:
        query: Natural language geospatial query.
        verbose: Enable detailed agent logging.

    Returns:
        The crew output dictionary.
    """
    from crews.geolens_crew import GeoLensCrew

    print(f"\n🌍 Processing query: \"{query}\"\n")
    print("⏳ AI agents are collaborating... This may take a minute.\n")

    # Initialize and run the crew
    crew = GeoLensCrew(verbose=verbose)
    result = crew.run(query)

    # Display structured output
    if result.get("analysis_plan"):
        print_analysis_plan(result["analysis_plan"])
    else:
        print("\n⚠️  Could not extract structured analysis plan.")

    if result.get("dataset_recommendation"):
        print_dataset_recommendations(result["dataset_recommendation"])
    else:
        print("\n⚠️  Could not extract structured dataset recommendation.")

    if result.get("acquisition_result"):
        print_acquisition_result(result["acquisition_result"])

    if result.get("gis_processing"):
        print_gis_result(result["gis_processing"])

    if result.get("satellite_analysis"):
        print_satellite_analysis(result["satellite_analysis"])

    print_section("COMPLETE", "✅")
    print("\n  GeoLens AI analysis complete!")
    print("  Data has been acquired, processed, and mapped.")
    print("  Interactive HTML maps are ready to open in your browser.\n")

    return result


def interactive_mode():
    """Run GeoLens AI in interactive mode."""
    print_banner()
    print("  Welcome to GeoLens AI! Ask any geospatial question.\n")
    print("  Examples:")
    for i, (name, query) in enumerate(EXAMPLE_QUERIES, 1):
        print(f"    {i}. [{name}] {query[:70]}...")
    print(f"\n  Type 'examples' to run all examples, or 'quit' to exit.\n")

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
            for name, query in EXAMPLE_QUERIES:
                print(f"\n{'='*60}")
                print(f"  Example: {name}")
                print(f"{'='*60}")
                run_query(query)
            continue

        # Check if user typed a number (1, 2, 3) for example queries
        if user_input.isdigit():
            idx = int(user_input) - 1
            if 0 <= idx < len(EXAMPLE_QUERIES):
                _, query = EXAMPLE_QUERIES[idx]
                run_query(query)
                continue

        # Run the user's custom query
        run_query(user_input)


def main():
    """Main entry point."""
    # Load environment variables
    load_dotenv()

    # Check for API key
    if not os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY") == "your_gemini_api_key_here":
        print("\n❌ ERROR: GEMINI_API_KEY not set!")
        print("   Please set your Gemini API key in the .env file:")
        print("   GEMINI_API_KEY=your_actual_api_key")
        print("\n   Get a free API key at: https://aistudio.google.com/apikey")
        sys.exit(1)

    # Parse command line arguments
    if len(sys.argv) > 1:
        if sys.argv[1] == "--examples":
            print_banner()
            for name, query in EXAMPLE_QUERIES:
                print(f"\n{'='*60}")
                print(f"  Example: {name}")
                print(f"{'='*60}")
                run_query(query)
        elif sys.argv[1] == "--help":
            print("GeoLens AI - Autonomous Geospatial Intelligence Platform")
            print("\nUsage:")
            print('  python main.py                      # Interactive mode')
            print('  python main.py "your query here"    # Run a single query')
            print("  python main.py --examples           # Run example queries")
            print("  python main.py --help               # Show this help")
        else:
            # Direct query from command line
            query = " ".join(sys.argv[1:])
            print_banner()
            run_query(query)
    else:
        # Interactive mode
        interactive_mode()


if __name__ == "__main__":
    main()
