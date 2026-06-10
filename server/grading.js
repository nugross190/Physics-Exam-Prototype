// Grade an answer against a question payload. Returns { isCorrect, score, normalized }.
// score: numeric partial score. For complex_mc: 1 pt per option correctly handled (max = options.length),
// -1 for each false-positive or false-negative. For word_bank: 1 pt per correct blank. Min 0.
// For binary types (simple_mc, true_false): 1 or 0. For var_test: null (manual grading).
function gradeAnswer(question, answer) {
  const p = question.payload;
  switch (question.type) {
    case 'simple_mc': {
      const picked = Number(answer);
      const ok = picked === p.answer;
      return { isCorrect: ok, score: ok ? 1 : 0, normalized: picked };
    }
    case 'complex_mc': {
      const picked = Array.isArray(answer) ? [...answer].map(Number).sort((a,b)=>a-b) : [];
      const expected = [...(p.answers || [])].sort((a,b)=>a-b);
      const ok = picked.length === expected.length && picked.every((v,i) => v === expected[i]);
      const totalOptions = (p.options || []).length;
      const pickedSet = new Set(picked);
      const expectedSet = new Set(expected);
      let incorrect = 0;
      for (let i = 0; i < totalOptions; i++) {
        if (expectedSet.has(i) !== pickedSet.has(i)) incorrect++;
      }
      const score = Math.max(0, totalOptions - incorrect);
      return { isCorrect: ok, score, normalized: picked };
    }
    case 'true_false': {
      const picked = (answer === true || answer === 'true' || answer === 1 || answer === '1');
      const ok = picked === !!p.answer;
      return { isCorrect: ok, score: ok ? 1 : 0, normalized: picked };
    }
    case 'word_bank': {
      const picked = Array.isArray(answer) ? answer.map(String) : [];
      const expected = (p.blanks || []).map(String);
      const ok = picked.length === expected.length &&
                 picked.every((v, i) => v.trim().toLowerCase() === expected[i].trim().toLowerCase());
      const score = expected.reduce((sum, exp, i) =>
        sum + (picked[i] && picked[i].trim().toLowerCase() === exp.trim().toLowerCase() ? 1 : 0), 0);
      return { isCorrect: ok, score, normalized: picked };
    }
    case 'table_mc': {
      const picked = Array.isArray(answer) ? answer.map(Number) : [];
      const rows = p.rows || [];
      const ok = rows.length > 0 && rows.every((r, i) => picked[i] === r.answer);
      const score = rows.reduce((sum, r, i) => sum + (picked[i] === r.answer ? 1 : 0), 0);
      return { isCorrect: ok, score, normalized: picked };
    }
    case 'tutorial_step':
      return { isCorrect: true, score: 1, normalized: { acknowledged: true } };
    case 'var_test':
      // Free-form, not auto-graded. Stored only.
      return { isCorrect: null, score: null, normalized: String(answer || '') };
    default:
      return { isCorrect: null, score: null, normalized: answer };
  }
}

const STAGES = ['tutorial', 'var_test', 'inquiry', 'true_false', 'conclusion'];

module.exports = { gradeAnswer, STAGES };
