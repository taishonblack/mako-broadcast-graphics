/**
 * Equal-share defaults for poll answer bars.
 *
 * The preview's bar widths are computed from `votes / totalVotes`. By giving
 * every fresh answer the same `EQUAL_BASE` test-vote count we get a clean
 * 50/50 (2 bars), 33.3/33.3/33.3 (3), or 25/25/25/25 (4) split with zero
 * extra math — the existing chart code keeps working unchanged.
 *
 * When the operator types a custom percentage in the inspector or output,
 * we re-derive `testVotes` from the % values so totals always sum to
 * EQUAL_BASE * answerCount. This keeps every downstream consumer (charts,
 * persistence, test-vote runner) on the same scale.
 */
export const EQUAL_BASE = 1000;

export interface AnswerLite {
  id: string;
  text: string;
  shortLabel: string;
  testVotes?: number;
}

/** Return testVotes that yield exactly equal shares across `count` bars. */
export function equalShareVotes(count: number): number[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, () => EQUAL_BASE);
}

/** Compute % per bar from raw testVotes. Returns 0s if total is 0. */
export function percentsFromAnswers(answers: AnswerLite[]): number[] {
  const total = answers.reduce((s, a) => s + (a.testVotes ?? 0), 0);
  if (total <= 0) return answers.map(() => 0);
  return answers.map((a) => +(((a.testVotes ?? 0) / total) * 100).toFixed(1));
}

/**
 * Re-derive testVotes from percent values so the new answers reflect the
 * desired %s. The total preserved is EQUAL_BASE * count so 1% always means
 * the same number of votes regardless of how many bars exist.
 */
export function answersFromPercents(answers: AnswerLite[], percents: number[]): AnswerLite[] {
  const totalUnits = EQUAL_BASE * Math.max(1, answers.length);
  return answers.map((a, i) => ({
    ...a,
    testVotes: Math.max(0, Math.round((percents[i] ?? 0) / 100 * totalUnits)),
  }));
}

/**
 * Set one bar's % to `value` and rebalance the others proportionally so the
 * sum stays at exactly 100. If the other bars all sit at 0, the remainder is
 * split evenly across them.
 */
export function rebalancePercents(prev: number[], index: number, value: number): number[] {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  if (prev.length <= 1) return [100];
  const next = [...prev];
  next[index] = clamped;
  const remainder = Math.max(0, 100 - clamped);
  const others = prev.map((v, i) => (i === index ? 0 : v));
  const otherSum = others.reduce((s, v) => s + v, 0);
  for (let i = 0; i < next.length; i += 1) {
    if (i === index) continue;
    next[i] = otherSum > 0
      ? +((others[i] / otherSum) * remainder).toFixed(1)
      : +(remainder / (next.length - 1)).toFixed(1);
  }
  // Fix rounding drift on a non-edited slot.
  const drift = +(100 - next.reduce((s, v) => s + v, 0)).toFixed(1);
  if (drift !== 0) {
    const lastOther = next.findIndex((_, i) => i !== index);
    if (lastOther >= 0) next[lastOther] = +(next[lastOther] + drift).toFixed(1);
  }
  return next;
}

/** Build a fresh answer list of `count` bars, each holding EQUAL_BASE votes. */
export function equalShareAnswers(count: number): AnswerLite[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => ({
    id: String(i + 1),
    text: '',
    shortLabel: '',
    testVotes: EQUAL_BASE,
  }));
}
