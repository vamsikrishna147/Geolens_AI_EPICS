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

    # Let's inspect everything inside .cursor-crosshair
    html = page.evaluate('''() => {
        const root = document.querySelector('.cursor-crosshair');
        function describe(node) {
            if (!node || node.nodeType !== 1) return null;
            const r = node.getBoundingClientRect();
            return {
                tag: node.tagName,
                class: node.className,
                rect: {x: r.x, y: r.y, w: r.width, h: r.height},
                style: node.getAttribute('style'),
                bg: window.getComputedStyle(node).backgroundColor,
                children: Array.from(node.children).map(describe)
            };
        }
        return describe(root);
    }''')
    import json
    print(json.dumps(html, indent=2))
    browser.close()
