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

    # Find ALL elements and pseudo elements with width approx 896
    res = page.evaluate('''() => {
        const out = [];
        document.querySelectorAll('*').forEach(el => {
            const r = el.getBoundingClientRect();
            if (Math.abs(r.width - 896) < 20) {
                const cs = window.getComputedStyle(el);
                const before = window.getComputedStyle(el, ':before');
                const after = window.getComputedStyle(el, ':after');
                out.push({
                    tag: el.tagName,
                    class: el.className,
                    rect: {x: r.x, y: r.y, w: r.width, h: r.height},
                    bg: cs.backgroundColor,
                    overflow: cs.overflow,
                    clipPath: cs.clipPath,
                    beforeBg: before.backgroundColor,
                    beforeH: before.height,
                    afterBg: after.backgroundColor,
                    afterH: after.height,
                    html: el.outerHTML.substring(0, 100)
                });
            }
        });
        return out;
    }''')
    for item in res:
        print(item)

    browser.close()
