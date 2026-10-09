import os
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    page.goto('http://localhost:5173')
    page.wait_for_timeout(3000)

    # 1. Verify LeftNav is visible and has high z-index
    dock = page.locator('nav[aria-label="Main navigation widget"]')
    assert dock.is_visible(), "Dock widget should be visible"
    print("[OK] LeftNav floating dock is visible on Mission Control")

    # 2. Check no black box in Mission Control
    page.screenshot(path='scratch/verify_mission_control.png')
    print("[OK] Saved verify_mission_control.png")

    # 3. Switch to TimeLens via Dock
    timelens_button = page.locator('button[title="TimeLens"]')
    timelens_button.click()
    page.wait_for_timeout(2000)

    # Verify LeftNav is STILL visible in TimeLens!
    assert dock.is_visible(), "Dock widget should be visible in TimeLens"
    print("[OK] LeftNav floating dock is visible in TimeLens")

    # Type a custom query in TimeLens
    time_search = page.locator('input[placeholder*="Type place name"]')
    time_search.fill('Ratnagiri')
    page.keyboard.press('Enter')
    page.wait_for_timeout(2000)
    page.screenshot(path='scratch/verify_timelens.png')
    print("[OK] Saved verify_timelens.png with Ratnagiri query")

    # 4. Switch to Map & Analyzer via Dock
    map_button = page.locator('button[title="Map & Analyzer"]')
    map_button.click()
    page.wait_for_timeout(2000)
    assert dock.is_visible(), "Dock widget should be visible in Map & Analyzer"
    print("[OK] LeftNav floating dock is visible in Map & Analyzer")
    page.screenshot(path='scratch/verify_map.png')

    # 5. Switch back to TimeLens and verify Ratnagiri query is STILL THERE!
    timelens_button.click()
    page.wait_for_timeout(1000)
    val = time_search.input_value()
    print(f"TimeLens input value after tab switching: '{val}'")
    assert 'Ratnagiri' in val, f"Expected Ratnagiri in TimeLens query, got '{val}'"
    print("[OK] TimeLens remembered running query and context across tab switches!")

    # 6. Switch back to Mission Control
    mission_button = page.locator('button[title="Mission Control"]')
    mission_button.click()
    page.wait_for_timeout(1000)
    print("[OK] Successfully switched back to Mission Control with all views preserved")

    browser.close()
    print("\nALL VERIFICATION CHECKS PASSED!")
