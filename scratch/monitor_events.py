from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1280, 'height': 800})

    page.on("console", lambda msg: print(f"[BROWSER CONSOLE] {msg.type}: {msg.text}"))
    page.on("request", lambda req: print(f"[BROWSER REQUEST] {req.method} {req.url}") if not req.url.endswith('.js') and not req.url.endswith('.css') else None)

    page.goto('http://localhost:5173')
    page.wait_for_timeout(2000)

    input_box = page.locator('input[placeholder*="Ask AI Assistant"]')
    input_box.fill('get imagery of african wildlife')
    page.keyboard.press('Enter')
    page.wait_for_timeout(3000)

    browser.close()
