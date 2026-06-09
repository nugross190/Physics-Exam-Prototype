// Floating quiz overlay. Renders stages: tutorial → var_test → inquiry → true_false → conclusion.
// Talks to /api/quest/* endpoints via window.API.

(function () {
  const STAGES = ['tutorial', 'var_test', 'inquiry', 'true_false', 'conclusion'];
  const STAGE_LABEL = {
    tutorial: 'Tutorial',
    var_test: 'Uji Variabel',
    inquiry: 'Inkuiri',
    true_false: 'Benar/Salah',
    conclusion: 'Kesimpulan'
  };

  const state = {
    simKey: null,
    title: '',
    questions: [],
    responses: {}, // question_id → { answer, is_correct }
    currentStage: 'tutorial',
    cursor: 0,
    open: true,
    answeredNow: null,
    startTs: 0
  };

  let root, panel, fab;

  async function init(simKey) {
    state.simKey = simKey;
    const data = await API.get(`/api/quest/sim/${encodeURIComponent(simKey)}`);
    state.title = data.sim.title;
    state.questions = data.questions;
    for (const r of data.responses || []) state.responses[r.question_id] = r;
    state.currentStage = data.current_stage || 'tutorial';
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

    // FAB only needed in mobile/floating mode
    const fabHtml = `<button id="quiz-fab" title="Buka Quiz">📝<span class="badge" id="quiz-fab-badge"></span></button>`;

    const panelHtml = `
      <div id="quiz-panel">
        <div class="qp-header" id="qp-header">
          <div class="qp-title">📝 <span id="qp-sim-title"></span></div>
          <div class="qp-actions">
            ${split ? '' : '<button id="qp-min" title="Minimize">–</button>'}
          </div>
        </div>
        <div class="qp-stages" id="qp-stages"></div>
        <div class="qp-body" id="qp-body"></div>
        <div class="qp-footer">
          <div class="progress" id="qp-progress"></div>
          <div class="btns">
            <button class="qp-btn secondary" id="qp-prev">← Sebelumnya</button>
            <button class="qp-btn" id="qp-next">Lanjut →</button>
          </div>
        </div>
      </div>
    `;

    if (split) {
      // Desktop: panel lives inside #quiz-pane
      const pane = document.getElementById('quiz-pane');
      pane.innerHTML = panelHtml;
      // FAB still appended to body for the resize edge-case
      const fabEl = document.createElement('div');
      fabEl.innerHTML = fabHtml;
      document.body.appendChild(fabEl);
    } else {
      // Mobile: everything floats over the sim
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
    document.getElementById('qp-next').addEventListener('click', () => onNext());

    if (!split) enableDrag();
    togglePanel(true);

    // Re-evaluate on resize so crossing the breakpoint works
    window.addEventListener('resize', () => updateBadge());
  }

  function togglePanel(open) {
    state.open = open;
    if (isSplitMode()) {
      // In split mode, toggling is handled by the topbar button collapsing the pane
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

  function questionsInStage(stage) {
    return state.questions.filter(q => q.stage === stage);
  }
  function stageDone(stage) {
    const qs = questionsInStage(stage);
    return qs.length > 0 && qs.every(q => state.responses[q.id]);
  }
  function currentQuestion() {
    const qs = questionsInStage(state.currentStage);
    return qs[state.cursor];
  }

  function jumpToFirstUnanswered() {
    for (const stage of STAGES) {
      const qs = questionsInStage(stage);
      for (let i = 0; i < qs.length; i++) {
        if (!state.responses[qs[i].id]) {
          state.currentStage = stage;
          state.cursor = i;
          state.startTs = Date.now();
          return;
        }
      }
    }
    // All done — sit on conclusion last
    state.currentStage = 'conclusion';
    state.cursor = Math.max(0, questionsInStage('conclusion').length - 1);
  }

  function render() {
    renderStages();
    renderBody();
    renderFooter();
    updateBadge();
  }

  function renderStages() {
    const el = document.getElementById('qp-stages');
    el.innerHTML = STAGES.map(s => {
      const qs = questionsInStage(s);
      if (!qs.length) return '';
      const done = stageDone(s);
      const active = s === state.currentStage;
      return `<div class="qp-stage-chip ${active ? 'active' : ''} ${done ? 'done' : ''}" data-stage="${s}">${STAGE_LABEL[s]}</div>`;
    }).join('');
    el.querySelectorAll('.qp-stage-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const stage = chip.dataset.stage;
        // Can only jump to stages that are done or current
        if (stage === state.currentStage || stageDone(stage)) {
          state.currentStage = stage;
          state.cursor = 0;
          state.answeredNow = null;
          state.startTs = Date.now();
          render();
        }
      });
    });
  }

  function renderBody() {
    const body = document.getElementById('qp-body');
    const q = currentQuestion();
    if (!q) {
      body.innerHTML = `<div class="feedback info">Tidak ada soal pada tahap ini.</div>`;
      return;
    }
    state.startTs = state.startTs || Date.now();
    const existing = state.responses[q.id];
    const stageLabel = STAGE_LABEL[q.stage];
    const idx = questionsInStage(q.stage).findIndex(x => x.id === q.id);
    const total = questionsInStage(q.stage).length;

    let html = `<h3>${stageLabel} ${idx+1}/${total}</h3>`;
    const p = q.payload;

    if (q.type === 'tutorial_step') {
      html += `<div class="q-text"><strong>${escapeHtml(p.title || '')}</strong></div><div>${escapeHtml(p.body || '')}</div>`;
      html += `<div class="feedback info">Baca penjelasan di atas, lalu klik "Lanjut →" untuk melanjutkan.</div>`;
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
    }

    if (existing && existing.is_correct === true)  html += `<div class="feedback ok">✓ Jawaban tersimpan (benar).</div>`;
    if (existing && existing.is_correct === false) html += `<div class="feedback no">✗ Jawaban tersimpan (perlu diperbaiki).</div>`;
    if (existing && existing.is_correct === null)  html += `<div class="feedback info">✓ Jawaban tersimpan.</div>`;

    body.innerHTML = html;
    wireBodyInteractions(q);
  }

  function renderWordBankTemplate(template) {
    // template like "Hukum Newton II ... __1__ ... __2__ ..."
    return template.replace(/__([0-9]+)__/g, (m, n) => {
      return `<span class="wb-input" data-blank="${parseInt(n,10)-1}"></span>`;
    });
  }

  function wireBodyInteractions(q) {
    if (q.type === 'simple_mc') {
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
    if (q.type === 'true_false') {
      document.querySelectorAll('.option').forEach(el => {
        el.addEventListener('click', () => {
          document.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
          el.classList.add('selected');
          el.querySelector('input').checked = true;
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
        // Free previously placed word in this blank
        const prev = activeBlank.textContent.trim();
        if (prev) {
          const prevWord = Array.from(words).find(x => x.dataset.w === prev && x.classList.contains('used'));
          if (prevWord) prevWord.classList.remove('used');
        }
        activeBlank.textContent = w.dataset.w;
        activeBlank.classList.add('filled');
        w.classList.add('used');
        // advance
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
    return null;
  }

  function answerIsEmpty(q, ans) {
    if (q.type === 'tutorial_step') return false;
    if (q.type === 'var_test') return !ans;
    if (q.type === 'simple_mc') return ans === null;
    if (q.type === 'complex_mc') return !ans || ans.length === 0;
    if (q.type === 'true_false') return ans === null;
    if (q.type === 'word_bank') return !ans || ans.some(x => !x);
    return true;
  }

  async function submitCurrent() {
    const q = currentQuestion();
    if (!q) return;
    const ans = readAnswer(q);
    if (answerIsEmpty(q, ans)) {
      alert('Jawaban belum diisi.');
      return false;
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
    move(1);
  }

  async function move(delta) {
    const qs = questionsInStage(state.currentStage);
    let next = state.cursor + delta;
    if (next >= qs.length) {
      // advance stage
      const i = STAGES.indexOf(state.currentStage);
      const nextStage = STAGES.slice(i+1).find(s => questionsInStage(s).length > 0);
      if (nextStage) {
        state.currentStage = nextStage;
        state.cursor = 0;
      } else {
        await tryComplete();
        return;
      }
    } else if (next < 0) {
      const i = STAGES.indexOf(state.currentStage);
      const prevStage = STAGES.slice(0, i).reverse().find(s => questionsInStage(s).length > 0);
      if (prevStage) {
        state.currentStage = prevStage;
        state.cursor = Math.max(0, questionsInStage(prevStage).length - 1);
      } else { return; }
    } else {
      state.cursor = next;
    }
    state.startTs = Date.now();
    render();
  }

  async function tryComplete() {
    try {
      const r = await API.post(`/api/quest/sim/${encodeURIComponent(state.simKey)}/complete`, {});
      const body = document.getElementById('qp-body');
      body.innerHTML = `
        <div class="feedback ok"><strong>✓ Simulasi selesai!</strong></div>
        <p>Semua tahap telah dijawab. ${r.next_sim ? 'Simulasi berikutnya sudah terbuka.' : 'Kamu telah menyelesaikan seluruh rangkaian ujian!'}</p>
        <button class="qp-btn" onclick="window.location.href='/dashboard.html'">Kembali ke Dashboard</button>
      `;
    } catch (err) {
      alert('Belum bisa menyelesaikan: ' + err.message);
    }
  }

  function renderFooter() {
    const total = state.questions.length;
    const done = Object.keys(state.responses).length;
    document.getElementById('qp-progress').textContent = `${done}/${total} soal terjawab`;
    const q = currentQuestion();
    const nextBtn = document.getElementById('qp-next');
    const lastStage = STAGES.slice().reverse().find(s => questionsInStage(s).length > 0);
    const isLast = q && state.cursor === questionsInStage(state.currentStage).length - 1 && state.currentStage === lastStage;
    nextBtn.textContent = isLast ? 'Selesai ✓' : (q && q.type === 'tutorial_step' ? 'Lanjut →' : (state.responses[q?.id] ? 'Lanjut →' : 'Jawab & Lanjut →'));
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  window.QuizOverlay = { init };
})();
