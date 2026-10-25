/**
 * Judges an experience requirement against the CV's experience facts. Prefers "unknown" over a doubtful "met".
 */
import { result, type AtomResult, type ExperienceAtom } from './atoms.js';
import { formatMonths, totalMonths } from './dates.js';
import type { ExperienceFacts, ExplicitYears, Job } from './experience.js';
import { matchesField, type FieldSpec } from './fields.js';
import { joinEvidence, snippet } from './text-match.js';

function wanted(atom: ExperienceAtom): string {
  const field = atom.field && atom.field !== 'related' ? ` ${atom.field.label}` : '';
  return atom.minMonths <= 1 ? `có kinh nghiệm${field}` : `từ ${formatMonths(atom.minMonths)}${field}`;
}

function sumMonths(jobs: readonly Job[]): number {
  return totalMonths(jobs.map((j) => j.interval));
}

function jobEvidence(jobs: readonly Job[]): string | null {
  const longest = [...jobs].sort(
    (a, b) => b.interval.endMonth - b.interval.startMonth - (a.interval.endMonth - a.interval.startMonth),
  );
  return joinEvidence(
    longest.slice(0, 2).flatMap((j) => [...(j.title ? [snippet(j.title)] : []), snippet(j.line, j.interval)]),
  );
}

function bestExplicit(list: readonly ExplicitYears[]): ExplicitYears | null {
  return list.reduce<ExplicitYears | null>((best, e) => (best && best.months >= e.months ? best : e), null);
}

interface Tally {
  jobs: Job[];
  strong: number;
  withInterns: number;
  explicit: ExplicitYears | null;
}

function tally(facts: ExperienceFacts, field: FieldSpec | null): Tally {
  const jobs = field ? facts.jobs.filter((j) => matchesField(j.blockFolded, field)) : facts.jobs;
  const explicitList = field ? facts.explicit.filter((e) => matchesField(e.tail.slice(0, 60), field)) : facts.explicit;
  return {
    jobs,
    strong: sumMonths(jobs.filter((j) => !j.isInternship)),
    withInterns: sumMonths(jobs),
    explicit: bestExplicit(explicitList),
  };
}

function metResult(t: Tally, atom: ExperienceAtom): AtomResult | null {
  const explicitMonths = t.explicit?.months ?? 0;
  const best = Math.max(t.strong, explicitMonths);
  if (best < atom.minMonths) return null;
  const merged =
    t.jobs.length > 1 && t.jobs.reduce((s, j) => s + j.interval.endMonth - j.interval.startMonth, 0) > t.withInterns;
  const fromJobs = t.strong >= explicitMonths;
  const evidence = fromJobs
    ? jobEvidence(t.jobs.filter((j) => !j.isInternship))
    : t.explicit
      ? snippet(t.explicit.line, t.explicit.span)
      : null;
  const note = fromJobs && merged ? ' (đã gộp các khoảng thời gian trùng nhau)' : '';
  return result('met', `CV có khoảng ${formatMonths(best)} kinh nghiệm${note}, yêu cầu ${wanted(atom)}`, evidence);
}

function noData(facts: ExperienceFacts, atom: ExperienceAtom): AtomResult | null {
  if (facts.jobs.length > 0 || facts.explicit.length > 0) return null;
  if (facts.noExperience) {
    return result('unmet', `CV ghi chưa có kinh nghiệm, yêu cầu ${wanted(atom)}`, snippet(facts.noExperience));
  }
  return result('unknown', 'CV không ghi rõ thời gian làm việc, HR xem trực tiếp');
}

function overall(facts: ExperienceFacts): number {
  return Math.max(sumMonths(facts.jobs), bestExplicit(facts.explicit)?.months ?? 0);
}

function fieldShortfall(facts: ExperienceFacts, atom: ExperienceAtom, field: FieldSpec, t: Tally): AtomResult {
  const total = overall(facts);
  const hasFieldEvidence = t.jobs.length > 0 || t.explicit !== null;
  if (!hasFieldEvidence && facts.jobs.length === 0) {
    if (total < atom.minMonths)
      return result('unmet', `CV ghi ${formatMonths(total)} kinh nghiệm, yêu cầu ${wanted(atom)}`);
    return result(
      'unknown',
      `CV ghi ${formatMonths(total)} kinh nghiệm nhưng không rõ bao nhiêu ở mảng ${field.label}`,
    );
  }
  const got = Math.max(t.strong, t.explicit?.months ?? 0);
  const evidence = jobEvidence(t.jobs) ?? jobEvidence(facts.jobs);
  const reason = hasFieldEvidence
    ? `CV có khoảng ${formatMonths(got)} kinh nghiệm ${field.label} (tổng ${formatMonths(total)}), yêu cầu ${wanted(atom)}`
    : `Không thấy công việc nào về ${field.label} trong CV (tổng ${formatMonths(total)} kinh nghiệm), yêu cầu ${wanted(atom)}`;
  return result('unmet', reason, evidence);
}

/** Experience requirement verdict. */
export function evaluateExperience(atom: ExperienceAtom, facts: ExperienceFacts): AtomResult {
  const empty = noData(facts, atom);
  if (empty) return empty;
  const field = atom.field === 'related' ? null : atom.field;
  const t = atom.field === 'related' ? { jobs: [], strong: 0, withInterns: 0, explicit: null } : tally(facts, field);
  const met = metResult(t, atom);
  if (met) return met;
  if (t.withInterns >= atom.minMonths) {
    return result(
      'unknown',
      `Đủ ${formatMonths(t.withInterns)} nếu tính cả thực tập, yêu cầu ${wanted(atom)}`,
      jobEvidence(t.jobs),
    );
  }
  const total = overall(facts);
  if (atom.field === 'related') {
    if (total < atom.minMonths)
      return result(
        'unmet',
        `CV ghi ${formatMonths(total)} kinh nghiệm, yêu cầu ${wanted(atom)}`,
        jobEvidence(facts.jobs),
      );
    return result(
      'unknown',
      `CV có ${formatMonths(total)} kinh nghiệm, HR xem có đúng vị trí liên quan không`,
      jobEvidence(facts.jobs),
    );
  }
  if (field) return fieldShortfall(facts, atom, field, t);
  const evidence = jobEvidence(facts.jobs) ?? (t.explicit ? snippet(t.explicit.line, t.explicit.span) : null);
  return result('unmet', `CV ghi ${formatMonths(total)} kinh nghiệm, yêu cầu ${wanted(atom)}`, evidence);
}
