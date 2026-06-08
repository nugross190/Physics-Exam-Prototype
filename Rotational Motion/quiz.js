// ============================================================
// QUIZ DATA — Rotational Dynamics & Angular Momentum Topic
// ============================================================

const QUIZ_DATA = {

  // ── SIMPLE MULTIPLE CHOICE (single correct answer) ──
  simpleMC: [
    {
      question: "Sebuah beban menggantung memberikan gaya tarik pada gandar propeller. Besarnya torsi (&tau;) yang bekerja pada gandar sebanding dengan...",
      options: [
        "Massa beban menggantung (m) dan radius gandar (r)",
        "Panjang bilah propeller (L) dan massa bilah (mb)",
        "Hanya massa beban menggantung (m) saja",
        "Hanya radius gandar (r) saja"
      ],
      answer: 0 // index of correct option
    },
    {
      question: "Jika massa bilah propeller (mb) diperbesar tanpa mengubah panjang bilahnya, maka momen inersia (I) sistem akan...",
      options: [
        "Meningkat",
        "Menurun",
        "Tetap sama",
        "Menjadi nol"
      ],
      answer: 0
    },
    {
      question: "Ketika bilah propeller ditarik ke dalam (panjang bilah L diperkecil) pada Fase 3, kecepatan sudutnya (&omega;) meningkat karena...",
      options: [
        "Momentum sudut awal dipertahankan sementara momen inersia sistem mengecil",
        "Torsi eksternal dari massa menggantung meningkat",
        "Massa bilah bertambah secara otomatis",
        "Gaya gravitasi bumi pada bilah berubah"
      ],
      answer: 0
    }
  ],

  // ── COMPLEX MULTIPLE CHOICE (multiple correct answers) ──
  complexMC: [
    {
      question: "Manakah dari pernyataan berikut yang benar mengenai Hukum Kekekalan Momentum Sudut? (Pilih semua yang benar)",
      options: [
        "Momentum sudut sistem konstan jika tidak ada torsi luar yang bekerja",
        "Jika momen inersia bertambah, kecepatan sudut harus berkurang untuk mempertahankan momentum sudut",
        "Kecepatan sudut akan selalu konstan dalam setiap kondisi rotasi",
        "Momentum sudut didefinisikan sebagai hasil kali momen inersia dengan kecepatan sudut (L = I &times; &omega;)"
      ],
      answers: [0, 1, 3] // indices of ALL correct options
    },
    {
      question: "Faktor-faktor apa saja yang secara langsung menentukan momen inersia (I) propeller pada simulasi ini? (Pilih semua yang benar)",
      options: [
        "Massa bilah propeller (mb)",
        "Panjang bilah propeller (L)",
        "Massa beban menggantung (m)",
        "Radius gandar gasing (r)"
      ],
      answers: [0, 1]
    }
  ],

  // ── TRUE / FALSE TABLE ──
  trueFalse: [
    {
      statement: "Torsi yang dihasilkan oleh beban jatuh tetap bekerja pada gandar selama Fase 2 (Layap).",
      answer: false
    },
    {
      statement: "Momen inersia sistem berbanding lurus dengan kuadrat panjang bilah (L²).",
      answer: true
    },
    {
      statement: "Ketika tidak ada torsi luar yang bekerja pada sistem (Fase 3), momentum sudut sistem (L) selalu konstan.",
      answer: true
    },
    {
      statement: "Mengecilkan panjang bilah (L) akan meningkatkan momen inersia sistem.",
      answer: false
    },
    {
      statement: "Pada Fase 1, percepatan sudut (&alpha;) konstan jika parameter m, r, dan mb tidak diubah.",
      answer: true
    }
  ],

  // ── WORD BANK (fill in the blanks) ──
  wordBank: [
    {
      passage: "Pada Fase 1, beban menggantung memberikan gaya tarik yang menghasilkan {{0}} pada gandar. Hal ini menyebabkan sistem mengalami {{1}} sudut, sehingga kecepatan sudutnya terus bertambah. Setelah beban menyentuh lantai, torsi menjadi {{2}} dan sistem masuk ke fase {{3}} dengan kecepatan sudut konstan.",
      blanks: ["torsi", "percepatan", "nol", "layap"],
      distractors: ["momentum", "perlambatan"]
    },
    {
      passage: "Hukum kekekalan {{0}} sudut menyatakan bahwa jika tidak ada torsi luar, nilai L akan tetap. Saat panjang bilah diperkecil, momen {{1}} sistem akan mengecil, sehingga kecepatan sudut sistem akan {{2}} sesuai dengan persamaan {{3}}.",
      blanks: ["momentum", "inersia", "meningkat", "L = I x &omega;"],
      distractors: ["gaya", "menurun"]
    }
  ]
};


// ============================================================
// QUIZ ENGINE — Handles modal rendering, scoring, and feedback
// ============================================================

(function () {
  const overlay = document.getElementById('quizOverlay');
  const toggleBtn = document.getElementById('quizToggleBtn');
  const closeBtn = document.getElementById('quizCloseBtn');
  const checkBtn = document.getElementById('quizCheckBtn');
  const resetBtn = document.getElementById('quizResetBtn');
  const scoreDisplay = document.getElementById('quizScoreDisplay');
  const tabs = document.querySelectorAll('.quiz-tab');

  let checked = false;
  let activeBlankIndex = null; 

  // Toggle Modal
  toggleBtn.addEventListener('click', () => overlay.classList.remove('hidden'));
  closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });

  // Tab Switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.quiz-content').forEach(c => c.classList.remove('active'));
      document.getElementById('quiz-' + tab.dataset.tab).classList.add('active');
    });
  });

  checkBtn.addEventListener('click', checkAllAnswers);
  resetBtn.addEventListener('click', resetQuiz);

  // ── Renderers ──

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

  window._tfSelect = function (index, value, btn) {
    if (checked) return;
    const row = btn.closest('tr');
    row.querySelectorAll('.tf-btn').forEach(b => {
      b.classList.remove('selected-true', 'selected-false');
      b.dataset.selected = 'false';
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

      let passageHTML = q.passage;
      q.blanks.forEach((_, bi) => {
        passageHTML = passageHTML.replace(
          `{{${bi}}}`,
          `<span class="wb-blank" data-blank="${qi}-${bi}" data-q="${qi}" data-b="${bi}" onclick="window._wbBlankClick(this)">___</span>`
        );
      });

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

  window._wbBlankClick = function (blankEl) {
    if (checked) return;
    const qi = parseInt(blankEl.dataset.q);
    const currentWord = blankEl.dataset.currentWord;
    if (currentWord) {
      const bank = document.querySelector(`.wb-bank[data-bank="${qi}"]`);
      const wordBtn = bank.querySelector(`.wb-word[data-word="${currentWord}"]`);
      if (wordBtn) wordBtn.classList.remove('used');
      blankEl.textContent = '___';
      blankEl.classList.remove('filled');
      delete blankEl.dataset.currentWord;
    }
    document.querySelectorAll('.wb-blank').forEach(b => b.classList.remove('active-blank'));
    blankEl.classList.add('active-blank');
    activeBlankIndex = blankEl.dataset.blank;
  };

  window._wbWordClick = function (qi, word, btn) {
    if (checked) return;
    let targetBlank = null;
    if (activeBlankIndex) {
      targetBlank = document.querySelector(`.wb-blank[data-blank="${activeBlankIndex}"]`);
      if (targetBlank && parseInt(targetBlank.dataset.q) !== qi) targetBlank = null;
    }
    if (!targetBlank) {
      const blanks = document.querySelectorAll(`.wb-blank[data-q="${qi}"]`);
      for (const b of blanks) {
        if (!b.dataset.currentWord) { targetBlank = b; break; }
      }
    }
    if (!targetBlank) return;

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

  // ── Check Answers ──

  function checkAllAnswers() {
    checked = true;
    let totalScore = 0;
    let totalQuestions = 0;

    // Simple MC
    QUIZ_DATA.simpleMC.forEach((q, qi) => {
      totalQuestions++;
      const card = document.querySelector(`.quiz-question[data-type="simple-mc"][data-index="${qi}"]`);
      const selected = card.querySelector('.mc-option.selected');
      const correctIdx = q.answer;
      const feedback = card.querySelector('.q-feedback');

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
          feedback.textContent = '✗ Salah. Jawaban benar: ' + q.options[correctIdx];
          feedback.className = 'q-feedback show wrong';
        }
      } else {
        card.classList.add('wrong');
        feedback.textContent = '✗ Belum dijawab. Jawaban benar: ' + q.options[correctIdx];
        feedback.className = 'q-feedback show wrong';
      }
    });

    // Complex MC
    QUIZ_DATA.complexMC.forEach((q, qi) => {
      totalQuestions++;
      const card = document.querySelector(`.quiz-question[data-type="complex-mc"][data-index="${qi}"]`);
      const selectedEls = card.querySelectorAll('.mc-option.selected');
      const selectedIdxs = Array.from(selectedEls).map(el => parseInt(el.dataset.option));
      const correctIdxs = q.answers;
      const feedback = card.querySelector('.q-feedback');

      correctIdxs.forEach(ci => {
        card.querySelectorAll('.mc-option')[ci].classList.add('correct-answer');
      });

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
        feedback.textContent = '✗ Jawaban benar: ' + correctTexts;
        feedback.className = 'q-feedback show wrong';
      }
    });

    // True / False
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
    const tfCard = document.querySelector('.quiz-question[data-type="true-false"]');
    const tfFeedback = tfCard.querySelector('.q-feedback');
    if (tfCorrectCount === QUIZ_DATA.trueFalse.length) {
      totalScore++;
      tfCard.classList.add('correct');
      tfFeedback.textContent = `✓ Sempurna! Semua ${tfCorrectCount} pernyataan benar.`;
      tfFeedback.className = 'q-feedback show correct';
    } else {
      tfCard.classList.add('wrong');
      tfFeedback.textContent = `✗ Hanya ${tfCorrectCount} dari ${QUIZ_DATA.trueFalse.length} benar.`;
      tfFeedback.className = 'q-feedback show wrong';
    }

    // Word Bank
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
        feedback.textContent = '✗ Ada isian salah. Jawaban benar ditunjukkan di atas.';
        feedback.className = 'q-feedback show wrong';
      }
    });

    scoreDisplay.textContent = `${totalScore} / ${totalQuestions}`;
  }

  // ── Reset ──

  function resetQuiz() {
    checked = false;
    activeBlankIndex = null;
    scoreDisplay.textContent = '0 / 0';
    renderAll();
  }

  function renderAll() {
    renderSimpleMC();
    renderComplexMC();
    renderTrueFalse();
    renderWordBank();
  }

  renderAll();
})();
