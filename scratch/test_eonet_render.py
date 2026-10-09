from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    page.goto('http://localhost:5173')
    
    # Wait 8 seconds for NASA EONET to load
    print("Waiting 8 seconds...")
    page.wait_for_timeout(8000)
    page.screenshot(path='scratch/after_8s_no_query.png')
    print("Saved scratch/after_8s_no_query.png")

    browser.close()
