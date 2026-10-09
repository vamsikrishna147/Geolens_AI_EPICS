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

    # Inspect ALL elements on document where rect covers x=500, y=250
    matches = page.evaluate('''() => {
        const results = [];
        const all = document.querySelectorAll('*');
        for (const el of all) {
            const r = el.getBoundingClientRect();
            // check if (500, 250) is inside rect
            if (r.left <= 500 && r.right >= 500 && r.top <= 250 && r.bottom >= 250) {
                const style = window.getComputedStyle(el);
                results.push({
                    tag: el.tagName,
                    class: el.className,
                    id: el.id,
                    bg: style.backgroundColor,
                    opacity: style.opacity,
                    boxShadow: style.boxShadow,
                    filter: style.filter,
                    backdropFilter: style.backdropFilter,
                    rect: {x: r.x, y: r.y, w: r.width, h: r.height},
                    zIndex: style.zIndex,
                    pointerEvents: style.pointerEvents,
                    outerHTML: el.outerHTML.substring(0, 150)
                });
            }
        }
        return results;
    }''')
    for m in matches:
        print(m)

    browser.close()
