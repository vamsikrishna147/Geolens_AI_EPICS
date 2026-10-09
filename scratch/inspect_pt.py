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

    res = page.evaluate('''() => {
        const el = document.elementFromPoint(500, 250);
        return {
            tagName: el ? el.tagName : null,
            className: el ? el.className : null,
            id: el ? el.id : null,
            outerHTML: el ? el.outerHTML.substring(0, 300) : null
        };
    }''')
    print('Element at (500, 250):', res)

    # Also test elementsFromPoint to see the full stack of elements under that point!
    all_els = page.evaluate('''() => {
        const els = document.elementsFromPoint(500, 250);
        return els.map(e => ({
            tagName: e.tagName,
            className: e.className,
            id: e.id,
            bg: window.getComputedStyle(e).backgroundColor
        }));
    }''')
    print('All elements at (500, 250):')
    for e in all_els:
        print('  ', e)

    browser.close()
