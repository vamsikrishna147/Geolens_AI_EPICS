import os
os.makedirs('scratch', exist_ok=True)
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    page.goto('http://localhost:5173')
    page.wait_for_timeout(3000)
    page.screenshot(path='scratch/initial.png')
    print('Initial screenshot taken.')

    # Type query
    input_el = page.locator('input').first
    input_el.fill('Analyze high-resolution satellite imagery for Ratnagiri')
    page.keyboard.press('Enter')
    page.wait_for_timeout(5000)
    page.screenshot(path='scratch/after_submit.png')
    print('After submit screenshot taken.')

    # Print all elements and styles
    info = page.evaluate('''() => {
        return Array.from(document.querySelectorAll('*')).map(el => {
            const r = el.getBoundingClientRect();
            const s = window.getComputedStyle(el);
            return {
                tag: el.tagName,
                className: el.className ? String(el.className) : '',
                bg: s.backgroundColor,
                w: Math.round(r.width),
                h: Math.round(r.height),
                top: Math.round(r.top),
                left: Math.round(r.left),
                text: el.innerText ? el.innerText.substring(0, 30).replace(/\\n/g, ' ') : ''
            };
        }).filter(e => e.w > 100 && e.h > 40 && e.bg !== 'rgba(0, 0, 0, 0)' && e.bg !== 'transparent');
    }''')
    for item in info:
        print(item)

    browser.close()
