/* 
GeoLens AI - Brutalist Frontend Logic
=======================================
Handles 3D Globe rendering, API requests, Chatbot UI, and tactical elements.
*/

document.addEventListener("DOMContentLoaded", () => {
    initGlobe();
    setupForms();
    setupCursorTracking();
});

// --- 3D Globe Background (Brutalist Monochrome Style) ---
function initGlobe() {
    const globeContainer = document.getElementById('globeViz');
    if (!globeContainer) return;

    // Use a realistic Earth texture for a more premium, public-friendly look
    const world = Globe()
        (globeContainer)
        .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
        .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
        .showAtmosphere(true)
        .atmosphereColor('#00b8ff') // Cool blue atmosphere
        .atmosphereAltitude(0.15)
        .pointOfView({ altitude: 2.5 }, 5000);

    world.controls().autoRotate = true;
    world.controls().autoRotateSpeed = 1.2; // Increased rotation speed
    world.controls().enableZoom = false; 

    // Add some random "satellites" (points)
    const gData = [...Array(300).keys()].map(() => ({
        lat: (Math.random() - 0.5) * 180,
        lng: (Math.random() - 0.5) * 360,
        size: Math.random() * 0.8 + 0.2, // Made satellites larger
        color: Math.random() > 0.5 ? '#FF4500' : '#00FF00' // Orange & Green
    }));

    world.pointsData(gData)
        .pointAltitude(0.08) // Lifted slightly higher
        .pointColor('color')
        .pointRadius('size')
        .pointResolution(32); // Higher resolution points


    window.addEventListener('resize', () => {
        world.width(window.innerWidth);
        world.height(window.innerHeight);
    });
}

// --- Tactical Elements ---
function setupCursorTracking() {
    const crosshair = document.getElementById('crosshair');
    const coordTracker = document.getElementById('coordTracker');
    
    document.addEventListener('mousemove', (e) => {
        // Move crosshair
        crosshair.style.transform = `translate(${e.clientX - 10}px, ${e.clientY - 10}px)`;
        
        // Mock LAT/LON based on screen position
        const lat = ((e.clientY / window.innerHeight) * 180 - 90).toFixed(4);
        const lon = ((e.clientX / window.innerWidth) * 360 - 180).toFixed(4);
        coordTracker.innerText = `LAT: ${lat} | LON: ${lon}`;
    });
}

// --- SPA Navigation ---
window.switchPage = function(sectionId) {
    // Hide all sections
    const sections = document.querySelectorAll('.page-section');
    sections.forEach(sec => sec.classList.remove('active'));
    
    // Deactivate all nav buttons
    const btns = document.querySelectorAll('.nav-btn');
    btns.forEach(btn => btn.classList.remove('active'));
    
    // Show selected section
    document.getElementById(sectionId).classList.add('active');
    
    // Highlight button
    event.currentTarget.classList.add('active');
};

// --- Quick Query helper ---
window.setQuery = function(query) {
    const qBox = document.getElementById('queryInput');
    qBox.value = query;
    // Add a brutalist flash effect
    qBox.style.backgroundColor = '#00FF00';
    qBox.style.color = '#000';
    setTimeout(() => {
        qBox.style.backgroundColor = '#000';
        qBox.style.color = '#fff';
    }, 150);
};

// --- Form & API Handling ---
function setupForms() {
    // Main Query Form
    const queryForm = document.getElementById('queryForm');
    queryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = document.getElementById('queryInput').value;
        if (!query) return;
        startAnalysis(query);
    });

    // Chatbot Form
    const chatForm = document.getElementById('chatForm');
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const chatInput = document.getElementById('chatInput');
        const text = chatInput.value;
        if (!text) return;
        
        appendChatMessage(text, 'user');
        chatInput.value = '';
        
        // Mock AI response
        setTimeout(() => {
            appendChatMessage("ANALYSIS: I am currently functioning as a UI mock. Connect me to the LLM backend for active conversational intelligence.", 'ai');
        }, 1000);
    });
}

function appendChatMessage(text, sender) {
    const box = document.getElementById('chatBox');
    const msg = document.createElement('div');
    msg.className = `msg ${sender}`;
    msg.innerText = `> ${text}`;
    box.appendChild(msg);
    box.scrollTop = box.scrollHeight;
}

let checkInterval;

async function startAnalysis(query) {
    document.getElementById('resultsSection').classList.add('hidden');
    document.getElementById('submitBtn').disabled = true;
    document.getElementById('submitBtn').innerText = 'EXECUTING...';
    
    // Add to history
    addHistoryItem(query);

    resetPipeline();
    appendTerminal(`> DIRECTIVE RECEIVED: "${query}"`);

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query })
        });
        
        const data = await response.json();
        if (data.task_id) {
            appendTerminal(`> TASK_ID ASSIGNED: ${data.task_id}`);
            appendTerminal('> DEPLOYING 5-AGENT SWARM...');
            
            // Start polling
            checkInterval = setInterval(() => checkStatus(data.task_id), 2000);
        } else {
            appendTerminal(`> ERROR: DEPLOYMENT FAILED.`);
            resetUI();
        }
    } catch (err) {
        appendTerminal(`> SYSTEM FAULT: ${err.message}`);
        resetUI();
    }
}

function addHistoryItem(query) {
    const list = document.getElementById('historyList');
    const li = document.createElement('li');
    li.className = 'history-item';
    const id = "0x" + Math.floor(Math.random()*16777215).toString(16).toUpperCase();
    const shortQ = query.length > 20 ? query.substring(0, 20) + '...' : query;
    li.innerText = `ID: ${id} - ${shortQ}`;
    li.onclick = () => setQuery(query);
    list.prepend(li);
}

// Simulate agent progress
let currentSimulatedStep = 0;
const steps = ['planner', 'discovery', 'acquisition', 'gis', 'satellite'];

async function checkStatus(taskId) {
    try {
        const response = await fetch(`/api/status/${taskId}`);
        const data = await response.json();

        // Simulate progressing through the pipeline visually
        if (data.status === 'running') {
            if (currentSimulatedStep < 4) {
                if (Math.random() > 0.6) {
                    currentSimulatedStep++;
                    updatePipeline(currentSimulatedStep);
                }
            }
        }

        if (data.status === 'completed') {
            clearInterval(checkInterval);
            updatePipeline(4);
            appendTerminal('> OPERATION COMPLETE. GENERATING INTEL REPORT.');
            displayResults(data.result);
            resetUI();
        } else if (data.status === 'failed') {
            clearInterval(checkInterval);
            appendTerminal(`> CRITICAL FAILURE: ${data.error}`, 'error');
            resetUI();
        }
    } catch (err) {
        console.error(err);
    }
}

function updatePipeline(stepIndex) {
    steps.forEach((step, i) => {
        const el = document.getElementById(`step-${step}`);
        if (i <= stepIndex) {
            el.classList.add('active');
            if (i === stepIndex) {
                appendTerminal(`> MODULE [${step.toUpperCase()}] ACTIVE...`);
            }
        }
    });
}

function resetPipeline() {
    steps.forEach(step => {
        document.getElementById(`step-${step}`).classList.remove('active');
    });
    const term = document.getElementById('terminalOutput');
    term.innerHTML = '<p>> SYSTEM REINITIALIZED...</p>';
    currentSimulatedStep = 0;
    updatePipeline(0);
}

function resetUI() {
    const btn = document.getElementById('submitBtn');
    btn.disabled = false;
    btn.innerText = 'EXECUTE_DIRECTIVE';
}

function appendTerminal(text, type='normal') {
    const term = document.getElementById('terminalOutput');
    const p = document.createElement('p');
    p.innerText = text;
    if (type === 'error') p.className = 'error';
    if (type === 'success') p.className = 'success';
    term.appendChild(p);
    term.scrollTop = term.scrollHeight;
}

function displayResults(result) {
    document.getElementById('resultsSection').classList.remove('hidden');
    
    // 1. Intelligence Report
    const sa = result.satellite_analysis;
    let reportHtml = '';
    
    if (sa) {
        reportHtml = `
            <div style="margin-bottom:15px; border-bottom:1px solid var(--border-color); padding-bottom:10px;">
                <span class="tel-val warn">CONFIDENCE: ${sa.confidence_score.toUpperCase()}</span>
            </div>
            <h4>EVENT_SUMMARY</h4>
            <p>${sa.event_summary}</p>
            
            <h4>GEO_INTERPRETATION</h4>
            <p>${sa.gee_interpretation}</p>
            
            <h4>WEB_INTEL</h4>
            <p>${sa.web_intelligence}</p>
            
            <h4>DAMAGE_ASSESSMENT</h4>
            <p>${sa.damage_assessment}</p>
        `;
    } else {
        reportHtml = `<p class="error">REPORT GENERATION FAILED.</p>`;
    }
    document.getElementById('reportContent').innerHTML += reportHtml; // Append after header
    
    // 2. Map Frame
    const mapFrame = document.getElementById('mapFrame');
    if (result.gis_processing && result.gis_processing.maps_generated && result.gis_processing.maps_generated.length > 0) {
        const mapPath = result.gis_processing.maps_generated[0];
        const mapFilename = mapPath.split(/[\/\\]/).pop();
        mapFrame.src = `/maps/${mapFilename}`;
    } else {
        mapFrame.src = "data:text/html;charset=utf-8,<html><body style='background:#000;color:#00FF00;display:flex;align-items:center;justify-content:center;font-family:monospace;border:2px solid #FF4500;'>NO MAP DATA AVAILABLE</body></html>";
    }
}
