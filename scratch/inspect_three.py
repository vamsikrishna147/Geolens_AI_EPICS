from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    page.goto('http://localhost:5173')
    page.wait_for_timeout(3000)

    def dump_scene(label):
        return page.evaluate(f'''() => {{
            if (!window.__globe) return "No __globe";
            const scene = window.__globe.scene();
            const meshes = [];
            scene.traverse(obj => {{
                if (obj.isMesh) {{
                    const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
                    meshes.push({{
                        name: obj.name || "unnamed",
                        type: obj.type,
                        geom: obj.geometry ? obj.geometry.type : null,
                        color: mat && mat.color ? mat.color.getHexString() : null,
                        opacity: mat ? mat.opacity : null,
                        visible: obj.visible,
                        renderOrder: obj.renderOrder
                    }});
                }}
            }});
            return {{ label: "{label}", meshCount: meshes.length, meshes: meshes }};
        }}''')

    before = dump_scene("BEFORE")
    print(f"Before query: {before['meshCount']} meshes")
    for m in before.get('meshes', []):
        print("  ", m)

    input_box = page.locator('input[placeholder*="Ask AI Assistant"]')
    input_box.fill('get imagery of african wildlife')
    page.keyboard.press('Enter')
    page.wait_for_timeout(3000)

    after = dump_scene("AFTER")
    print(f"\nAfter query: {after['meshCount']} meshes")
    for m in after.get('meshes', []):
        print("  ", m)

    browser.close()
