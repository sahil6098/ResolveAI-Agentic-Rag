/* ══════════════════════════════════════════════════════════════════
   Resolve-AI  —  Application Logic
   ══════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  // ── DOM References ──────────────────────────────────────────────
  const messagesContainer = document.getElementById('messages-container');
  const welcomeScreen     = document.getElementById('welcome-screen');
  const chatInput         = document.getElementById('chat-input');
  const sendBtn           = document.getElementById('send-btn');
  const newChatFloat      = document.getElementById('new-chat-float');
  const workflowBtn       = document.getElementById('workflow-btn');
  const uploadBtn         = document.getElementById('upload-btn');
  const workflowModal     = document.getElementById('workflow-modal');
  const uploadModal       = document.getElementById('upload-modal');
  const newChatBtn        = document.getElementById('new-chat-btn');

  let isProcessing = false;

  // ── Auto-Resize Textarea ────────────────────────────────────────
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  });

  // ── Send on Enter (Shift+Enter for newline) ─────────────────────
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener('click', sendMessage);

  // ── Welcome Card Click ──────────────────────────────────────────
  document.querySelectorAll('.welcome-card').forEach(card => {
    card.addEventListener('click', () => {
      const question = card.dataset.question;
      if (question) {
        chatInput.value = question;
        sendMessage();
      }
    });
  });

  // ── New Chat ────────────────────────────────────────────────────
  function resetChat() {
    messagesContainer.innerHTML = '';
    messagesContainer.appendChild(welcomeScreen);
    welcomeScreen.style.display = 'flex';
    newChatFloat.classList.remove('visible');
    chatInput.value = '';
    chatInput.style.height = 'auto';
    chatInput.focus();
  }

  newChatFloat.addEventListener('click', resetChat);
  newChatBtn.addEventListener('click', resetChat);

  // ── Modal Controls ──────────────────────────────────────────────
  workflowBtn.addEventListener('click', () => workflowModal.classList.add('open'));
  uploadBtn.addEventListener('click', () => uploadModal.classList.add('open'));

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal-overlay').classList.remove('open');
    });
  });

  // ── File Upload ─────────────────────────────────────────────────
  const uploadZone    = document.getElementById('upload-zone');
  const fileInput     = document.getElementById('file-input');
  const adminKeyInput = document.getElementById('admin-key-input');
  const uploadProgress = document.getElementById('upload-progress');
  const progressFill  = document.getElementById('upload-progress-fill');
  const uploadStatus  = document.getElementById('upload-status');
  const uploadResult  = document.getElementById('upload-result');

  uploadZone.addEventListener('click', () => fileInput.click());
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      handleUpload(e.dataTransfer.files[0]);
    }
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleUpload(fileInput.files[0]);
  });

  async function handleUpload(file) {
    const adminKey = adminKeyInput.value.trim();
    if (!adminKey) {
      showUploadResult('error', 'Please enter the admin API key.');
      return;
    }

    uploadResult.className = 'upload-result';
    uploadResult.style.display = 'none';
    uploadProgress.classList.add('active');
    progressFill.style.width = '0%';
    uploadStatus.textContent = `Uploading ${file.name}...`;

    // Animate progress
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress = Math.min(progress + Math.random() * 15, 90);
      progressFill.style.width = progress + '%';
    }, 300);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
        body: formData,
      });

      clearInterval(progressInterval);
      progressFill.style.width = '100%';

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Upload failed');
      }

      const data = await res.json();
      uploadStatus.textContent = 'Complete!';
      showUploadResult('success',
        `✓ "${data.file}" indexed successfully — ${data.chunks} chunks created.`
      );
    } catch (err) {
      clearInterval(progressInterval);
      progressFill.style.width = '0%';
      uploadStatus.textContent = 'Failed';
      showUploadResult('error', `✗ ${err.message}`);
    }

    setTimeout(() => uploadProgress.classList.remove('active'), 2000);
  }

  function showUploadResult(type, message) {
    uploadResult.className = `upload-result ${type}`;
    uploadResult.textContent = message;
    uploadResult.style.display = 'block';
  }

  // ── Send Message ────────────────────────────────────────────────
  async function sendMessage() {
    const question = chatInput.value.trim();
    if (!question || isProcessing) return;

    isProcessing = true;
    sendBtn.disabled = true;

    // Hide welcome screen
    if (welcomeScreen.style.display !== 'none') {
      welcomeScreen.style.display = 'none';
    }

    // Show new-chat button
    newChatFloat.classList.add('visible');

    // Add user message
    appendUserMessage(question);

    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';

    // Show typing indicator
    const typingEl = showTyping();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Something went wrong');
      }

      const data = await res.json();
      removeTyping(typingEl);
      appendBotMessage(data);
    } catch (err) {
      removeTyping(typingEl);
      appendBotError(err.message);
    }

    isProcessing = false;
    sendBtn.disabled = false;
    chatInput.focus();
  }

  // ── Append User Message ─────────────────────────────────────────
  function appendUserMessage(text) {
    const msgEl = document.createElement('div');
    msgEl.className = 'message user';
    msgEl.innerHTML = `
      <div class="message-avatar">You</div>
      <div class="message-content">
        <div class="message-bubble">${escapeHtml(text)}</div>
      </div>
    `;
    messagesContainer.appendChild(msgEl);
    scrollToBottom();
  }

  // ── Append Bot Message ──────────────────────────────────────────
  function appendBotMessage(data) {
    const msgEl = document.createElement('div');
    msgEl.className = 'message bot';

    // Format the answer with markdown-like rendering
    const formattedAnswer = formatAnswer(data.answer);

    // Build source badge
    const sourceBadge = buildSourceBadge(data.source_used);

    // Build citations
    const citationsHtml = buildCitations(data.citations || []);

    // Build rewritten query tag
    const rewrittenHtml = data.rewritten_query && data.rewritten_query !== data.question
      ? `<span class="rewritten-tag">
           <svg><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
           Query refined
         </span>` : '';

    // Build trace
    const traceHtml = buildTrace(data.trace || []);

    msgEl.innerHTML = `
      <div class="message-avatar">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" fill="none" stroke-width="1.5"/>
          <path d="M2 17l10 5 10-5" stroke="white" fill="none" stroke-width="1.5"/>
          <path d="M2 12l10 5 10-5" stroke="white" fill="none" stroke-width="1.5"/>
        </svg>
      </div>
      <div class="message-content">
        <div class="message-bubble">${formattedAnswer}</div>
        <div class="source-badge-row">
          ${sourceBadge}
          ${rewrittenHtml}
          ${traceHtml.toggle}
        </div>
        ${citationsHtml}
        ${traceHtml.panel}
      </div>
    `;

    messagesContainer.appendChild(msgEl);

    // Bind trace toggle
    const toggle = msgEl.querySelector('.trace-toggle');
    const panel = msgEl.querySelector('.trace-panel');
    if (toggle && panel) {
      toggle.addEventListener('click', () => {
        toggle.classList.toggle('open');
        panel.classList.toggle('open');
      });
    }

    scrollToBottom();
  }

  // ── Append Error ────────────────────────────────────────────────
  function appendBotError(message) {
    const msgEl = document.createElement('div');
    msgEl.className = 'message bot';
    msgEl.innerHTML = `
      <div class="message-avatar">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" fill="none" stroke-width="1.5"/>
          <path d="M2 17l10 5 10-5" stroke="white" fill="none" stroke-width="1.5"/>
          <path d="M2 12l10 5 10-5" stroke="white" fill="none" stroke-width="1.5"/>
        </svg>
      </div>
      <div class="message-content">
        <div class="message-bubble" style="border-color: #fecaca;">
          <p>⚠️ <strong>Something went wrong</strong></p>
          <p style="color:var(--gray-500);font-size:0.82rem;">${escapeHtml(message)}</p>
        </div>
      </div>
    `;
    messagesContainer.appendChild(msgEl);
    scrollToBottom();
  }

  // ── Typing Indicator ───────────────────────────────────────────
  function showTyping() {
    const el = document.createElement('div');
    el.className = 'typing-indicator';
    el.innerHTML = `
      <div class="message-avatar" style="background:linear-gradient(135deg,var(--primary-500),var(--teal-500));color:white;width:34px;height:34px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" fill="none" stroke-width="1.5"/>
          <path d="M2 17l10 5 10-5" stroke="white" fill="none" stroke-width="1.5"/>
          <path d="M2 12l10 5 10-5" stroke="white" fill="none" stroke-width="1.5"/>
        </svg>
      </div>
      <div class="typing-dots">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    messagesContainer.appendChild(el);
    scrollToBottom();
    return el;
  }

  function removeTyping(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  // ── Helpers ─────────────────────────────────────────────────────
  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatAnswer(text) {
    if (!text) return '<p>No answer returned.</p>';

    // Handle numbered lists
    text = text.replace(/^(\d+)\.\s+\*\*(.*?)\*\*:?\s*/gm, '<li><strong>$2</strong> — ');
    // Handle bold
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Handle inline code
    text = text.replace(/`(.*?)`/g, '<code>$1</code>');

    // Split into paragraphs
    const paragraphs = text.split(/\n{2,}/);
    let html = '';
    for (const p of paragraphs) {
      const trimmed = p.trim();
      if (!trimmed) continue;
      if (trimmed.includes('<li>')) {
        html += '<ol>' + trimmed + '</ol>';
      } else {
        // Handle line breaks within paragraphs
        const lines = trimmed.split('\n').filter(l => l.trim());
        html += lines.map(l => `<p>${l.trim()}</p>`).join('');
      }
    }
    return html || `<p>${text}</p>`;
  }

  function buildSourceBadge(source) {
    const icons = {
      private_kb: `<svg><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
      web_search: `<svg><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
      direct:     `<svg><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
      insufficient_evidence: `<svg><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    };

    const labels = {
      private_kb: 'Private KB',
      web_search: 'Web Search',
      direct: 'Direct',
      insufficient_evidence: 'Low Confidence',
    };

    const classes = {
      private_kb: 'kb',
      web_search: 'web',
      direct: 'direct',
      insufficient_evidence: 'warn',
    };

    const key = source || 'direct';
    return `<span class="source-badge ${classes[key] || 'direct'}">
              ${icons[key] || icons.direct}
              ${labels[key] || source}
            </span>`;
  }

  function buildCitations(citations) {
    if (!citations.length) return '';
    const chips = citations.map(c => {
      const icon = c.type === 'web'
        ? `<svg><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`
        : `<svg><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

      if (c.url) {
        return `<a class="citation-chip" href="${escapeHtml(c.url)}" target="_blank" rel="noopener">${icon} ${escapeHtml(c.title)}</a>`;
      }
      return `<span class="citation-chip">${icon} ${escapeHtml(c.title)}</span>`;
    });
    return `<div class="citations-list">${chips.join('')}</div>`;
  }

  function buildTrace(trace) {
    if (!trace.length) return { toggle: '', panel: '' };

    const toggle = `
      <button class="trace-toggle">
        <svg><polyline points="6 9 12 15 18 9"/></svg>
        Workflow trace
      </button>
    `;

    const steps = trace.map((step, i) => `
      <div class="trace-step">
        <div class="trace-node">${i + 1}</div>
        <div class="trace-label">${escapeHtml(step)}</div>
      </div>
    `).join('');

    const panel = `
      <div class="trace-panel">
        <div class="trace-flow">${steps}</div>
      </div>
    `;

    return { toggle, panel };
  }

  // ── Focus input on load ─────────────────────────────────────────
  chatInput.focus();
});
