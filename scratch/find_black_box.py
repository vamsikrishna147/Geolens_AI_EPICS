import time
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    page.goto('http://localhost:5173')
    page.wait_for_timeout(3000)

    # Type query
    input_box = page.locator('input[placeholder*="Ask AI Assistant"]')
    input_box.fill('get imagery of african wildlife')
    page.keyboard.press('Enter')
    page.wait_for_timeout(4000)

    page.screenshot(path='scratch/live_view.png')
    print("Screenshot saved to scratch/live_view.png")

    # Inspect all elements on screen with black or dark backgrounds
    elements = page.query_selector_all('*')
    for el in elements:
        try:
            box = el.bounding_box()
            tag = el.evaluate('e => e.tagName')
            cls = el.evaluate('e => e.className')
            style = el.evaluate('e => window.getComputedStyle(e).backgroundColor')
            if box and box['width'] > 200 and box['height'] > 100:
                print(f"Tag: {tag}, Class: {cls[:40]}..., Box: {box}, Bg: {style}")
        except:
            pass

    browser.close()
