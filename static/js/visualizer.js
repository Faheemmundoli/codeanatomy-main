// ============================================================
// Code Anatomy — Line-by-Line Visualizer JS
// Parses code and steps through it line by line with variable tracking
// ============================================================

const codeInput = document.getElementById('codeInput');
const loadBtn = document.getElementById('loadBtn');
const languageSelect = document.getElementById('languageSelect');
const statusText = document.getElementById('statusText');
const languageStatus = document.getElementById('languageStatus');
const inputArea = document.getElementById('inputArea');
const vizArea = document.getElementById('vizArea');
const codeLines = document.getElementById('codeLines');
const currentLineCode = document.getElementById('currentLineCode');
const lineClassification = document.getElementById('lineClassification');
const varTable = document.getElementById('varTable');
const scopeStack = document.getElementById('scopeStack');
const progressFill = document.getElementById('progressFill');
const lineCounter = document.getElementById('lineCounter');
const vizLang = document.getElementById('vizLang');

const playBtn = document.getElementById('playBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const resetBtn = document.getElementById('resetBtn');
const endBtn = document.getElementById('endBtn');
const editBtn = document.getElementById('editBtn');
const speedSlider = document.getElementById('speedSlider');

let lines = [];
let currentLine = -1;
let isPlaying = false;
let playInterval = null;
let variables = {};
let scopes = ['global'];
let lang = '';

// ── Language Select ──
languageSelect.addEventListener('change', () => {
    lang = languageSelect.value;
    if (lang) {
        languageStatus.textContent = lang.toUpperCase();
        codeInput.placeholder = `// Paste your ${lang.toUpperCase()} code here...`;
        statusText.textContent = `${lang.toUpperCase()} selected — paste code and click Load`;
    } else {
        languageStatus.textContent = 'No language selected';
    }
    checkInputs();
});

function checkInputs() {
    loadBtn.disabled = !(languageSelect.value && codeInput.value.trim());
}

codeInput.addEventListener('input', checkInputs);

// ── Load Code ──
loadBtn.addEventListener('click', () => {
    const code = codeInput.value.trim();
    if (!code || !languageSelect.value) return;

    lang = languageSelect.value;
    lines = code.split('\n');
    currentLine = -1;
    variables = {};
    scopes = ['global'];
    isPlaying = false;

    // Build line elements
    codeLines.innerHTML = '';
    lines.forEach((line, i) => {
        const lineEl = document.createElement('div');
        lineEl.className = 'viz-line';
        lineEl.dataset.index = i;

        const numEl = document.createElement('span');
        numEl.className = 'viz-line-num';
        numEl.textContent = i + 1;

        const contentEl = document.createElement('span');
        contentEl.className = 'viz-line-content';

        // Use highlight.js for syntax coloring
        const tempCode = document.createElement('code');
        tempCode.className = `language-${lang}`;
        tempCode.textContent = line || ' ';
        hljs.highlightElement(tempCode);
        contentEl.innerHTML = tempCode.innerHTML;

        const tagEl = document.createElement('span');
        tagEl.className = 'viz-line-tag';
        tagEl.textContent = classifyLine(line, lang).short;

        lineEl.appendChild(numEl);
        lineEl.appendChild(contentEl);
        lineEl.appendChild(tagEl);

        lineEl.addEventListener('click', () => {
            goToLine(i);
        });

        codeLines.appendChild(lineEl);
    });

    inputArea.style.display = 'none';
    vizArea.style.display = 'flex';
    vizLang.textContent = lang.toUpperCase();
    updateUI();
    statusText.textContent = `Loaded ${lines.length} lines — use controls to step through`;
});

// ── Line Classification ──
function classifyLine(line, language) {
    const trimmed = line.trim();
    if (!trimmed) return { short: 'blank', full: 'Empty Line', color: '#565f89' };

    // Comments
    if (language === 'python' && trimmed.startsWith('#'))
        return { short: 'comment', full: 'Comment', color: '#565f89' };
    if ((language === 'c' || language === 'javascript' || language === 'java') && (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')))
        return { short: 'comment', full: 'Comment', color: '#565f89' };

    // Imports
    if (trimmed.startsWith('import ') || trimmed.startsWith('from ') || trimmed.startsWith('#include'))
        return { short: 'import', full: 'Import / Include', color: '#bb9af7' };

    // Function definitions
    if (/^(def |function |async function |void |int |char |float |double |public |private |static )/.test(trimmed) && trimmed.includes('('))
        return { short: 'func-def', full: 'Function Definition', color: '#7aa2f7' };
    if (/^(class )/.test(trimmed))
        return { short: 'class-def', full: 'Class Definition', color: '#7dcfff' };

    // Return
    if (/^return\b/.test(trimmed))
        return { short: 'return', full: 'Return Statement', color: '#f7768e' };

    // Conditionals
    if (/^(if |elif |else if |else\b|else:)/.test(trimmed))
        return { short: 'condition', full: 'Conditional Branch', color: '#e0af68' };
    if (/^(switch |case |default:)/.test(trimmed))
        return { short: 'switch', full: 'Switch / Case', color: '#e0af68' };

    // Loops
    if (/^(for |while |do\b)/.test(trimmed))
        return { short: 'loop', full: 'Loop', color: '#ff9e64' };

    // Variable assignment
    if (/^(let |var |const |self\.)/.test(trimmed) || /^[a-zA-Z_]\w*\s*=\s/.test(trimmed))
        return { short: 'assign', full: 'Variable Assignment', color: '#9ece6a' };

    // Function call
    if (/^[a-zA-Z_]\w*(\.\w+)*\s*\(/.test(trimmed) || /^\s*(print|console|System|printf|scanf)\s*\(/.test(trimmed))
        return { short: 'call', full: 'Function Call', color: '#2ac3de' };

    // Brackets
    if (trimmed === '{' || trimmed === '}' || trimmed === '},' || trimmed === '};')
        return { short: 'block', full: 'Block Delimiter', color: '#565f89' };

    // Try-catch
    if (/^(try|catch|except|finally|throw|raise)/.test(trimmed))
        return { short: 'error-h', full: 'Error Handling', color: '#f7768e' };

    return { short: 'stmt', full: 'Statement', color: '#c0caf5' };
}

// ── Variable Tracking ──
function trackVariables(line) {
    const trimmed = line.trim();

    // Python: x = value
    let match = trimmed.match(/^([a-zA-Z_]\w*)\s*=\s*(.+)$/);
    if (match && !trimmed.startsWith('if ') && !trimmed.startsWith('return ') && match[1] !== 'def' && match[1] !== 'class') {
        const name = match[1];
        let value = match[2].trim();
        // Try to evaluate simple values
        if (value === 'True' || value === 'true') value = 'true';
        else if (value === 'False' || value === 'false') value = 'false';
        else if (value === 'None' || value === 'null' || value === 'nullptr') value = 'null';
        variables[name] = { value, line: currentLine + 1, scope: scopes[scopes.length - 1] };
    }

    // JS/Java: let/var/const x = value
    match = trimmed.match(/^(?:let|var|const|int|float|double|char|String|boolean)\s+([a-zA-Z_]\w*)\s*=\s*(.+?);?\s*$/);
    if (match) {
        variables[match[1]] = { value: match[2].replace(/;$/, ''), line: currentLine + 1, scope: scopes[scopes.length - 1] };
    }

    // Augmented assignment: x += value, x -= value, etc.
    match = trimmed.match(/^([a-zA-Z_]\w*)\s*([+\-*\/])=\s*(.+?);?\s*$/);
    if (match && variables[match[1]]) {
        const prev = variables[match[1]].value;
        variables[match[1]] = { value: `${prev} ${match[2]} ${match[3].replace(/;$/, '')}`, line: currentLine + 1, scope: scopes[scopes.length - 1] };
    }
}

// ── Scope Tracking ──
function trackScope(line) {
    const trimmed = line.trim();
    if (/^(def |class |function |async function )/.test(trimmed)) {
        const name = trimmed.match(/(?:def|class|function|async function)\s+(\w+)/);
        scopes.push(name ? name[1] + '()' : 'block');
    } else if (/^(for |while |if |elif |else)/.test(trimmed)) {
        scopes.push(trimmed.split(/[\s(:]/)[0]);
    }

    if (trimmed === '}' || trimmed === '};' || trimmed === '},') {
        if (scopes.length > 1) scopes.pop();
    }
}

// ── Navigation ──
function goToLine(index) {
    if (index < -1 || index >= lines.length) return;

    // Process all lines up to the target to build state
    if (index < currentLine) {
        variables = {};
        scopes = ['global'];
        currentLine = -1;
        for (let i = 0; i <= index; i++) {
            currentLine = i;
            trackScope(lines[i]);
            trackVariables(lines[i]);
        }
    } else {
        for (let i = currentLine + 1; i <= index; i++) {
            currentLine = i;
            trackScope(lines[i]);
            trackVariables(lines[i]);
        }
    }

    currentLine = index;
    updateUI();
}

function stepForward() {
    if (currentLine < lines.length - 1) {
        currentLine++;
        trackScope(lines[currentLine]);
        trackVariables(lines[currentLine]);
        updateUI();
    } else {
        stopPlaying();
    }
}

function stepBackward() {
    if (currentLine > 0) {
        goToLine(currentLine - 1);
    } else if (currentLine === 0) {
        currentLine = -1;
        variables = {};
        scopes = ['global'];
        updateUI();
    }
}

function reset() {
    stopPlaying();
    currentLine = -1;
    variables = {};
    scopes = ['global'];
    updateUI();
}

function goToEnd() {
    stopPlaying();
    goToLine(lines.length - 1);
}

// ── Playback ──
function getSpeed() {
    const speeds = [1500, 1000, 600, 350, 150];
    return speeds[speedSlider.value - 1] || 600;
}

function startPlaying() {
    if (currentLine >= lines.length - 1) reset();
    isPlaying = true;
    playBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    playInterval = setInterval(() => {
        if (currentLine >= lines.length - 1) {
            stopPlaying();
            return;
        }
        stepForward();
    }, getSpeed());
}

function stopPlaying() {
    isPlaying = false;
    playBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
    clearInterval(playInterval);
}

speedSlider.addEventListener('input', () => {
    if (isPlaying) {
        clearInterval(playInterval);
        playInterval = setInterval(() => {
            if (currentLine >= lines.length - 1) { stopPlaying(); return; }
            stepForward();
        }, getSpeed());
    }
});

playBtn.addEventListener('click', () => isPlaying ? stopPlaying() : startPlaying());
nextBtn.addEventListener('click', stepForward);
prevBtn.addEventListener('click', stepBackward);
resetBtn.addEventListener('click', reset);
endBtn.addEventListener('click', goToEnd);
editBtn.addEventListener('click', () => {
    stopPlaying();
    vizArea.style.display = 'none';
    inputArea.style.display = 'flex';
    statusText.textContent = 'Ready — edit your code and click Load';
});

// ── Update UI ──
function updateUI() {
    // Line counter & progress
    lineCounter.textContent = `Line ${currentLine + 1} / ${lines.length}`;
    progressFill.style.width = lines.length ? `${((currentLine + 1) / lines.length) * 100}%` : '0%';

    // Highlight current line in code panel
    const allLines = codeLines.querySelectorAll('.viz-line');
    allLines.forEach((el, i) => {
        el.classList.remove('viz-line-active', 'viz-line-past');
        if (i === currentLine) {
            el.classList.add('viz-line-active');
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (i < currentLine) {
            el.classList.add('viz-line-past');
        }
    });

    // Current line info
    if (currentLine >= 0 && currentLine < lines.length) {
        const line = lines[currentLine];
        currentLineCode.textContent = line || '(empty line)';
        const cls = classifyLine(line, lang);
        lineClassification.innerHTML = `<span class="viz-tag" style="background:${cls.color}22;color:${cls.color};border:1px solid ${cls.color}44">${cls.full}</span>`;
    } else {
        currentLineCode.textContent = '—';
        lineClassification.innerHTML = '<span class="viz-tag">—</span>';
    }

    // Variables
    const vKeys = Object.keys(variables);
    if (vKeys.length > 0) {
        let html = '<table class="viz-var-tbl"><thead><tr><th>Name</th><th>Value</th><th>Line</th><th>Scope</th></tr></thead><tbody>';
        vKeys.forEach(k => {
            const v = variables[k];
            html += `<tr><td class="var-name">${k}</td><td class="var-value">${escapeHtml(v.value)}</td><td class="var-line">${v.line}</td><td class="var-scope">${v.scope}</td></tr>`;
        });
        html += '</tbody></table>';
        varTable.innerHTML = html;
    } else {
        varTable.innerHTML = '<div class="viz-var-empty">No variables tracked yet</div>';
    }

    // Scopes
    scopeStack.innerHTML = scopes.map(s => `<span class="viz-scope-item">${s}</span>`).join('<span class="viz-scope-arrow">→</span>');
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
