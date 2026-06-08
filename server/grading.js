// Grade an answer against a question payload. Returns { isCorrect, normalized }.
function gradeAnswer(question, answer) {
  const p = question.payload;
  switch (question.type) {
    case 'simple_mc': {
      const picked = Number(answer);
      return { isCorrect: picked === p.answer, normalized: picked };
    }
    case 'complex_mc': {
      const picked = Array.isArray(answer) ? [...answer].map(Number).sort((a,b)=>a-b) : [];
      const expected = [...(p.answers || [])].sort((a,b)=>a-b);
      const ok = picked.length === expected.length && picked.every((v,i) => v === expected[i]);
      return { isCorrect: ok, normalized: picked };
    }
    case 'true_false': {
      const picked = (answer === true || answer === 'true' || answer === 1 || answer === '1');
      return { isCorrect: picked === !!p.answer, normalized: picked };
    }
    case 'word_bank': {
      const picked = Array.isArray(answer) ? answer.map(String) : [];
      const expected = (p.blanks || []).map(String);
      const ok = picked.length === expected.length &&
                 picked.every((v, i) => v.trim().toLowerCase() === expected[i].trim().toLowerCase());
      return { isCorrect: ok, normalized: picked };
    }
    case 'tutorial_step':
      return { isCorrect: true, normalized: { acknowledged: true } };
    case 'var_test':
      // Free-form, not auto-graded. Stored only.
      return { isCorrect: null, normalized: String(answer || '') };
    default:
      return { isCorrect: null, normalized: answer };
  }
}

const STAGES = ['tutorial', 'var_test', 'inquiry', 'true_false', 'conclusion'];

module.exports = { gradeAnswer, STAGES };
