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

    # Inspect all Three.js scene objects
    scene_dump = page.evaluate('''() => {
        if (!window.__globe) return "No __globe";
        const scene = window.__globe.scene();
        const objs = [];
        scene.traverse(obj => {
            const mat = obj.material;
            const m = Array.isArray(mat) ? mat[0] : mat;
            objs.push({
                type: obj.type,
                name: obj.name,
                visible: obj.visible,
                geom: obj.geometry ? {
                    type: obj.geometry.type,
                    boundingSphere: obj.geometry.boundingSphere,
                    boundingBox: obj.geometry.boundingBox
                } : null,
                mat: m ? {
                    type: m.type,
                    color: m.color ? m.color.getHexString() : null,
                    opacity: m.opacity,
                    transparent: m.transparent,
                    depthTest: m.depthTest,
                    depthWrite: m.depthWrite,
                    colorWrite: m.colorWrite,
                    blending: m.blending
                } : null,
                pos: {x: obj.position.x, y: obj.position.y, z: obj.position.z},
                scale: {x: obj.scale.x, y: obj.scale.y, z: obj.scale.z}
            });
        });
        return objs;
    }''')
    import json
    print(json.dumps(scene_dump, indent=2))
    browser.close()
