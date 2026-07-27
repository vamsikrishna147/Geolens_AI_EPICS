import sys
import os
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

from tools.screenshot_tool import ScreenshotTool

def test_screenshot():
    tool = ScreenshotTool()
    print("Testing ScreenshotTool on ISRO Bhuvan NDMA page...")
    result = tool._run(
        url="https://bhuvan-app1.nrsc.gov.in/disaster/disaster.php?id=landslide_monitor", 
        description="ISRO Bhuvan Landslide Monitoring Dashboard",
        wait_time_seconds=5
    )
    print("\n--- Result ---\n")
    print(result)

if __name__ == "__main__":
    test_screenshot()
