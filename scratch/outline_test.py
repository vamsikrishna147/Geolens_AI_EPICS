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

    # Outline every element in the HUD overlay
    page.evaluate('''() => {
        let count = 0;
        document.querySelectorAll('.absolute.inset-0.z-10 *').forEach(el => {
            el.style.border = '2px solid red';
            el.setAttribute('data-debug-id', count++);
        });
    }''')
    page.screenshot(path='scratch/outlined.png')
    print("Saved scratch/outlined.png")

    browser.close()
