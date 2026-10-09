from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    page.goto('http://localhost:5173')
    page.wait_for_timeout(2000)

    input_box = page.locator('input[placeholder*="Ask AI Assistant"]')
    input_box.fill('get imagery of african wildlife')
    page.keyboard.press('Enter')

    for t in [500, 1000, 1500, 2000, 3000]:
        page.wait_for_timeout(500)
        page.screenshot(path=f'scratch/step_{t}ms.png')
        print(f"Captured step_{t}ms.png")

    browser.close()
