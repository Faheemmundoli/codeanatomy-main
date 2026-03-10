// ============================================================
// Code Anatomy — Comment Annotator (Editor Tab) JS
// Static version — calls Groq API directly from browser
// ============================================================

const languageSelect = document.getElementById('languageSelect');
const codeInput = document.getElementById('codeInput');
const codeOutput = document.getElementById('codeOutput');
const processBtn = document.getElementById('processBtn');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const statusText = document.getElementById('statusText');
const languageStatus = document.getElementById('languageStatus');
const lineCount = document.getElementById('lineCount');
const lineNumbers1 = document.getElementById('lineNumbers1');
const lineNumbers2 = document.getElementById('lineNumbers2');
const codeHighlight1 = document.getElementById('codeHighlight1');
const codeHighlight2 = document.getElementById('codeHighlight2');
const apiKeyBtn = document.getElementById('apiKeyBtn');
const apiKeyModal = document.getElementById('apiKeyModal');
const apiKeyInput = document.getElementById('apiKeyInput');
const modalCancel = document.getElementById('modalCancel');
const modalSave = document.getElementById('modalSave');
const apiKeyStatus = document.getElementById('apiKeyStatus');

const MAX_FILE_SIZE = 500000;
const langMap = { python: 'python', c: 'c', javascript: 'javascript', java: 'java' };

// Get mode from URL
const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get('mode') || 'add';

// Update UI based on mode
if (mode === 'remove') {
    processBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M4 10H16M16 10L11 5M16 10L11 15" stroke="currentColor" stroke-width="1.5"/>
        </svg>
        Remove Comments
    `;
    document.getElementById('modeLabel').textContent = 'COMMENT REMOVER';
}

// ── API Key Management ──
function getApiKey() {
    return localStorage.getItem('codeanatomy_groq_key') || '';
}

function updateApiKeyUI() {
    const key = getApiKey();
    if (key) {
        apiKeyStatus.textContent = 'Key Set ✓';
        apiKeyStatus.style.color = '#10b981';
    } else {
        apiKeyStatus.textContent = 'No API Key';
        apiKeyStatus.style.color = '';
    }
}

apiKeyBtn.addEventListener('click', () => {
    apiKeyInput.value = getApiKey();
    apiKeyModal.style.display = 'flex';
    apiKeyInput.focus();
});

modalCancel.addEventListener('click', () => {
    apiKeyModal.style.display = 'none';
});

modalSave.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
        localStorage.setItem('codeanatomy_groq_key', key);
        statusText.textContent = 'API key saved';
    } else {
        localStorage.removeItem('codeanatomy_groq_key');
        statusText.textContent = 'API key removed';
    }
    updateApiKeyUI();
    apiKeyModal.style.display = 'none';
});

apiKeyModal.addEventListener('click', (e) => {
    if (e.target === apiKeyModal) apiKeyModal.style.display = 'none';
});

updateApiKeyUI();

// ── Error Toast ──
function showError(message) {
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ── Syntax Highlighting ──
function highlightCode(code, lang, targetElement) {
    if (!code) { targetElement.innerHTML = '<code></code>'; return; }
    const codeElement = targetElement.querySelector('code');
    codeElement.textContent = code;
    codeElement.className = `language-${lang}`;
    delete codeElement.dataset.highlighted;
    hljs.highlightElement(codeElement);
}

// ── Line Numbers ──
function updateLineNumbers(textarea, lineNumbersDiv) {
    const lines = textarea.value.split('\n').length;
    if (lines > 5000) { lineNumbersDiv.textContent = '...'; return; }
    let numbers = '';
    for (let i = 1; i <= lines; i++) numbers += i + '\n';
    lineNumbersDiv.textContent = numbers;
    lineNumbersDiv.scrollTop = textarea.scrollTop;
}

// ── Cursor Position ──
function updateCursorPosition() {
    try {
        const pos = codeInput.selectionStart;
        const textBefore = codeInput.value.substring(0, pos);
        const line = textBefore.split('\n').length;
        const col = textBefore.split('\n').pop().length + 1;
        lineCount.textContent = `Ln ${line}, Col ${col}`;
    } catch (e) {
        lineCount.textContent = 'Ln 1, Col 1';
    }
}

// ── Language Select ──
languageSelect.addEventListener('change', () => {
    const lang = languageSelect.value;
    if (lang) {
        languageStatus.textContent = lang.toUpperCase();
        codeInput.placeholder = `// Paste your ${lang.toUpperCase()} code here...`;
        statusText.textContent = `${lang.toUpperCase()} selected`;
        codeInput.disabled = false;
        codeInput.focus();
        if (codeInput.value) highlightCode(codeInput.value, langMap[lang], codeHighlight1);
    } else {
        languageStatus.textContent = 'No language selected';
        codeInput.placeholder = '// Select a language first...';
        statusText.textContent = 'Select a language';
        codeInput.disabled = true;
        codeHighlight1.innerHTML = '<code></code>';
    }
    checkInputs();
});

function checkInputs() {
    processBtn.disabled = !(languageSelect.value && codeInput.value.trim());
}

// ── Code Input ──
let inputTimeout;
codeInput.addEventListener('input', () => {
    const code = codeInput.value;
    if (code.length > MAX_FILE_SIZE) { showError(`File too large! Maximum ${MAX_FILE_SIZE / 1000}KB allowed.`); return; }
    clearTimeout(inputTimeout);
    inputTimeout = setTimeout(() => {
        updateLineNumbers(codeInput, lineNumbers1);
        updateCursorPosition();
        checkInputs();
        statusText.textContent = 'Modified';
        const lang = languageSelect.value;
        if (lang) highlightCode(code, langMap[lang], codeHighlight1);
    }, 150);
});

// ── Scroll sync ──
codeInput.addEventListener('scroll', () => {
    lineNumbers1.scrollTop = codeInput.scrollTop;
    codeHighlight1.scrollTop = codeInput.scrollTop;
    codeHighlight1.scrollLeft = codeInput.scrollLeft;
});

codeOutput.addEventListener('scroll', () => {
    lineNumbers2.scrollTop = codeOutput.scrollTop;
    codeHighlight2.scrollTop = codeOutput.scrollTop;
    codeHighlight2.scrollLeft = codeOutput.scrollLeft;
});

codeInput.addEventListener('click', updateCursorPosition);
codeInput.addEventListener('keyup', (e) => {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(e.key)) updateCursorPosition();
});

// ── Tab / Enter / Backspace ──
codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        const start = codeInput.selectionStart, end = codeInput.selectionEnd;
        codeInput.value = codeInput.value.substring(0, start) + '    ' + codeInput.value.substring(end);
        codeInput.selectionStart = codeInput.selectionEnd = start + 4;
        codeInput.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (e.key === 'Enter') {
        e.preventDefault();
        const start = codeInput.selectionStart;
        const lines = codeInput.value.substring(0, start).split('\n');
        const currentLine = lines[lines.length - 1];
        const indent = currentLine.match(/^\s*/)[0];
        const extra = /[{([\]]\s*$/.test(currentLine) ? '    ' : '';
        const newText = '\n' + indent + extra;
        codeInput.value = codeInput.value.substring(0, start) + newText + codeInput.value.substring(start);
        codeInput.selectionStart = codeInput.selectionEnd = start + newText.length;
        codeInput.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (e.key === 'Backspace') {
        const start = codeInput.selectionStart, end = codeInput.selectionEnd;
        if (start === end) {
            const before = codeInput.value.substring(0, start);
            if (/    $/.test(before)) {
                e.preventDefault();
                codeInput.value = before.slice(0, -4) + codeInput.value.substring(start);
                codeInput.selectionStart = codeInput.selectionEnd = start - 4;
                codeInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    }
});

function updateOutputHighlight() {
    updateLineNumbers(codeOutput, lineNumbers2);
    const lang = languageSelect.value;
    if (lang && codeOutput.value) highlightCode(codeOutput.value, langMap[lang], codeHighlight2);
}

// ── Clear ──
clearBtn.addEventListener('click', () => {
    codeInput.value = ''; codeOutput.value = '';
    lineNumbers1.textContent = '1'; lineNumbers2.textContent = '1';
    codeHighlight1.innerHTML = '<code></code>'; codeHighlight2.innerHTML = '<code></code>';
    statusText.textContent = 'Cleared';
    checkInputs();
});

// ── Copy ──
copyBtn.addEventListener('click', async () => {
    if (codeOutput.value) {
        await navigator.clipboard.writeText(codeOutput.value);
        statusText.textContent = 'Copied to clipboard';
        copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8L6 11L13 4" stroke="currentColor" stroke-width="1.5"/></svg>';
        setTimeout(() => {
            copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M3 11V3C3 2.44772 3.44772 2 4 2H10" stroke="currentColor" stroke-width="1.5"/></svg>';
            statusText.textContent = 'Ready';
        }, 2000);
    }
});

// ── Hardcoded comment removal ──
function removeCommentsLogic(code, language) {
    const lines = code.split('\n');
    const result = [];
    if (language === 'python') {
        let inMulti = false;
        for (let line of lines) {
            const stripped = line.trimStart();
            if (line.includes('"""') || line.includes("'''")) {
                const q = line.includes('"""') ? '"""' : "'''";
                const count = line.split(q).length - 1;
                if (count === 2) continue;
                if (count === 1) { inMulti = !inMulti; continue; }
            }
            if (inMulti) continue;
            if (stripped.startsWith('#')) continue;
            if (line.includes('#')) {
                let inStr = false, qChar = null, nl = [];
                for (let i = 0; i < line.length; i++) {
                    const c = line[i];
                    if ((c === '"' || c === "'") && (i === 0 || line[i-1] !== '\\')) {
                        if (!inStr) { inStr = true; qChar = c; }
                        else if (c === qChar) { inStr = false; qChar = null; }
                    }
                    if (c === '#' && !inStr) break;
                    nl.push(c);
                }
                line = nl.join('').trimEnd();
            }
            if (line.trim()) result.push(line);
        }
    } else {
        let inMulti = false;
        for (let line of lines) {
            if (line.includes('/*') && line.includes('*/')) {
                line = line.split('/*')[0] + line.split('*/').pop();
            } else if (line.includes('/*')) {
                inMulti = true; line = line.split('/*')[0];
            } else if (line.includes('*/')) {
                inMulti = false; line = line.split('*/').pop();
            } else if (inMulti) continue;
            if (line.includes('//')) {
                let inStr = false, nl = [];
                for (let i = 0; i < line.length; i++) {
                    if (line[i] === '"' && (i === 0 || line[i-1] !== '\\')) inStr = !inStr;
                    if (i < line.length - 1 && line[i] === '/' && line[i+1] === '/' && !inStr) break;
                    nl.push(line[i]);
                }
                line = nl.join('').trimEnd();
            }
            if (line.trim()) result.push(line);
        }
    }
    return result.join('\n');
}

// ── Process Code ──
processBtn.addEventListener('click', async () => {
    const code = codeInput.value.trim();
    const language = languageSelect.value;
    if (!code || !language) return;
    if (code.length > MAX_FILE_SIZE) { showError(`File too large!`); return; }

    if (mode === 'remove') {
        // Local removal — no API needed
        processBtn.disabled = true;
        processBtn.classList.add('loading');
        statusText.textContent = 'Removing comments...';
        codeOutput.value = '';
        codeHighlight2.innerHTML = '<code></code>';
        setTimeout(() => {
            codeOutput.value = removeCommentsLogic(code, language);
            updateOutputHighlight();
            statusText.textContent = 'Comments removed';
            processBtn.classList.remove('loading');
            checkInputs();
        }, 300);
        return;
    }

    // Add comments — needs API key
    const apiKey = getApiKey();
    if (!apiKey) {
        showError('Please set your Groq API key first (click the 🔑 button)');
        apiKeyModal.style.display = 'flex';
        apiKeyInput.focus();
        return;
    }

    // Detect existing comments
    const commentLines = language === 'python'
        ? (code.match(/^\s*#/gm) || []).length
        : (code.match(/\/\/|^\/\*|\*\//gm) || []).length;
    const totalLines = code.split('\n').length;
    if (commentLines / totalLines > 0.2) {
        if (!confirm('This code already has comments. Add more?')) return;
    }

    processBtn.disabled = true;
    processBtn.classList.add('loading');
    statusText.textContent = 'Processing with AI...';
    codeOutput.value = '';
    codeHighlight2.innerHTML = '<code></code>';

    const hasComments = commentLines / totalLines > 0.05;
    const prompt = hasComments
        ? `Add intelligent comments to this ${language} code where explanations are missing.\n\nRULES:\n1. Add comments for ALL functions, classes, methods, and complex logic\n2. Explain algorithm logic, data transformations, and business rules\n3. Do NOT duplicate existing comments\n4. Keep comments concise and meaningful\n5. Return ONLY the code with comments, no explanations\n\nCode:\n${code}`
        : `Add comprehensive, intelligent comments to this ${language} code.\n\nRULES:\n1. Add comments for EVERY function, class, method explaining purpose, parameters, and return values\n2. Explain ALL algorithm logic, loops, conditionals, and data transformations\n3. Do NOT comment simple variable declarations or obvious operations\n4. Return ONLY the code with comments, no markdown, no explanations\n\nCode:\n${code}`;

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                messages: [{ role: 'user', content: prompt }],
                model: 'llama-3.3-70b-versatile',
                temperature: 0.3,
                max_tokens: 4000
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || `API error ${response.status}`);
        }

        const data = await response.json();
        let result = data.choices[0].message.content.trim();
        if (result.startsWith('```')) {
            const lines = result.split('\n');
            result = lines.slice(1, -1).join('\n');
        }
        codeOutput.value = result;
        updateOutputHighlight();
        statusText.textContent = 'Comments added successfully';
    } catch (error) {
        showError(error.message);
        statusText.textContent = 'Error';
    } finally {
        processBtn.classList.remove('loading');
        checkInputs();
    }
});

// ── Init ──
codeInput.disabled = true;
lineNumbers1.textContent = '1';
lineNumbers2.textContent = '1';
codeHighlight1.innerHTML = '<code></code>';
codeHighlight2.innerHTML = '<code></code>';
