// Quiz overlay: one flat list of questions per sim, any type in any order
// (like a single Google Form). Talks to /api/quest/* endpoints via window.API.
//
// Navigation is free: every question dot is clickable and unanswered
// questions can be skipped (and revisited later). Tutorial steps support
// the extended payload from docs/TUTORIAL_DESIGN.md: `action_prompt`
// (try-it gate), `highlight.selector` (live spotlight inside self-built
// sims), and `image`/`image_caption` (annotated screenshot for PhET sims).

(function () {
  const TYPE_LABEL = {
    tutorial_step: 'Tutorial',
    var_test: 'Uji Variabel',
    simple_mc: 'Pilihan Ganda',
    complex_mc: 'PG Kompleks',
    true_false: 'Benar/Salah',
    word_bank: 'Bank Kata',
    table_mc: 'PG Tabel'
  };

  const state = {
    simKey: null,
    title: '',
    questions: [],   // ordered flat list
    responses: {},   // question_id → { answer, is_correct }
    cursor: 0,       // index into questions
    open: true,
    startTs: 0,
    previewMode: false,
    triedActions: {} // question_id → true once the "saya sudah mencoba" gate is clicked
  };

  let root, panel, fab;

  async function init(simKey, options) {
    state.simKey = simKey;
    state.previewMode = !!(options && options.previewMode);

    let data;
    if (state.previewMode && options.previewData) {
      data = options.previewData;
    } else {
      data = await API.get(`/api/quest/sim/${encodeURIComponent(simKey)}`);
    }
    state.title = data.sim.title;
    state.questions = data.questions; // server returns ORDER BY order_index, id
    for (const r of data.responses || []) state.responses[r.question_id] = r;
    buildUi();
    jumpToFirstUnanswered();
    render();
  }

  // True when the page has the split-screen pane (#quiz-pane).
  function isSplitMode() {
    return window.innerWidth > 860 && !!document.getElementById('quiz-pane');
  }

  function buildUi() {
    const split = isSplitMode();

    const fabHtml = `<button id="quiz-fab" title="Buka Quiz">📝<span class="badge" id="quiz-fab-badge"></span></button>`;

    const previewBadge = state.previewMode
      ? `<span style="background:#f59e0b;color:#78350f;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;margin-left:6px;">PREVIEW</span>`
      : '';
    const panelHtml = `
      <div id="quiz-panel">
        <div class="qp-header" id="qp-header">
          <div class="qp-title">📝 <span id="qp-sim-title"></span>${previewBadge}</div>
          <div class="qp-actions">
            ${split ? '' : '<button id="qp-min" title="Minimize">–</button>'}
          </div>
        </div>
        <div class="qp-dots" id="qp-dots"></div>
        <div class="qp-body" id="qp-body"></div>
        <div class="qp-footer">
          <div class="progress" id="qp-progress"></div>
          <div class="btns">
            <button class="qp-btn secondary" id="qp-prev">←</button>
            <button class="qp-btn secondary" id="qp-skip" title="Lewati soal ini dan kembali lagi nanti">Lewati ↷</button>
            <button class="qp-btn" id="qp-next">Lanjut →</button>
          </div>
        </div>
      </div>
    `;

    if (split) {
      // Desktop: panel lives inside #quiz-pane; no FAB (topbar handles toggle).
      const pane = document.getElementById('quiz-pane');
      pane.innerHTML = panelHtml;
    } else {
      // Mobile: floating panel + FAB over the sim.
      root = document.createElement('div');
      root.innerHTML = fabHtml + panelHtml;
      document.body.appendChild(root);
    }

    panel = document.getElementById('quiz-panel');
    fab = document.getElementById('quiz-fab');

    document.getElementById('qp-sim-title').textContent = state.title;

    const minBtn = document.getElementById('qp-min');
    if (minBtn) minBtn.addEventListener('click', () => togglePanel(false));
    if (fab) fab.addEventListener('click', () => togglePanel(true));

    document.getElementById('qp-prev').addEventListener('click', () => move(-1));
    document.getElementById('qp-skip').addEventListener('click', () => onSkip());
    document.getElementById('qp-next').addEventListener('click', () => onNext());

    if (!split) enableDrag();
    togglePanel(true);

    window.addEventListener('resize', () => updateBadge());
  }

  function togglePanel(open) {
    state.open = open;
    if (isSplitMode()) {
      panel.classList.remove('hidden');
    } else {
      panel.classList.toggle('hidden', !open);
      if (fab) fab.style.display = open ? 'none' : 'block';
    }
    updateBadge();
  }

  function updateBadge() {
    const remaining = state.questions.filter(q => !state.responses[q.id]).length;
    const b = document.getElementById('quiz-fab-badge');
    if (!b) return;
    b.textContent = remaining > 0 ? String(remaining) : '';
    b.style.display = remaining > 0 ? 'inline-block' : 'none';
  }

  function enableDrag() {
    const header = document.getElementById('qp-header');
    if (!header) return;
    let sx, sy, ox, oy, dragging = false;
    header.addEventListener('mousedown', (e) => {
      if (isSplitMode()) return;
      dragging = true;
      const rect = panel.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY; ox = rect.left; oy = rect.top;
      panel.style.right = 'auto'; panel.style.bottom = 'auto';
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      panel.style.left = (ox + e.clientX - sx) + 'px';
      panel.style.top  = (oy + e.clientY - sy) + 'px';
    });
    window.addEventListener('mouseup', () => { dragging = false; });
  }

  function currentQuestion() {
    return state.questions[state.cursor];
  }

  function jumpToFirstUnanswered() {
    const idx = state.questions.findIndex(q => !state.responses[q.id]);
    state.cursor = idx >= 0 ? idx : Math.max(0, state.questions.length - 1);
    state.startTs = Date.now();
  }

  function render() {
    renderDots();
    renderBody();
    renderFooter();
    updateBadge();
  }

  // Numbered dot per question: green = answered, blue ring = current, gray = todo.
  // Every dot is clickable — students may skip around freely.
  function renderDots() {
    const el = document.getElementById('qp-dots');
    el.innerHTML = state.questions.map((q, i) => {
      const answered = !!state.responses[q.id];
      const current = i === state.cursor;
      return `<button class="qp-dot ${answered ? 'done' : ''} ${current ? 'current' : ''}" data-i="${i}" title="Soal ${i+1}: ${TYPE_LABEL[q.type] || q.type}">${i + 1}</button>`;
    }).join('');
    el.querySelectorAll('.qp-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        state.cursor = parseInt(dot.dataset.i, 10);
        state.startTs = Date.now();
        render();
      });
    });
    // Keep current dot visible
    const cur = el.querySelector('.qp-dot.current');
    if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }

  function renderBody() {
    const body = document.getElementById('qp-body');
    clearSpotlight();
    const q = currentQuestion();
    if (!q) {
      body.innerHTML = `<div class="feedback info">Belum ada soal untuk simulasi ini.</div>`;
      return;
    }
    state.startTs = state.startTs || Date.now();
    const existing = state.responses[q.id];

    let html = `<h3>Soal ${state.cursor + 1}/${state.questions.length} · ${TYPE_LABEL[q.type] || q.type}</h3>`;
    const p = q.payload;

    if (q.type === 'tutorial_step') {
      html += `<div class="q-text"><strong>${escapeHtml(p.title || '')}</strong></div><div>${escapeHtml(p.body || '')}</div>`;
      if (p.image) {
        html += `<img class="tut-image" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.image_caption || p.title || '')}" />`;
        if (p.image_caption) html += `<div class="tut-image-caption">${escapeHtml(p.image_caption)}</div>`;
      }
      if (p.action_prompt) {
        const tried = !!existing || !!state.triedActions[q.id];
        html += `
          <div class="tut-action">
            <div class="tut-action-text">🎯 ${escapeHtml(p.action_prompt)}</div>
            <button class="tut-confirm ${tried ? 'done' : ''}" id="tut-confirm" ${tried ? 'disabled' : ''}>
              ${tried ? '✓ Sudah dicoba' : '✓ Saya sudah mencoba'}
            </button>
          </div>`;
      } else {
        html += `<div class="feedback info">Baca penjelasan di atas, lalu klik "Lanjut →" untuk melanjutkan.</div>`;
      }
      if (p.highlight && p.highlight.selector) showSpotlight(p.highlight.selector);
    } else if (q.type === 'var_test') {
      html += `<div class="q-text">${escapeHtml(p.prompt || '')}</div>`;
      if (p.hint) html += `<div class="muted" style="font-size:12px; margin-bottom:8px;">💡 ${escapeHtml(p.hint)}</div>`;
      const prev = existing ? existing.answer : '';
      html += `<textarea class="input" id="vt-input" rows="3" placeholder="Tuliskan jawabanmu...">${escapeHtml(prev || '')}</textarea>`;
    } else if (q.type === 'simple_mc') {
      html += `<div class="q-text">${escapeHtml(p.question)}</div>`;
      const prev = existing ? existing.answer : null;
      p.options.forEach((opt, i) => {
        const sel = (prev === i) ? 'selected' : '';
        html += `<label class="option ${sel}" data-i="${i}"><input type="radio" name="smc" value="${i}" ${prev===i?'checked':''}/> ${escapeHtml(opt)}</label>`;
      });
    } else if (q.type === 'complex_mc') {
      html += `<div class="q-text">${escapeHtml(p.question)}</div>`;
      const prev = (existing && Array.isArray(existing.answer)) ? existing.answer : [];
      p.options.forEach((opt, i) => {
        const checked = prev.includes(i);
        html += `<label class="option ${checked?'selected':''}" data-i="${i}"><input type="checkbox" name="cmc" value="${i}" ${checked?'checked':''}/> ${escapeHtml(opt)}</label>`;
      });
    } else if (q.type === 'true_false') {
      html += `<div class="q-text">${escapeHtml(p.statement)}</div>`;
      const prev = existing ? !!existing.answer : null;
      html += `
        <label class="option ${prev===true?'selected':''}"><input type="radio" name="tf" value="true" ${prev===true?'checked':''}/> Benar</label>
        <label class="option ${prev===false?'selected':''}"><input type="radio" name="tf" value="false" ${prev===false?'checked':''}/> Salah</label>
      `;
    } else if (q.type === 'word_bank') {
      html += `<div class="q-text">${renderWordBankTemplate(p.template)}</div>`;
      html += `<div class="muted" style="font-size:12px;">Klik kata di bawah lalu klik kotak isian untuk menempatkan.</div>`;
      html += `<div class="wb-bank" id="wb-bank">${p.bank.map((w,i) => `<div class="wb-word" data-w="${escapeHtml(w)}">${escapeHtml(w)}</div>`).join('')}</div>`;
      html += `<button class="qp-btn secondary" id="wb-clear" style="margin-top:8px;">Reset</button>`;
    } else if (q.type === 'table_mc') {
      html += `<div class="q-text">${escapeHtml(p.question)}</div>`;
      const prev = (existing && Array.isArray(existing.answer)) ? existing.answer : [];
      html += `<table class="tmc-table"><thead><tr><th>${escapeHtml(p.row_header || '')}</th>`;
      (p.columns || []).forEach(col => { html += `<th>${escapeHtml(col)}</th>`; });
      html += `</tr></thead><tbody>`;
      (p.rows || []).forEach((row, ri) => {
        html += `<tr data-row="${ri}"><td>${escapeHtml(row.label)}</td>`;
        (p.columns || []).forEach((col, ci) => {
          const sel = prev[ri] === ci;
          html += `<td class="${sel ? 'tmc-sel' : ''}"><label><input type="radio" name="tmc-${ri}" value="${ci}" ${sel ? 'checked' : ''} /></label></td>`;
        });
        html += `</tr>`;
      });
      html += `</tbody></table>`;
    }

    if (existing && existing.is_correct === true)  html += `<div class="feedback ok">✓ Jawaban tersimpan (benar).</div>`;
    if (existing && existing.is_correct === false) html += `<div class="feedback no">✗ Jawaban tersimpan (perlu diperbaiki).</div>`;
    if (existing && existing.is_correct === null)  html += `<div class="feedback info">✓ Jawaban tersimpan.</div>`;

    body.innerHTML = html;
    wireBodyInteractions(q);
  }

  // ── Tutorial spotlight ───────────────────────────────────────────────────
  // Dims the sim pane and cuts a glowing window around the highlighted
  // element inside the (same-origin) sim iframe. The ring ignores pointer
  // events so the student can interact with the highlighted control.
  // PhET sims are minified so they get no selector — text/image steps only.
  let spotlightTimer = null;

  function clearSpotlight() {
    if (spotlightTimer) { clearInterval(spotlightTimer); spotlightTimer = null; }
    const el = document.getElementById('tut-spotlight');
    if (el) el.remove();
  }

  function showSpotlight(selector) {
    clearSpotlight();
    // Re-position continuously: the sim iframe loads async, its layout can
    // shift, and its content may scroll. Cheap (~2 rect reads / tick).
    spotlightTimer = setInterval(() => positionSpotlight(selector), 350);
    positionSpotlight(selector);
  }

  function positionSpotlight(selector) {
    const pane = document.getElementById('sim-pane');
    const iframe = document.getElementById('sim-host');
    if (!pane || !iframe) return;
    let target = null;
    try {
      target = iframe.contentDocument && iframe.contentDocument.querySelector(selector);
    } catch { /* cross-origin or not ready */ }
    let ring = document.getElementById('tut-spotlight');
    if (!target) { if (ring) ring.remove(); return; }

    const tr = target.getBoundingClientRect();
    if (!tr.width && !tr.height) { if (ring) ring.remove(); return; }

    if (!ring) {
      ring = document.createElement('div');
      ring.id = 'tut-spotlight';
      pane.appendChild(ring);
    }
    // The iframe fills #sim-pane (inset 0), so rect coords inside the iframe
    // map 1:1 onto pane-relative coords.
    const pad = 6;
    ring.style.left = (tr.left - pad) + 'px';
    ring.style.top = (tr.top - pad) + 'px';
    ring.style.width = (tr.width + pad * 2) + 'px';
    ring.style.height = (tr.height + pad * 2) + 'px';
  }

  function renderWordBankTemplate(template) {
    return template.replace(/__([0-9]+)__/g, (m, n) => {
      return `<span class="wb-input" data-blank="${parseInt(n,10)-1}"></span>`;
    });
  }

  function wireBodyInteractions(q) {
    if (q.type === 'tutorial_step') {
      const confirmBtn = document.getElementById('tut-confirm');
      if (confirmBtn && !confirmBtn.disabled) {
        confirmBtn.addEventListener('click', () => {
          state.triedActions[q.id] = true;
          confirmBtn.disabled = true;
          confirmBtn.classList.add('done');
          confirmBtn.textContent = '✓ Sudah dicoba';
          renderFooter();
        });
      }
    }
    if (q.type === 'table_mc') {
      document.querySelectorAll('.tmc-table input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', () => {
          const row = radio.closest('tr');
          row.querySelectorAll('td').forEach(td => td.classList.remove('tmc-sel'));
          radio.closest('td').classList.add('tmc-sel');
        });
      });
    }
    if (q.type === 'simple_mc' || q.type === 'true_false') {
      document.querySelectorAll('.option').forEach(el => {
        el.addEventListener('click', () => {
          document.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
          el.classList.add('selected');
          el.querySelector('input').checked = true;
        });
      });
    }
    if (q.type === 'complex_mc') {
      document.querySelectorAll('.option').forEach(el => {
        el.addEventListener('click', (e) => {
          if (e.target.tagName !== 'INPUT') {
            const cb = el.querySelector('input');
            cb.checked = !cb.checked;
          }
          el.classList.toggle('selected', el.querySelector('input').checked);
        });
      });
    }
    if (q.type === 'word_bank') {
      let activeBlank = null;
      const inputs = document.querySelectorAll('.wb-input');
      const words = document.querySelectorAll('.wb-word');
      inputs.forEach(el => el.addEventListener('click', () => {
        inputs.forEach(i => i.style.outline = '');
        el.style.outline = '2px solid #2563eb';
        activeBlank = el;
      }));
      words.forEach(w => w.addEventListener('click', () => {
        if (!activeBlank) activeBlank = inputs[0];
        if (!activeBlank) return;
        const prev = activeBlank.textContent.trim();
        if (prev) {
          const prevWord = Array.from(words).find(x => x.dataset.w === prev && x.classList.contains('used'));
          if (prevWord) prevWord.classList.remove('used');
        }
        activeBlank.textContent = w.dataset.w;
        activeBlank.classList.add('filled');
        w.classList.add('used');
        const arr = Array.from(inputs);
        const i = arr.indexOf(activeBlank);
        activeBlank = arr[i+1] || null;
        arr.forEach(x => x.style.outline = '');
        if (activeBlank) activeBlank.style.outline = '2px solid #2563eb';
      }));
      const clearBtn = document.getElementById('wb-clear');
      if (clearBtn) clearBtn.addEventListener('click', () => {
        inputs.forEach(i => { i.textContent = ''; i.classList.remove('filled'); });
        words.forEach(w => w.classList.remove('used'));
      });
    }
  }

  function readAnswer(q) {
    if (q.type === 'tutorial_step') return true;
    if (q.type === 'var_test') {
      const el = document.getElementById('vt-input');
      return el ? el.value.trim() : '';
    }
    if (q.type === 'simple_mc') {
      const sel = document.querySelector('input[name="smc"]:checked');
      return sel ? parseInt(sel.value, 10) : null;
    }
    if (q.type === 'complex_mc') {
      return Array.from(document.querySelectorAll('input[name="cmc"]:checked')).map(x => parseInt(x.value, 10));
    }
    if (q.type === 'true_false') {
      const sel = document.querySelector('input[name="tf"]:checked');
      return sel ? sel.value === 'true' : null;
    }
    if (q.type === 'word_bank') {
      return Array.from(document.querySelectorAll('.wb-input')).map(el => el.textContent.trim());
    }
    if (q.type === 'table_mc') {
      return (q.payload.rows || []).map((_, ri) => {
        const sel = document.querySelector(`input[name="tmc-${ri}"]:checked`);
        return sel ? parseInt(sel.value, 10) : -1;
      });
    }
    return null;
  }

  function answerIsEmpty(q, ans) {
    if (q.type === 'tutorial_step') return false;
    if (q.type === 'var_test') return !ans;
    if (q.type === 'simple_mc') return ans === null;
    if (q.type === 'complex_mc') return !ans || ans.length === 0;
    if (q.type === 'true_false') return ans === null;
    if (q.type === 'word_bank') return !ans || ans.some(x => !x);
    if (q.type === 'table_mc') return !ans || ans.some(v => v === -1 || v == null);
    return true;
  }

  async function submitCurrent() {
    const q = currentQuestion();
    if (!q) return;
    const ans = readAnswer(q);
    if (answerIsEmpty(q, ans)) {
      alert('Jawaban belum diisi. Gunakan tombol "Lewati ↷" jika ingin melompati soal ini.');
      return false;
    }
    if (state.previewMode) {
      // Don't record in preview — just store locally so navigation works.
      state.responses[q.id] = { answer: ans, is_correct: null };
      return true;
    }
    const time_spent = Date.now() - (state.startTs || Date.now());
    const r = await API.post('/api/quest/response', { question_id: q.id, answer: ans, time_spent_ms: time_spent });
    state.responses[q.id] = { answer: ans, is_correct: r.is_correct };
    return true;
  }

  async function onNext() {
    const q = currentQuestion();
    if (!q) return;
    if (!state.responses[q.id]) {
      const ok = await submitCurrent();
      if (!ok) return;
    }
    if (state.cursor >= state.questions.length - 1) {
      await tryComplete();
      return;
    }
    move(1);
  }

  // Skip without answering; the dot stays gray so the student can return.
  function onSkip() {
    if (state.cursor >= state.questions.length - 1) {
      tryComplete();
      return;
    }
    move(1);
  }

  function move(delta) {
    const next = state.cursor + delta;
    if (next < 0 || next >= state.questions.length) return;
    state.cursor = next;
    state.startTs = Date.now();
    render();
  }

  async function tryComplete() {
    const body = document.getElementById('qp-body');
    clearSpotlight();
    const unanswered = state.questions
      .map((q, i) => (state.responses[q.id] ? null : i))
      .filter(i => i !== null);

    if (state.previewMode) {
      body.innerHTML = `
        <div class="feedback info"><strong>Preview selesai.</strong></div>
        <p>Jawaban tidak direkam karena ini adalah mode preview admin.</p>
        <button class="qp-btn secondary" onclick="window.close()">Tutup Tab</button>
        <button class="qp-btn" onclick="window.location.href='/admin.html'">Kembali ke Admin</button>
      `;
      renderDots();
      updateBadge();
      return;
    }

    // Some questions skipped: show a summary with shortcuts back to them.
    // Skipping is allowed — students are told to skip what they don't
    // understand — so this is informative, not blocking.
    if (unanswered.length > 0) {
      body.innerHTML = `
        <div class="feedback info"><strong>Kamu sudah mencapai akhir daftar soal.</strong></div>
        <p>Masih ada <strong>${unanswered.length}</strong> soal yang dilewati. Klik nomor di bawah untuk kembali ke soal itu, atau biarkan jika memang tidak kamu pahami.</p>
        <div class="qp-unanswered">
          ${unanswered.map(i => `<button class="qp-dot" data-jump="${i}">${i + 1}</button>`).join('')}
        </div>
        <button class="qp-btn" style="margin-top:14px;" onclick="window.location.href='/dashboard.html'">Kembali ke Dashboard</button>
      `;
      body.querySelectorAll('[data-jump]').forEach(btn => {
        btn.addEventListener('click', () => {
          state.cursor = parseInt(btn.dataset.jump, 10);
          state.startTs = Date.now();
          render();
        });
      });
      renderDots();
      updateBadge();
      return;
    }

    try {
      await API.post(`/api/quest/sim/${encodeURIComponent(state.simKey)}/complete`, {});
      body.innerHTML = `
        <div class="feedback ok"><strong>✓ Simulasi selesai!</strong></div>
        <p>Semua soal pada simulasi ini telah dijawab. Kamu bisa membuka simulasi lain dari dashboard kapan saja.</p>
        <button class="qp-btn" onclick="window.location.href='/dashboard.html'">Kembali ke Dashboard</button>
      `;
      renderDots();
      updateBadge();
    } catch (err) {
      alert('Belum bisa menyelesaikan: ' + err.message);
    }
  }

  function renderFooter() {
    const total = state.questions.length;
    const done = Object.keys(state.responses).length;
    document.getElementById('qp-progress').textContent = `${done}/${total} terjawab`;
    const q = currentQuestion();
    const nextBtn = document.getElementById('qp-next');
    const skipBtn = document.getElementById('qp-skip');
    const isLast = state.cursor === total - 1;
    const answered = q && !!state.responses[q.id];

    nextBtn.textContent = isLast
      ? 'Selesai ✓'
      : (q && (q.type === 'tutorial_step' || answered) ? 'Lanjut →' : 'Jawab & Lanjut →');

    // Tutorial steps with an action prompt gate the Lanjut button until the
    // student confirms they tried it (first visit only).
    let gated = false;
    if (q && q.type === 'tutorial_step' && q.payload.action_prompt && !answered && !state.triedActions[q.id]) {
      gated = true;
    }
    nextBtn.disabled = gated;
    nextBtn.title = gated ? 'Klik "Saya sudah mencoba" terlebih dahulu' : '';

    // Skip is for real questions that haven't been answered yet.
    const showSkip = q && !answered && q.type !== 'tutorial_step';
    skipBtn.style.display = showSkip ? '' : 'none';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  window.QuizOverlay = { init };
})();
