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

    # Test hiding Child 2 (Middle row)
    page.evaluate('''() => {
        const row = document.querySelector('.flex-1.min-h-0');
        if (row) row.style.display = 'none';
    }''')
    page.screenshot(path='scratch/without_middle_row.png')
    print("Saved without_middle_row.png")

    # Restore middle row, hide Child 4 (Bottom command)
    page.evaluate('''() => {
        const row = document.querySelector('.flex-1.min-h-0');
        if (row) row.style.display = '';
        const bot = document.querySelector('.pointer-events-auto.flex.justify-center.pb-3');
        if (bot) bot.style.display = 'none';
    }''')
    page.screenshot(path='scratch/without_bottom_command.png')
    print("Saved without_bottom_command.png")

    browser.close()
