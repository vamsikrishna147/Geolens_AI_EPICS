import sys
import os
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

from tools.web_search_tool import WebSearchTool

def test_search():
    tool = WebSearchTool()
    print("Testing WebSearchTool...")
    result = tool._run(query="Uttarakhand landslide 2024 ISRO", max_results=3)
    print("\n--- Result ---\n")
    print(result)

if __name__ == "__main__":
    test_search()
