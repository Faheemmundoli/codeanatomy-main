// ============================================================
// Code Anatomy — Flow Diagram & Function Call Graph JS
// Parses code structure and renders SVG diagrams
// ============================================================

const codeInput = document.getElementById('codeInput');
const generateBtn = document.getElementById('generateBtn');
const languageSelect = document.getElementById('languageSelect');
const statusText = document.getElementById('statusText');
const languageStatus = document.getElementById('languageStatus');
const inputArea = document.getElementById('inputArea');
const diagramArea = document.getElementById('diagramArea');
const diagramSvg = document.getElementById('diagramSvg');
const diagramCanvas = document.getElementById('diagramCanvas');
const viewTitle = document.getElementById('viewTitle');
const nodeCount = document.getElementById('nodeCount');
const nodeTooltip = document.getElementById('nodeTooltip');
const tooltipTitle = document.getElementById('tooltipTitle');
const tooltipCode = document.getElementById('tooltipCode');
const diagramLegend = document.getElementById('diagramLegend');

const flowViewBtn = document.getElementById('flowViewBtn');
const callViewBtn = document.getElementById('callViewBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const fitBtn = document.getElementById('fitBtn');
const editCodeBtn = document.getElementById('editCodeBtn');

let currentView = 'flow'; // 'flow' or 'callgraph'
let zoom = 1;
let panX = 0, panY = 0;
let isDragging = false, dragStartX = 0, dragStartY = 0;
let lang = '';

// Check URL for default view
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('view') === 'callgraph') {
    currentView = 'callgraph';
    flowViewBtn.classList.remove('active');
    callViewBtn.classList.add('active');
    viewTitle.textContent = 'FUNCTION CALL GRAPH';
}

// ── Language Select ──
languageSelect.addEventListener('change', () => {
    lang = languageSelect.value;
    languageStatus.textContent = lang ? lang.toUpperCase() : 'No language selected';
    checkInputs();
});

function checkInputs() {
    generateBtn.disabled = !(languageSelect.value && codeInput.value.trim());
}
codeInput.addEventListener('input', checkInputs);

// ── View Toggle ──
flowViewBtn.addEventListener('click', () => {
    currentView = 'flow';
    flowViewBtn.classList.add('active');
    callViewBtn.classList.remove('active');
    viewTitle.textContent = 'FLOW DIAGRAM';
    diagramLegend.style.display = 'flex';
    if (diagramArea.style.display !== 'none') regenerate();
});
callViewBtn.addEventListener('click', () => {
    currentView = 'callgraph';
    callViewBtn.classList.add('active');
    flowViewBtn.classList.remove('active');
    viewTitle.textContent = 'FUNCTION CALL GRAPH';
    diagramLegend.style.display = 'none';
    if (diagramArea.style.display !== 'none') regenerate();
});

// ── Generate ──
let lastCode = '';
generateBtn.addEventListener('click', () => {
    lastCode = codeInput.value.trim();
    lang = languageSelect.value;
    if (!lastCode || !lang) return;
    regenerate();
    inputArea.style.display = 'none';
    diagramArea.style.display = 'flex';
});

function regenerate() {
    if (!lastCode) return;
    if (currentView === 'flow') {
        renderFlowDiagram(lastCode, lang);
    } else {
        renderCallGraph(lastCode, lang);
    }
}

editCodeBtn.addEventListener('click', () => {
    diagramArea.style.display = 'none';
    inputArea.style.display = 'flex';
    statusText.textContent = 'Edit code and regenerate';
});

// ── Zoom & Pan ──
zoomInBtn.addEventListener('click', () => { zoom = Math.min(zoom * 1.2, 4); applyTransform(); });
zoomOutBtn.addEventListener('click', () => { zoom = Math.max(zoom / 1.2, 0.2); applyTransform(); });
fitBtn.addEventListener('click', fitToScreen);

function applyTransform() {
    const g = diagramSvg.querySelector('.diagram-group');
    if (g) g.setAttribute('transform', `translate(${panX},${panY}) scale(${zoom})`);
}

function fitToScreen() {
    const g = diagramSvg.querySelector('.diagram-group');
    if (!g) return;
    const bbox = g.getBBox();
    const canvas = diagramCanvas.getBoundingClientRect();
    const scaleX = (canvas.width - 40) / bbox.width;
    const scaleY = (canvas.height - 40) / bbox.height;
    zoom = Math.min(scaleX, scaleY, 2);
    panX = (canvas.width - bbox.width * zoom) / 2 - bbox.x * zoom;
    panY = 20;
    applyTransform();
}

// Mouse pan
diagramCanvas.addEventListener('mousedown', (e) => {
    if (e.target.closest('.flow-node, .call-node')) return;
    isDragging = true;
    dragStartX = e.clientX - panX;
    dragStartY = e.clientY - panY;
    diagramCanvas.style.cursor = 'grabbing';
});
window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    panX = e.clientX - dragStartX;
    panY = e.clientY - dragStartY;
    applyTransform();
});
window.addEventListener('mouseup', () => {
    isDragging = false;
    diagramCanvas.style.cursor = 'grab';
});

// Mouse wheel zoom
diagramCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    zoom = Math.max(0.2, Math.min(4, zoom * delta));
    applyTransform();
});

// ══════════════════════════════════════════════
// CONTROL FLOW DIAGRAM RENDERER
// ══════════════════════════════════════════════

function parseFlowNodes(code, language) {
    const lines = code.split('\n');
    const nodes = [];
    let id = 0;

    lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        const indent = line.search(/\S/);
        let type = 'statement';
        let label = trimmed.length > 50 ? trimmed.substring(0, 47) + '...' : trimmed;

        // Function definition → entry point
        if (/^(def |function |async function |void |int |char |float |double |public |private |static |protected )/.test(trimmed) && trimmed.includes('(')) {
            type = 'entry';
            const m = trimmed.match(/(?:def|function|async function|void|int|char|float|double|public|private|static|protected)\s+(\w+)\s*\(/);
            label = m ? `${m[1]}()` : label;
        }
        // Return → exit point
        else if (/^return\b/.test(trimmed)) {
            type = 'exit';
        }
        // Conditional
        else if (/^(if |elif |else if |else\b|else:)/.test(trimmed)) {
            type = 'condition';
        }
        // Loop
        else if (/^(for |while |do\b)/.test(trimmed)) {
            type = 'loop';
        }
        // Class
        else if (/^class\b/.test(trimmed)) {
            type = 'entry';
            const m = trimmed.match(/class\s+(\w+)/);
            label = m ? `class ${m[1]}` : label;
        }
        // Try-catch
        else if (/^(try|catch|except|finally)/.test(trimmed)) {
            type = 'condition';
        }
        // Brackets only
        else if (/^[{}]$/.test(trimmed)) {
            return;
        }
        // Import
        else if (/^(import |from |#include)/.test(trimmed)) {
            type = 'statement';
        }

        nodes.push({ id: id++, line: i + 1, type, label, fullLine: trimmed, indent });
    });

    return nodes;
}

function renderFlowDiagram(code, language) {
    const nodes = parseFlowNodes(code, language);
    if (nodes.length === 0) {
        diagramSvg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#8a8a9a" font-size="16" font-family="Inter">No code structures found</text>';
        return;
    }

    const nodeW = 220, nodeH = 40, gapY = 20, gapX = 30;
    const colors = {
        entry: { fill: '#0d3320', stroke: '#10b981', text: '#34d399' },
        exit: { fill: '#3b1219', stroke: '#ef4444', text: '#fca5a5' },
        condition: { fill: '#3b2f0a', stroke: '#f59e0b', text: '#fde68a' },
        loop: { fill: '#2d1a00', stroke: '#f97316', text: '#fdba74' },
        statement: { fill: '#1a1a2e', stroke: '#3a3a55', text: '#c0caf5' }
    };

    let svg = '<g class="diagram-group">';
    const positions = [];

    // Layout: simple vertical with indent-based x offset
    let y = 20;
    nodes.forEach((node, i) => {
        const x = 40 + (node.indent || 0) * 15;
        positions.push({ x, y, w: nodeW, h: nodeH });

        const c = colors[node.type] || colors.statement;

        if (node.type === 'condition') {
            // Diamond shape
            const cx = x + nodeW / 2, cy = y + nodeH / 2;
            const dw = nodeW / 2 + 10, dh = nodeH / 2 + 5;
            svg += `<polygon class="flow-node" data-idx="${i}" points="${cx},${cy - dh} ${cx + dw},${cy} ${cx},${cy + dh} ${cx - dw},${cy}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="2" style="cursor:pointer"/>`;
            svg += `<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="${c.text}" font-size="11" font-family="JetBrains Mono" style="pointer-events:none">${escSvg(node.label)}</text>`;
        } else if (node.type === 'entry' || node.type === 'exit') {
            // Rounded rect
            svg += `<rect class="flow-node" data-idx="${i}" x="${x}" y="${y}" width="${nodeW}" height="${nodeH}" rx="20" fill="${c.fill}" stroke="${c.stroke}" stroke-width="2" style="cursor:pointer"/>`;
            // Entry/exit dot
            const dotColor = node.type === 'entry' ? '#10b981' : '#ef4444';
            svg += `<circle cx="${x + 18}" cy="${y + nodeH / 2}" r="5" fill="${dotColor}"/>`;
            svg += `<text x="${x + 30}" y="${y + nodeH / 2 + 4}" fill="${c.text}" font-size="12" font-weight="600" font-family="JetBrains Mono" style="pointer-events:none">${escSvg(node.label)}</text>`;
        } else if (node.type === 'loop') {
            // Rect with left accent
            svg += `<rect class="flow-node" data-idx="${i}" x="${x}" y="${y}" width="${nodeW}" height="${nodeH}" rx="6" fill="${c.fill}" stroke="${c.stroke}" stroke-width="2" style="cursor:pointer"/>`;
            svg += `<rect x="${x}" y="${y}" width="4" height="${nodeH}" rx="2" fill="${c.stroke}"/>`;
            svg += `<text x="${x + 14}" y="${y + nodeH / 2 + 4}" fill="${c.text}" font-size="11" font-family="JetBrains Mono" style="pointer-events:none">${escSvg(node.label)}</text>`;
            // Loop arrow indicator
            svg += `<path d="M${x + nodeW - 15},${y + 10} a6,6 0 1,1 0,${nodeH - 20}" fill="none" stroke="${c.stroke}" stroke-width="1.5" marker-end="url(#arrowLoop)"/>`;
        } else {
            // Normal rect
            svg += `<rect class="flow-node" data-idx="${i}" x="${x}" y="${y}" width="${nodeW}" height="${nodeH}" rx="6" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" style="cursor:pointer"/>`;
            svg += `<text x="${x + 12}" y="${y + nodeH / 2 + 4}" fill="${c.text}" font-size="11" font-family="JetBrains Mono" style="pointer-events:none">${escSvg(node.label)}</text>`;
        }

        y += nodeH + gapY;
    });

    // Draw connecting arrows
    for (let i = 0; i < positions.length - 1; i++) {
        const from = positions[i], to = positions[i + 1];
        const fromCx = from.x + from.w / 2;
        const toCx = to.x + to.w / 2;
        const fromBy = from.y + from.h;
        const toTy = to.y;

        if (Math.abs(fromCx - toCx) < 5) {
            svg += `<line x1="${fromCx}" y1="${fromBy}" x2="${toCx}" y2="${toTy}" stroke="#3a3a55" stroke-width="1.5" marker-end="url(#arrow)"/>`;
        } else {
            const midY = fromBy + (toTy - fromBy) / 2;
            svg += `<path d="M${fromCx},${fromBy} L${fromCx},${midY} L${toCx},${midY} L${toCx},${toTy}" fill="none" stroke="#3a3a55" stroke-width="1.5" marker-end="url(#arrow)"/>`;
        }
    }

    // Arrow markers
    svg = `<defs>
        <marker id="arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0,0 8,3 0,6" fill="#3a3a55"/></marker>
        <marker id="arrowLoop" markerWidth="6" markerHeight="5" refX="6" refY="2.5" orient="auto"><polygon points="0,0 6,2.5 0,5" fill="#f97316"/></marker>
    </defs>` + svg;

    svg += '</g>';
    diagramSvg.innerHTML = svg;
    nodeCount.textContent = `${nodes.length} nodes`;
    statusText.textContent = `Flow diagram: ${nodes.length} nodes rendered`;

    // Click handlers for nodes
    diagramSvg.querySelectorAll('.flow-node').forEach(el => {
        el.addEventListener('click', (e) => {
            const idx = parseInt(el.dataset.idx);
            const node = nodes[idx];
            showTooltip(e, `Line ${node.line}: ${node.type}`, node.fullLine);
        });
    });

    zoom = 1; panX = 0; panY = 0;
    setTimeout(fitToScreen, 100);
}

// ══════════════════════════════════════════════
// FUNCTION CALL GRAPH RENDERER
// ══════════════════════════════════════════════

function parseFunctions(code, language) {
    const lines = code.split('\n');
    const funcs = [];
    const funcNames = new Set();

    // Pass 1: Find all function definitions
    lines.forEach((line, i) => {
        const trimmed = line.trim();
        let match;

        if (language === 'python') {
            match = trimmed.match(/^def\s+(\w+)\s*\(/);
        } else if (language === 'javascript') {
            match = trimmed.match(/^(?:async\s+)?function\s+(\w+)\s*\(/) ||
                    trimmed.match(/^(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\(|function)/) ||
                    trimmed.match(/^(\w+)\s*\(.*\)\s*\{/);
        } else {
            match = trimmed.match(/^(?:void|int|char|float|double|long|short|unsigned|bool|string|auto)\s+(\w+)\s*\(/) ||
                    trimmed.match(/^(?:public|private|protected|static)\s+\w+\s+(\w+)\s*\(/);
        }

        if (match) {
            funcNames.add(match[1]);
            funcs.push({ name: match[1], line: i + 1, bodyStart: i, bodyEnd: -1, calls: [] });
        }
    });

    // Pass 2: Determine function bodies and find calls
    funcs.forEach((func, fi) => {
        // Simple heuristic: body extends until the next function def or end of file
        const nextFuncStart = fi < funcs.length - 1 ? funcs[fi + 1].bodyStart : lines.length;
        func.bodyEnd = nextFuncStart;

        for (let i = func.bodyStart + 1; i < func.bodyEnd; i++) {
            const trimmed = lines[i].trim();
            // Find function calls within this body
            funcNames.forEach(name => {
                if (name !== func.name && trimmed.includes(name + '(')) {
                    if (!func.calls.includes(name)) {
                        func.calls.push(name);
                    }
                }
            });
        }
    });

    return funcs;
}

function renderCallGraph(code, language) {
    const funcs = parseFunctions(code, language);

    if (funcs.length === 0) {
        diagramSvg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#8a8a9a" font-size="16" font-family="Inter">No functions found — define functions to see the call graph</text>';
        nodeCount.textContent = '0 functions';
        statusText.textContent = 'No functions detected';
        return;
    }

    const nodeW = 200, nodeH = 60, padX = 60, padY = 80;

    // Layout: arrange in a grid
    const cols = Math.min(funcs.length, 4);
    const positions = {};
    funcs.forEach((func, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        positions[func.name] = {
            x: padX + col * (nodeW + padX),
            y: padX + row * (nodeH + padY),
            func
        };
    });

    let svg = `<defs>
        <marker id="callArrow" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
            <polygon points="0,0 10,3.5 0,7" fill="#6366f1"/>
        </marker>
        <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
    </defs><g class="diagram-group">`;

    // Draw edges first (behind nodes)
    funcs.forEach(func => {
        if (!positions[func.name]) return;
        const from = positions[func.name];

        func.calls.forEach(callName => {
            if (!positions[callName]) return;
            const to = positions[callName];
            const fromX = from.x + nodeW / 2;
            const fromY = from.y + nodeH;
            const toX = to.x + nodeW / 2;
            const toY = to.y;

            // Curved edge
            const midY = (fromY + toY) / 2;
            svg += `<path d="M${fromX},${fromY} C${fromX},${midY} ${toX},${midY} ${toX},${toY}" fill="none" stroke="#6366f1" stroke-width="2" stroke-dasharray="6,3" marker-end="url(#callArrow)" opacity="0.7"/>`;
            // Label on edge
            const labelX = (fromX + toX) / 2;
            const labelY = midY - 5;
            svg += `<text x="${labelX}" y="${labelY}" text-anchor="middle" fill="#6366f1" font-size="9" font-family="Inter" font-weight="500" opacity="0.8">calls</text>`;
        });
    });

    // Draw nodes
    funcs.forEach((func, i) => {
        const pos = positions[func.name];
        const x = pos.x, y = pos.y;
        const isCalledByOthers = funcs.some(f => f.calls.includes(func.name));
        const callsCount = func.calls.length;
        const calledByCount = funcs.filter(f => f.calls.includes(func.name)).length;

        // Node background
        const gradient = callsCount > 0 ? '#1a1a3e' : '#1a2e1a';
        const borderColor = callsCount > 0 ? '#6366f1' : '#10b981';

        svg += `<rect class="call-node" data-name="${func.name}" x="${x}" y="${y}" width="${nodeW}" height="${nodeH}" rx="12" fill="${gradient}" stroke="${borderColor}" stroke-width="2" style="cursor:pointer" filter="url(#glow)"/>`;

        // Function name
        svg += `<text x="${x + nodeW / 2}" y="${y + 24}" text-anchor="middle" fill="#e8e8f0" font-size="13" font-weight="600" font-family="JetBrains Mono" style="pointer-events:none">${escSvg(func.name)}()</text>`;

        // Stats line
        svg += `<text x="${x + nodeW / 2}" y="${y + 44}" text-anchor="middle" fill="#8a8a9a" font-size="10" font-family="Inter" style="pointer-events:none">Line ${func.line} · ${callsCount} out · ${calledByCount} in</text>`;

        // Entry point indicator (functions that are not called by anyone)
        if (!isCalledByOthers) {
            svg += `<circle cx="${x + 16}" cy="${y + 16}" r="5" fill="#10b981"/>`;
            svg += `<text x="${x + 16}" y="${y + 19}" text-anchor="middle" fill="#0d3320" font-size="7" font-weight="700" style="pointer-events:none">E</text>`;
        }
    });

    svg += '</g>';
    diagramSvg.innerHTML = svg;
    nodeCount.textContent = `${funcs.length} functions`;
    statusText.textContent = `Call graph: ${funcs.length} functions, ${funcs.reduce((s, f) => s + f.calls.length, 0)} call edges`;

    // Click handlers
    diagramSvg.querySelectorAll('.call-node').forEach(el => {
        el.addEventListener('click', (e) => {
            const name = el.dataset.name;
            const func = funcs.find(f => f.name === name);
            if (func) {
                const callsStr = func.calls.length ? `Calls: ${func.calls.join(', ')}` : 'No outgoing calls';
                const calledBy = funcs.filter(f => f.calls.includes(name)).map(f => f.name);
                const calledByStr = calledBy.length ? `Called by: ${calledBy.join(', ')}` : 'Not called by any function (entry point)';
                showTooltip(e, `${name}() — Line ${func.line}`, `${callsStr}\n${calledByStr}`);
            }
        });
    });

    zoom = 1; panX = 0; panY = 0;
    setTimeout(fitToScreen, 100);
}

// ── Tooltip ──
function showTooltip(event, title, code) {
    tooltipTitle.textContent = title;
    tooltipCode.textContent = code;
    nodeTooltip.style.display = 'block';
    const rect = diagramCanvas.getBoundingClientRect();
    nodeTooltip.style.left = (event.clientX - rect.left + 10) + 'px';
    nodeTooltip.style.top = (event.clientY - rect.top - 10) + 'px';
}

diagramCanvas.addEventListener('click', (e) => {
    if (!e.target.closest('.flow-node, .call-node')) {
        nodeTooltip.style.display = 'none';
    }
});

function escSvg(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
