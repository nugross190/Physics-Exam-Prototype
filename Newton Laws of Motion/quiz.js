// ============================================================
// QUIZ DATA — Edit this section to change quiz content!
// Duplicate this file and modify QUIZ_DATA for different topics.
// ============================================================

const QUIZ_DATA = {

  // ── SIMPLE MULTIPLE CHOICE (single correct answer) ──
  simpleMC: [
    {
      question: "Menurut Hukum Newton I, benda yang diam akan tetap diam kecuali...",
      options: [
        "Ada gaya resultan yang bekerja padanya",
        "Massanya berubah",
        "Gravitasi hilang",
        "Benda tersebut sangat ringan"
      ],
      answer: 0 // index of correct option (0-based)
    },
    {
      question: "Rumus Hukum Newton II adalah...",
      options: [
        "F = m + a",
        "F = m × a",
        "F = m / a",
        "F = m - a"
      ],
      answer: 1
    },
    {
      question: "Jika gaya resultan pada benda nol, maka benda akan...",
      options: [
        "Bergerak semakin cepat",
        "Berhenti seketika",
        "Bergerak dengan kecepatan tetap atau diam",
        "Berubah arah"
      ],
      answer: 2
    }
  ],

  // ── COMPLEX MULTIPLE CHOICE (multiple correct answers) ──
  complexMC: [
    {
      question: "Manakah yang merupakan contoh penerapan Hukum Newton III? (Pilih semua yang benar)",
      options: [
        "Roket mendorong gas ke bawah, gas mendorong roket ke atas",
        "Benda jatuh karena gravitasi",
        "Orang berjalan: kaki mendorong tanah, tanah mendorong kaki",
        "Berenang: tangan mendorong air, air mendorong tubuh"
      ],
      answers: [0, 2, 3] // indices of ALL correct options
    },
    {
      question: "Faktor apa saja yang mempengaruhi percepatan benda? (Pilih semua yang benar)",
      options: [
        "Besar gaya yang bekerja",
        "Warna benda",
        "Massa benda",
        "Bentuk benda di ruang hampa"
      ],
      answers: [0, 2]
    }
  ],

  // ── TRUE / FALSE TABLE ──
  trueFalse: [
    {
      statement: "Gaya aksi dan reaksi bekerja pada benda yang sama.",
      answer: false
    },
    {
      statement: "Massa benda berbanding terbalik dengan percepatannya jika gaya tetap.",
      answer: true
    },
    {
      statement: "Benda yang bergerak dengan kecepatan konstan memiliki percepatan nol.",
      answer: true
    },
    {
      statement: "Hukum Newton I hanya berlaku untuk benda diam.",
      answer: false
    },
    {
      statement: "Semakin besar massa benda, semakin besar gaya yang diperlukan untuk memberikan percepatan yang sama.",
      answer: true
    }
  ],

  // ── WORD BANK (fill in the blanks) ──
  wordBank: [
    {
      // Use {{n}} as blank placeholders in the passage (0-indexed)
      passage: "Hukum Newton I menyatakan bahwa benda akan tetap {{0}} atau bergerak dengan {{1}} kecuali ada {{2}} yang bekerja padanya. Hukum ini juga dikenal sebagai hukum {{3}}.",
      blanks: ["diam", "kecepatan tetap", "gaya resultan", "inersia"],
      // Extra distractor words to make it harder (optional)
      distractors: ["percepatan", "gravitasi"]
    },
    {
      passage: "Menurut Hukum Newton II, percepatan benda berbanding lurus dengan {{0}} dan berbanding terbalik dengan {{1}}. Rumusnya ditulis sebagai {{2}}.",
      blanks: ["gaya resultan", "massa", "F = m × a"],
      distractors: ["kecepatan", "waktu"]
    }
  ]
};


// ============================================================
// QUIZ ENGINE — You typically don't need to edit below this line
// ============================================================

(function () {
  // DOM refs
  const overlay = document.getElementById('quizOverlay');
  const toggleBtn = document.getElementById('quizToggleBtn');
  const closeBtn = document.getElementById('quizCloseBtn');
  const checkBtn = document.getElementById('quizCheckBtn');
  const resetBtn = document.getElementById('quizResetBtn');
  const scoreDisplay = document.getElementById('quizScoreDisplay');
  const tabs = document.querySelectorAll('.quiz-tab');

  // State
  let checked = false;
  let activeBlankIndex = null; // for word bank

  // ── Toggle Modal ──
  toggleBtn.addEventListener('click', () => overlay.classList.remove('hidden'));
  closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });

  // ── Tab Switching ──
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.quiz-content').forEach(c => c.classList.remove('active'));
      document.getElementById('quiz-' + tab.dataset.tab).classList.add('active');
    });
  });

  // ── Check & Reset ──
  checkBtn.addEventListener('click', checkAllAnswers);
  resetBtn.addEventListener('click', resetQuiz);

  // ============================================================
  // RENDERERS
  // ============================================================

  function renderSimpleMC() {
    const container = document.getElementById('quiz-simple-mc');
    container.innerHTML = '';
    QUIZ_DATA.simpleMC.forEach((q, qi) => {
      const card = document.createElement('div');
      card.className = 'quiz-question';
      card.dataset.type = 'simple-mc';
      card.dataset.index = qi;

      card.innerHTML = `
        <div class="q-number">Soal ${qi + 1}</div>
        <div class="q-text">${q.question}</div>
        <div class="mc-options">
          ${q.options.map((opt, oi) => `
            <div class="mc-option" data-option="${oi}">
              <span class="option-marker">${String.fromCharCode(65 + oi)}</span>
              <span>${opt}</span>
            </div>
          `).join('')}
        </div>
        <div class="q-feedback"></div>
      `;

      // Click handler — single select
      card.querySelectorAll('.mc-option').forEach(optEl => {
        optEl.addEventListener('click', () => {
          if (checked) return;
          card.querySelectorAll('.mc-option').forEach(o => o.classList.remove('selected'));
          optEl.classList.add('selected');
        });
      });

      container.appendChild(card);
    });
  }

  function renderComplexMC() {
    const container = document.getElementById('quiz-complex-mc');
    container.innerHTML = '';
    QUIZ_DATA.complexMC.forEach((q, qi) => {
      const card = document.createElement('div');
      card.className = 'quiz-question';
      card.dataset.type = 'complex-mc';
      card.dataset.index = qi;

      card.innerHTML = `
        <div class="q-number">Soal ${qi + 1}</div>
        <div class="q-text">${q.question}</div>
        <div class="mc-options">
          ${q.options.map((opt, oi) => `
            <div class="mc-option" data-option="${oi}">
              <span class="option-marker checkbox">☐</span>
              <span>${opt}</span>
            </div>
          `).join('')}
        </div>
        <div class="q-feedback"></div>
      `;

      // Click handler — multi select toggle
      card.querySelectorAll('.mc-option').forEach(optEl => {
        optEl.addEventListener('click', () => {
          if (checked) return;
          optEl.classList.toggle('selected');
          const marker = optEl.querySelector('.option-marker');
          marker.textContent = optEl.classList.contains('selected') ? '☑' : '☐';
        });
      });

      container.appendChild(card);
    });
  }

  function renderTrueFalse() {
    const container = document.getElementById('quiz-true-false');
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'quiz-question';
    wrapper.dataset.type = 'true-false';

    let rows = QUIZ_DATA.trueFalse.map((item, i) => `
      <tr data-tf-index="${i}">
        <td>${item.statement}</td>
        <td class="tf-cell">
          <button class="tf-btn" data-val="true" onclick="window._tfSelect(${i}, true, this)">B</button>
        </td>
        <td class="tf-cell">
          <button class="tf-btn" data-val="false" onclick="window._tfSelect(${i}, false, this)">S</button>
        </td>
      </tr>
    `).join('');

    wrapper.innerHTML = `
      <div class="q-number">Benar atau Salah</div>
      <table class="tf-table">
        <thead><tr><th>Pernyataan</th><th>Benar</th><th>Salah</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="q-feedback"></div>
    `;

    container.appendChild(wrapper);
  }

  // Global handler for T/F buttons
  window._tfSelect = function (index, value, btn) {
    if (checked) return;
    const row = btn.closest('tr');
    row.querySelectorAll('.tf-btn').forEach(b => {
      b.classList.remove('selected-true', 'selected-false');
    });
    btn.classList.add(value ? 'selected-true' : 'selected-false');
    btn.dataset.selected = 'true';
  };

  function renderWordBank() {
    const container = document.getElementById('quiz-word-bank');
    container.innerHTML = '';

    QUIZ_DATA.wordBank.forEach((q, qi) => {
      const card = document.createElement('div');
      card.className = 'quiz-question';
      card.dataset.type = 'word-bank';
      card.dataset.index = qi;

      // Build passage with blanks
      let passageHTML = q.passage;
      q.blanks.forEach((_, bi) => {
        passageHTML = passageHTML.replace(
          `{{${bi}}}`,
          `<span class="wb-blank" data-blank="${qi}-${bi}" data-q="${qi}" data-b="${bi}" onclick="window._wbBlankClick(this)">___</span>`
        );
      });

      // Shuffle word bank (blanks + distractors)
      let allWords = [...q.blanks, ...(q.distractors || [])];
      allWords = allWords.sort(() => Math.random() - 0.5);

      card.innerHTML = `
        <div class="q-number">Soal ${qi + 1}</div>
        <div class="wb-passage">${passageHTML}</div>
        <div class="wb-bank" data-bank="${qi}">
          ${allWords.map(w => `
            <button class="wb-word" data-word="${w}" onclick="window._wbWordClick(${qi}, '${w.replace(/'/g, "\\'")}', this)">${w}</button>
          `).join('')}
        </div>
        <div class="q-feedback"></div>
      `;

      container.appendChild(card);
    });
  }

  // Word bank click handlers
  window._wbBlankClick = function (blankEl) {
    if (checked) return;
    // If blank already has a word, return it to the bank
    const qi = parseInt(blankEl.dataset.q);
    const currentWord = blankEl.dataset.currentWord;
    if (currentWord) {
      // Return to bank
      const bank = document.querySelector(`.wb-bank[data-bank="${qi}"]`);
      const wordBtn = bank.querySelector(`.wb-word[data-word="${currentWord}"]`);
      if (wordBtn) wordBtn.classList.remove('used');
      blankEl.textContent = '___';
      blankEl.classList.remove('filled');
      delete blankEl.dataset.currentWord;
    }
    // Set as active blank
    document.querySelectorAll('.wb-blank').forEach(b => b.classList.remove('active-blank'));
    blankEl.classList.add('active-blank');
    activeBlankIndex = blankEl.dataset.blank;
  };

  window._wbWordClick = function (qi, word, btn) {
    if (checked) return;
    // Find active blank in this question, or first empty blank
    let targetBlank = null;
    if (activeBlankIndex) {
      targetBlank = document.querySelector(`.wb-blank[data-blank="${activeBlankIndex}"]`);
      if (targetBlank && parseInt(targetBlank.dataset.q) !== qi) targetBlank = null;
    }
    if (!targetBlank) {
      // Find first empty blank in this question
      const blanks = document.querySelectorAll(`.wb-blank[data-q="${qi}"]`);
      for (const b of blanks) {
        if (!b.dataset.currentWord) { targetBlank = b; break; }
      }
    }
    if (!targetBlank) return;

    // If blank already has a word, return it
    if (targetBlank.dataset.currentWord) {
      const oldWord = targetBlank.dataset.currentWord;
      const bank = document.querySelector(`.wb-bank[data-bank="${qi}"]`);
      const oldBtn = bank.querySelector(`.wb-word[data-word="${oldWord}"]`);
      if (oldBtn) oldBtn.classList.remove('used');
    }

    targetBlank.textContent = word;
    targetBlank.classList.add('filled');
    targetBlank.dataset.currentWord = word;
    btn.classList.add('used');

    // Move active to next empty blank
    targetBlank.classList.remove('active-blank');
    const blanks = document.querySelectorAll(`.wb-blank[data-q="${qi}"]`);
    let foundNext = false;
    for (const b of blanks) {
      if (!b.dataset.currentWord) {
        b.classList.add('active-blank');
        activeBlankIndex = b.dataset.blank;
        foundNext = true;
        break;
      }
    }
    if (!foundNext) activeBlankIndex = null;
  };

  // ============================================================
  // CHECK ANSWERS
  // ============================================================

  function checkAllAnswers() {
    checked = true;
    let totalScore = 0;
    let totalQuestions = 0;

    // ── Simple MC ──
    QUIZ_DATA.simpleMC.forEach((q, qi) => {
      totalQuestions++;
      const card = document.querySelector(`.quiz-question[data-type="simple-mc"][data-index="${qi}"]`);
      const selected = card.querySelector('.mc-option.selected');
      const correctIdx = q.answer;
      const feedback = card.querySelector('.q-feedback');

      // Highlight correct
      card.querySelectorAll('.mc-option')[correctIdx].classList.add('correct-answer');

      if (selected) {
        const selectedIdx = parseInt(selected.dataset.option);
        if (selectedIdx === correctIdx) {
          totalScore++;
          card.classList.add('correct');
          feedback.textContent = '✓ Benar!';
          feedback.className = 'q-feedback show correct';
        } else {
          selected.classList.add('wrong-answer');
          card.classList.add('wrong');
          feedback.textContent = '✗ Salah. Jawaban yang benar: ' + q.options[correctIdx];
          feedback.className = 'q-feedback show wrong';
        }
      } else {
        card.classList.add('wrong');
        feedback.textContent = '✗ Belum dijawab. Jawaban: ' + q.options[correctIdx];
        feedback.className = 'q-feedback show wrong';
      }
    });

    // ── Complex MC ──
    QUIZ_DATA.complexMC.forEach((q, qi) => {
      totalQuestions++;
      const card = document.querySelector(`.quiz-question[data-type="complex-mc"][data-index="${qi}"]`);
      const selectedEls = card.querySelectorAll('.mc-option.selected');
      const selectedIdxs = Array.from(selectedEls).map(el => parseInt(el.dataset.option));
      const correctIdxs = q.answers;
      const feedback = card.querySelector('.q-feedback');

      // Highlight correct answers
      correctIdxs.forEach(ci => {
        card.querySelectorAll('.mc-option')[ci].classList.add('correct-answer');
      });

      // Highlight wrong selections
      selectedIdxs.forEach(si => {
        if (!correctIdxs.includes(si)) {
          card.querySelectorAll('.mc-option')[si].classList.add('wrong-answer');
        }
      });

      const isCorrect =
        selectedIdxs.length === correctIdxs.length &&
        correctIdxs.every(ci => selectedIdxs.includes(ci));

      if (isCorrect) {
        totalScore++;
        card.classList.add('correct');
        feedback.textContent = '✓ Benar! Semua jawaban tepat.';
        feedback.className = 'q-feedback show correct';
      } else {
        card.classList.add('wrong');
        const correctTexts = correctIdxs.map(ci => q.options[ci]).join(', ');
        feedback.textContent = '✗ Jawaban yang benar: ' + correctTexts;
        feedback.className = 'q-feedback show wrong';
      }
    });

    // ── True / False ──
    let tfCorrectCount = 0;
    QUIZ_DATA.trueFalse.forEach((item, i) => {
      const row = document.querySelector(`tr[data-tf-index="${i}"]`);
      const btns = row.querySelectorAll('.tf-btn');
      let userAnswer = null;

      btns.forEach(btn => {
        if (btn.dataset.selected === 'true') {
          userAnswer = btn.dataset.val === 'true';
        }
      });

      const correctVal = item.answer;
      btns.forEach(btn => {
        const btnVal = btn.dataset.val === 'true';
        if (btnVal === correctVal) {
          btn.classList.add('feedback-correct');
        }
        if (btn.dataset.selected === 'true' && userAnswer !== correctVal) {
          btn.classList.add('feedback-wrong');
        }
      });

      if (userAnswer === correctVal) tfCorrectCount++;
    });

    totalQuestions++;
    if (tfCorrectCount === QUIZ_DATA.trueFalse.length) {
      totalScore++;
      const tfCard = document.querySelector('.quiz-question[data-type="true-false"]');
      tfCard.classList.add('correct');
      const fb = tfCard.querySelector('.q-feedback');
      fb.textContent = `✓ Sempurna! ${tfCorrectCount}/${QUIZ_DATA.trueFalse.length} benar.`;
      fb.className = 'q-feedback show correct';
    } else {
      const tfCard = document.querySelector('.quiz-question[data-type="true-false"]');
      tfCard.classList.add('wrong');
      const fb = tfCard.querySelector('.q-feedback');
      fb.textContent = `✗ ${tfCorrectCount}/${QUIZ_DATA.trueFalse.length} benar.`;
      fb.className = 'q-feedback show wrong';
    }

    // ── Word Bank ──
    QUIZ_DATA.wordBank.forEach((q, qi) => {
      totalQuestions++;
      const card = document.querySelector(`.quiz-question[data-type="word-bank"][data-index="${qi}"]`);
      const blanks = card.querySelectorAll('.wb-blank');
      let allCorrect = true;
      const feedback = card.querySelector('.q-feedback');

      blanks.forEach((blank, bi) => {
        const userWord = blank.dataset.currentWord || '';
        const correctWord = q.blanks[bi];
        if (userWord === correctWord) {
          blank.classList.add('correct-fill');
        } else {
          blank.classList.add('wrong-fill');
          if (!blank.dataset.currentWord) blank.textContent = `[${correctWord}]`;
          allCorrect = false;
        }
      });

      if (allCorrect) {
        totalScore++;
        card.classList.add('correct');
        feedback.textContent = '✓ Benar! Semua isian tepat.';
        feedback.className = 'q-feedback show correct';
      } else {
        card.classList.add('wrong');
        feedback.textContent = '✗ Ada isian yang salah. Jawaban benar ditunjukkan di atas.';
        feedback.className = 'q-feedback show wrong';
      }
    });

    scoreDisplay.textContent = `${totalScore} / ${totalQuestions}`;
  }

  // ============================================================
  // RESET
  // ============================================================

  function resetQuiz() {
    checked = false;
    activeBlankIndex = null;
    scoreDisplay.textContent = '0 / 0';
    renderAll();
  }

  // ============================================================
  // INIT
  // ============================================================

  function renderAll() {
    renderSimpleMC();
    renderComplexMC();
    renderTrueFalse();
    renderWordBank();
  }

  renderAll();
})();
