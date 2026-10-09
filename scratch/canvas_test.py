from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    page.goto('http://localhost:5173')
    page.wait_for_timeout(2000)

    input_box = page.locator('input[placeholder*="Ask AI Assistant"]')
    input_box.fill('get imagery of african wildlife')
    page.keyboard.press('Enter')
    page.wait_for_timeout(3000)

    # 1. Screenshot canvas ONLY
    canvas = page.locator('canvas')
    canvas.screenshot(path='scratch/canvas_only.png')
    print("Saved scratch/canvas_only.png")

    # 2. Hide HUD Overlay completely and screenshot full page
    page.evaluate('''() => {
        const hud = document.querySelector('.absolute.inset-0.z-10');
        if (hud) hud.style.display = 'none';
    }''')
    page.screenshot(path='scratch/without_hud.png')
    print("Saved scratch/without_hud.png")

    browser.close()
