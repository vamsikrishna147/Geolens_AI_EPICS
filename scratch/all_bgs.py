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

    els = page.evaluate('''() => {
        const found = [];
        document.querySelectorAll('*').forEach(el => {
            const r = el.getBoundingClientRect();
            const cs = window.getComputedStyle(el);
            if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.display !== 'none' && cs.visibility !== 'hidden') {
                found.push({
                    tag: el.tagName,
                    cls: el.className,
                    bg: cs.backgroundColor,
                    rect: {x: r.x, y: r.y, w: r.width, h: r.height}
                });
            }
        });
        return found;
    }''')
    for e in els:
        print(e)

    browser.close()
