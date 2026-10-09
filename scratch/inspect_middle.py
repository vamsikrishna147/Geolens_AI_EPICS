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

    middle_row = page.evaluate('''() => {
        // Find the middle row
        const rows = document.querySelectorAll('.flex-1.min-h-0');
        if (!rows.length) return "No middle row";
        const row = rows[0];
        return {
            rowOuter: row.outerHTML,
            children: Array.from(row.children).map(c => ({
                tag: c.tagName,
                class: c.className,
                rect: c.getBoundingClientRect(),
                bg: window.getComputedStyle(c).backgroundColor,
                innerHTML: c.innerHTML
            }))
        };
    }''')
    import json
    print(json.dumps(middle_row, indent=2))
    browser.close()
