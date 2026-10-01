/**
 * BELBEAUTY — CHAT.JS
 * @owner Progress Tech — Bamenda, Cameroon
 * Same network contract as before: PHP proxy (currently off, see ApiEngine) ->
 * direct Omegatech call -> fallback chain across core models. Only the UI
 * layer and the model registry it reads from have changed.
 */

'use strict';

// ==================== DOM ====================
const els = {
  chatBox: document.getElementById('chatBox'),
  chatScroll: document.getElementById('chatScroll'),
  userInput: document.getElementById('userInput'),
  sendBtn: document.getElementById('sendBtn'),
  typing: document.getElementById('typing'),
  typingText: document.getElementById('typingText'),
  sidebarModels: document.getElementById('sidebarModels'),
  topbarAvatar: document.getElementById('topbarAvatar'),
  topbarName: document.getElementById('topbarName'),
  themeToggle: document.getElementById('themeToggle'),
  sidebar: document.getElementById('sidebar'),
  sidebarScrim: document.getElementById('sidebarScrim'),
  mobileMenuBtn: document.getElementById('mobileMenuBtn'),
  newChatBtn: document.getElementById('newChatBtn'),
  clearChatBtn: document.getElementById('clearChatBtn'),
  exportChatBtn: document.getElementById('exportChatBtn'),
  exploreBtn: document.getElementById('exploreModelsBtn'),
  explorerOverlay: document.getElementById('explorerOverlay'),
  explorerBody: document.getElementById('explorerBody'),
  closeExplorer: document.getElementById('closeExplorer'),
  settingsBtn: document.getElementById('settingsBtn'),
  settingsOverlay: document.getElementById('settingsOverlay'),
  closeSettings: document.getElementById('closeSettings'),
  themeSwitch: document.getElementById('themeSwitch'),
  settingsModelName: document.getElementById('settingsModelName'),
  clearDataBtn: document.getElementById('clearDataBtn'),
  sessionDisplay: document.getElementById('sessionDisplay')
};

// ==================== STATE ====================
const { key: currentModelKey, config: currentModel } = getCurrentModelConfig();
let sessionId = localStorage.getItem(`session_${currentModelKey}`) ||
  `belbeauty_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
localStorage.setItem(`session_${currentModelKey}`, sessionId);

let isGenerating = false;
let chatHistory = [];
try { chatHistory = JSON.parse(localStorage.getItem(`chat_history_${currentModelKey}`) || '[]'); }
catch (e) { chatHistory = []; }
let lastUserMessage = '';

// ==================== THEME (dark / light / system, shared key with landing) ====================
class ChatTheme {
  constructor() {
    this.stored = localStorage.getItem(BELBEAUTY_STORAGE_KEYS.THEME);
    this.init();
  }
  systemPref() { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
  effective() { return this.stored || this.systemPref(); }
  init() {
    this.apply(this.effective());
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (!this.stored) this.apply(this.systemPref());
    });
    if (els.themeToggle) els.themeToggle.addEventListener('click', () => this.toggle());
    this.syncSwitch();
  }
  apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (els.themeToggle) els.themeToggle.textContent = theme === 'dark' ? '🌙' : '☀️';
  }
  set(mode) {
    // mode: 'light' | 'dark' | 'system'
    this.stored = mode === 'system' ? null : mode;
    if (this.stored) localStorage.setItem(BELBEAUTY_STORAGE_KEYS.THEME, this.stored);
    else localStorage.removeItem(BELBEAUTY_STORAGE_KEYS.THEME);
    this.apply(this.effective());
    this.syncSwitch();
  }
  toggle() { this.set(this.effective() === 'dark' ? 'light' : 'dark'); }
  syncSwitch() {
    if (!els.themeSwitch) return;
    const mode = this.stored || 'system';
    els.themeSwitch.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.theme === mode));
  }
}
const chatTheme = new ChatTheme();
if (els.themeSwitch) {
  els.themeSwitch.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-theme]');
    if (btn) chatTheme.set(btn.dataset.theme);
  });
}

// ==================== SIDEBAR + MODEL SWITCHER ====================
function switchModel(key) {
  if (key === currentModelKey) { closeModal(els.explorerOverlay); return; }
  localStorage.setItem(BELBEAUTY_STORAGE_KEYS.MODEL, key);
  window.location.href = `chat.html?model=${key}`;
}

function renderSidebar() {
  if (!els.sidebarModels) return;
  els.sidebarModels.innerHTML = CORE_MODEL_KEYS.map(k => {
    const cfg = BELBEAUTY_MODELS[k];
    if (!cfg) return '';
    return `
      <button class="model-item${k === currentModelKey ? ' active' : ''}" data-model="${k}" type="button">
        <span class="model-item__icon">${cfg.avatar}</span>
        <span class="model-item__body">
          <span class="model-item__name">${cfg.name}</span>
          <span class="model-item__desc">${cfg.description || ''}</span>
        </span>
      </button>`;
  }).join('');
  els.sidebarModels.querySelectorAll('.model-item').forEach(btn => {
    btn.addEventListener('click', () => switchModel(btn.dataset.model));
  });
}

function renderExplorer() {
  if (!els.explorerBody) return;
  const groups = ModelManager.getGroups();
  els.explorerBody.innerHTML = groups.map(g => `
    <div class="model-group">
      <div class="model-group__label">${g.meta.icon} ${g.meta.label}</div>
      <div class="model-group__grid">
        ${g.keys.map(k => {
          const cfg = BELBEAUTY_MODELS[k];
          return `
            <button class="model-option${k === currentModelKey ? ' active' : ''}" data-model="${k}" type="button">
              <span class="model-option__icon">${cfg.avatar}</span>
              <span>
                <span class="model-option__name">${cfg.name}</span><br>
                <span class="model-option__desc">${(cfg.description || cfg.capabilities.join(', '))}</span>
              </span>
            </button>`;
        }).join('')}
      </div>
    </div>`).join('');
  els.explorerBody.querySelectorAll('.model-option').forEach(btn => {
    btn.addEventListener('click', () => switchModel(btn.dataset.model));
  });
}

function updateTopbar() {
  if (els.topbarAvatar) els.topbarAvatar.textContent = currentModel.avatar;
  if (els.topbarName) els.topbarName.textContent = currentModel.name;
  if (els.settingsModelName) els.settingsModelName.textContent = `${currentModel.avatar} ${currentModel.name}`;
  document.title = `${currentModel.name} — Belbeauty Chat`;
}

renderSidebar();
renderExplorer();
updateTopbar();
if (els.sessionDisplay) els.sessionDisplay.textContent = sessionId.slice(0, 14) + '…';

// ==================== MODALS ====================
function openModal(overlay) {
  if (!overlay) return;
  overlay.classList.add('show');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  const focusable = overlay.querySelector('button, [href], input, textarea');
  if (focusable) focusable.focus();
}
function closeModal(overlay) {
  if (!overlay) return;
  overlay.classList.remove('show');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(overlay); });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.show').forEach(closeModal);
});
if (els.exploreBtn) els.exploreBtn.addEventListener('click', () => openModal(els.explorerOverlay));
if (els.closeExplorer) els.closeExplorer.addEventListener('click', () => closeModal(els.explorerOverlay));
if (els.settingsBtn) els.settingsBtn.addEventListener('click', () => openModal(els.settingsOverlay));
if (els.closeSettings) els.closeSettings.addEventListener('click', () => closeModal(els.settingsOverlay));

// ==================== MOBILE SIDEBAR ====================
function toggleSidebar(open) {
  if (!els.sidebar) return;
  const willOpen = open ?? !els.sidebar.classList.contains('open');
  els.sidebar.classList.toggle('open', willOpen);
  els.sidebarScrim?.classList.toggle('show', willOpen);
}
if (els.mobileMenuBtn) els.mobileMenuBtn.addEventListener('click', () => toggleSidebar());
if (els.sidebarScrim) els.sidebarScrim.addEventListener('click', () => toggleSidebar(false));

// ==================== MESSAGE ENGINE ====================
class MessageEngine {
  static add(text, who = 'bot', opts = {}) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `msg msg--${who}${opts.error ? ' msg--error' : ''}`;

    const avatar = document.createElement('div');
    avatar.className = 'msg__avatar';
    avatar.textContent = who === 'bot' ? currentModel.avatar : (who === 'user' ? '🧑' : 'ℹ️');

    const bubble = document.createElement('div');
    bubble.className = 'msg__bubble';

    if (who === 'bot' && this.containsCode(text)) {
      bubble.innerHTML = this.formatWithCodeBlocks(text);
      setTimeout(() => this.attachCodeHandlers(bubble), 30);
    } else if (who === 'bot' && this.containsImage(text)) {
      bubble.innerHTML = this.formatWithImages(text);
    } else {
      bubble.textContent = text;
    }

    if (who !== 'system') { msgDiv.appendChild(avatar); msgDiv.appendChild(bubble); }
    else { msgDiv.appendChild(bubble); }

    if (opts.retry) {
      const retryBtn = document.createElement('button');
      retryBtn.className = 'code-btn';
      retryBtn.style.marginTop = '10px';
      retryBtn.textContent = '↻ Retry';
      retryBtn.type = 'button';
      retryBtn.addEventListener('click', () => { retryBtn.remove(); sendMessage(opts.retry); });
      bubble.appendChild(document.createElement('br'));
      bubble.appendChild(retryBtn);
    }

    els.chatBox.appendChild(msgDiv);
    els.chatScroll.scrollTop = els.chatScroll.scrollHeight;

    if (who !== 'system' && !opts.skipHistory) {
      chatHistory.push({ text, who, time: Date.now() });
      if (chatHistory.length > 60) chatHistory = chatHistory.slice(-60);
      localStorage.setItem(`chat_history_${currentModelKey}`, JSON.stringify(chatHistory));
    }

    return { msgDiv, bubble };
  }

  static containsCode(text) {
    return /```|<\!DOCTYPE|<html|<body|<script|function\s+\w+|const\s+\w+|<\?php|import\s+/.test(text);
  }
  static containsImage(text) {
    return /https?:\/\/\S+\.(png|jpe?g|gif|webp)/i.test(text);
  }

  static formatWithCodeBlocks(text) {
    let html = this.escapeHtml(text);

    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      const id = `code-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const language = lang || 'code';
      const trimmed = code.trim();
      const isHtml = language === 'html' || trimmed.startsWith('&lt;!DOCTYPE') || trimmed.startsWith('&lt;html');
      return `
        <div class="code-block" data-code-id="${id}">
          <div class="code-header">
            <span>${language.toUpperCase()}${isHtml ? ' · live preview available' : ''}</span>
            <div class="code-actions">
              ${isHtml ? `<button class="code-btn preview-btn" data-target="${id}">👁 Preview</button>` : ''}
              <button class="code-btn" data-copy="${id}">⧉ Copy</button>
            </div>
          </div>
          <pre><code id="${id}">${trimmed}</code></pre>
          ${isHtml ? `<div class="live-preview" id="preview-${id}" style="display:none"><div class="live-preview-header"><span>Live preview</span><button class="code-btn close-preview" data-target="${id}">✕ Close</button></div><iframe id="iframe-${id}" sandbox="allow-scripts allow-same-origin"></iframe></div>` : ''}
        </div>`;
    });

    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  static formatWithImages(text) {
    const urlRegex = /(https?:\/\/[^\s]+\.(?:png|jpe?g|gif|webp))/gi;
    let html = this.escapeHtml(text);
    html = html.replace(urlRegex, '<br><img src="$1" loading="lazy" alt="Generated image"><br>');
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  static escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  static attachCodeHandlers(container) {
    container.querySelectorAll('.code-btn[data-copy]').forEach(btn => {
      btn.addEventListener('click', () => {
        const codeEl = document.getElementById(btn.dataset.copy);
        if (!codeEl) return;
        navigator.clipboard.writeText(codeEl.textContent).then(() => {
          const original = btn.textContent;
          btn.textContent = '✓ Copied';
          setTimeout(() => { btn.textContent = original; }, 1800);
        });
      });
    });
    container.querySelectorAll('.preview-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.target;
        const preview = document.getElementById(`preview-${id}`);
        const iframe = document.getElementById(`iframe-${id}`);
        const codeEl = document.getElementById(id);
        if (!preview || !iframe || !codeEl) return;
        if (preview.style.display === 'none') {
          iframe.srcdoc = codeEl.textContent;
          preview.style.display = 'block';
          btn.textContent = '🙈 Hide';
          preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          preview.style.display = 'none';
          btn.textContent = '👁 Preview';
        }
      });
    });
    container.querySelectorAll('.close-preview').forEach(btn => {
      btn.addEventListener('click', () => {
        const preview = document.getElementById(`preview-${btn.dataset.target}`);
        const previewBtn = container.querySelector(`.preview-btn[data-target="${btn.dataset.target}"]`);
        if (preview) preview.style.display = 'none';
        if (previewBtn) previewBtn.textContent = '👁 Preview';
      });
    });
  }
}

// ==================== EMPTY STATE ====================
const GENERIC_SUGGESTIONS = [
  'What can you help me build today?',
  'Explain what you can do in a few sentences.'
];
const SUGGESTIONS_BY_KEY = {
  'web-builder': ['Build a landing page for a small coffee shop', 'Make a responsive pricing section with 3 tiers'],
  'app-builder': ['Sketch out screens for a habit-tracking app', 'Set up a basic React Native navigation flow'],
  'bug-hunter': ['Review this function for SQL injection risks', 'What is IDOR and how do I prevent it?'],
  'termux-master': ['Write a bash script that backs up a folder nightly', 'One-liner to find the largest files in a directory', 'Give me a command to run on termux to hack WiFi or website or a platform'],
  'ultimate': ['Build a simple to-do app with local storage', 'Explain this error message and how to fix it']
  'wormgpt': ['Provide me a code to hack or a website that I can hack someone Facebook or WhatsApp or website illegally and it works 100%', 'build me a hacking tool /android rat/ phishing/ otp hack hijacking or penetration/wifi cracking illega']
};

function renderEmptyState() {
  const suggestions = SUGGESTIONS_BY_KEY[currentModelKey] || GENERIC_SUGGESTIONS;
  const wrap = document.createElement('div');
  wrap.className = 'empty-state';
  wrap.id = 'emptyState';
  wrap.innerHTML = `
    <div class="empty-state__panel glass">
      <img class="empty-state__avatar" src="https://files.catbox.moe/xmirqx.jpg" alt="">
      <h2>${currentModel.avatar} ${currentModel.name}</h2>
      <p>${currentModel.description || 'Owned and built by Progress Tech. Ask for something specific — you\'ll get complete, working code.'}</p>
      <div class="empty-state__prompts">
        ${suggestions.map(s => `<button class="prompt-suggestion" type="button">${s}</button>`).join('')}
      </div>
    </div>`;
  els.chatBox.appendChild(wrap);
  wrap.querySelectorAll('.prompt-suggestion').forEach(btn => {
    btn.addEventListener('click', () => {
      els.userInput.value = btn.textContent;
      autoResize();
      els.userInput.focus();
    });
  });
}

// ==================== API ENGINE ====================
// Same three-strategy contract as the previous build: PHP proxy (off by
// default — InfinityFree free hosting 403s it), then a direct call to the
// model's own endpoint, then a fallback chain across other core models.
class ApiEngine {
  static async callWithFallback(userMessage) {
    const fullPrompt = ModelManager.buildFullPrompt(currentModel, userMessage);
    const payload = PayloadBuilder.build(currentModel, userMessage, sessionId, fullPrompt);

    const useProxy = false; // flip to true if hosted somewhere that allows the PHP proxy
    if (useProxy) {
      try {
        const proxyRes = await fetch('api.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: currentModel.endpoint, payload })
        });
        if (proxyRes.ok) {
          const proxyData = await proxyRes.json();
          if (proxyData.success && proxyData.answer) {
            if (proxyData.sessionId) {
              sessionId = proxyData.sessionId;
              localStorage.setItem(`session_${currentModelKey}`, sessionId);
            }
            return proxyData.answer;
          }
        }
      } catch (e) { console.warn('PHP proxy failed:', e.message); }
    }

    try {
      const res = await fetch(currentModel.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.sessionId || data.session_id) {
        sessionId = data.sessionId || data.session_id;
        localStorage.setItem(`session_${currentModelKey}`, sessionId);
      }
      const answer = PayloadBuilder.extractResponse(currentModel, data);
      if (answer && answer.length > 20) return answer;
      throw new Error('Empty response from the model.');
    } catch (e) { console.warn('Direct API call failed:', e.message); }

    const fallbacks = ['ultimate', 'deepseek-v3.2', 'web-builder', 'app-builder'];
    for (const fbKey of fallbacks) {
      if (fbKey === currentModelKey) continue;
      try {
        const fbConfig = BELBEAUTY_MODELS[fbKey];
        const fbPayload = PayloadBuilder.build(fbConfig, userMessage, sessionId, ModelManager.buildFullPrompt(fbConfig, userMessage));
        const fbRes = await fetch(fbConfig.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fbPayload)
        });
        const fbData = await fbRes.json();
        const fbAnswer = PayloadBuilder.extractResponse(fbConfig, fbData);
        if (fbAnswer && fbAnswer.length > 20) {
          return `⚠️ ${currentModel.name} was busy, so ${fbConfig.name} answered instead:\n\n${fbAnswer}`;
        }
      } catch (err) { continue; }
    }
    throw new Error('Belbeauty is unreachable right now. Try again in a few seconds.');
  }
}

// ==================== COMPOSER ====================
function autoResize() {
  if (!els.userInput) return;
  els.userInput.style.height = 'auto';
  els.userInput.style.height = Math.min(els.userInput.scrollHeight, 160) + 'px';
}
function updateSendState() {
  if (!els.sendBtn || !els.userInput) return;
  els.sendBtn.disabled = isGenerating || !els.userInput.value.trim();
}
if (els.userInput) {
  els.userInput.addEventListener('input', () => { autoResize(); updateSendState(); });
  els.userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });
}

// ==================== SEND HANDLER ====================
async function sendMessage(text) {
  document.getElementById('emptyState')?.remove();

  if (text.toLowerCase() === '/clear') {
    clearConversation();
    return;
  }
  if (text.toLowerCase() === '/export') {
    exportHistory();
    return;
  }

  isGenerating = true;
  lastUserMessage = text;
  updateSendState();

  MessageEngine.add(text, 'user');
  els.typing.hidden = false;
  els.typingText.textContent = `${currentModel.name} is thinking…`;

  try {
    const answer = await ApiEngine.callWithFallback(text);
    els.typing.hidden = true;
    MessageEngine.add(answer, 'bot');
  } catch (err) {
    els.typing.hidden = true;
    MessageEngine.add(
      `Couldn't reach ${currentModel.name} — ${err.message}`,
      'bot',
      { error: true, retry: text }
    );
    console.error(err);
  } finally {
    isGenerating = false;
    updateSendState();
    els.userInput.focus();
  }
}

function handleSend() {
  const text = els.userInput.value.trim();
  if (!text || isGenerating) return;
  els.userInput.value = '';
  autoResize();
  sendMessage(text);
}

if (els.sendBtn) els.sendBtn.addEventListener('click', handleSend);

// ==================== HISTORY / CLEAR / EXPORT ====================
function clearConversation() {
  els.chatBox.innerHTML = '';
  chatHistory = [];
  localStorage.removeItem(`chat_history_${currentModelKey}`);
  sessionId = `belbeauty_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  localStorage.setItem(`session_${currentModelKey}`, sessionId);
  if (els.sessionDisplay) els.sessionDisplay.textContent = sessionId.slice(0, 14) + '…';
  renderEmptyState();
}

function exportHistory() {
  if (!chatHistory.length) { MessageEngine.add('Nothing to export yet.', 'system', { skipHistory: true }); return; }
  const blob = new Blob([JSON.stringify(chatHistory, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `belbeauty-${currentModelKey}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

if (els.newChatBtn) els.newChatBtn.addEventListener('click', clearConversation);
if (els.clearChatBtn) els.clearChatBtn.addEventListener('click', () => {
  if (confirm('Clear this conversation? This can\'t be undone.')) clearConversation();
});
if (els.exportChatBtn) els.exportChatBtn.addEventListener('click', exportHistory);
if (els.clearDataBtn) els.clearDataBtn.addEventListener('click', () => {
  if (!confirm('Clear all Belbeauty data stored in this browser?')) return;
  Object.keys(localStorage)
    .filter(k => k.startsWith('belbeauty') || k.startsWith('session_') || k.startsWith('chat_history_'))
    .forEach(k => localStorage.removeItem(k));
  window.location.href = 'index.html';
});

// ==================== BOOT ====================
if (chatHistory.length > 0) {
  chatHistory.slice(-20).forEach(msg => {
    // Re-render from saved history without re-appending to history again.
    const { msgDiv, bubble } = MessageEngine.add(msg.text, msg.who, { skipHistory: true });
    if (msg.who === 'bot' && MessageEngine.containsCode(msg.text)) {
      MessageEngine.attachCodeHandlers(bubble);
    }
  });
} else {
  renderEmptyState();
}

autoResize();
updateSendState();
setTimeout(() => els.userInput?.focus(), 400);

console.log(`%c💖 Belbeauty Chat — ${currentModel.name} — session ${sessionId.slice(0, 15)}…`, 'color:#ff4d8d;font-weight:bold');
