/**
 * Short texts for a job card. The API sends the first benefits joined with ", " (a benefit can hold commas
 * itself: "Lương cứng 12 – 18 triệu, xét tăng 2 lần/năm"), so a part that starts in lower case continues the
 * benefit before it.
 */

/** An amount of money ("12 – 18 triệu", "4 triệu/tháng", "500.000 đ"): the card shows the salary already. */
const MONEY = /\d[\d.,\s–-]*\s*(triệu|tr\b|nghìn|k\b|đ\b|đồng|vnđ|vnd)/i;

/** "a, b, c" back into the benefits it was made from. */
function splitBenefits(perks: string): string[] {
  const benefits: string[] = [];
  for (const part of perks.split(', ')) {
    const first = part.trim().charAt(0);
    const continues = benefits.length > 0 && first !== '' && first === first.toLowerCase() && /\p{L}/u.test(first);
    if (continues) benefits[benefits.length - 1] += `, ${part}`;
    else benefits.push(part);
  }
  return benefits;
}

/** Longest chip, in characters; a longer benefit is shortened to its first part or left out. */
const CHIP_MAX = 24;
/** Where a benefit's short name ends: "Thưởng Tết theo kết quả" → "Thưởng Tết". */
const DETAIL = /\s(?:theo|đóng|khi|cho|với|tùy|tuỳ|lên đến|từ|tại)\s|\s\(/u;
/** "BHXH", "BHYT": short insurance names, joined into one chip ("BHXH · BHYT · BHTN"). */
const ACRONYM = /^[A-ZĐ]{2,}$/u;
const isAcronyms = (chip: string) => chip.split(' · ').every((word) => ACRONYM.test(word));

/** A benefit's chip text, never cut mid-phrase: null when even its short name is too long. */
function chipText(benefit: string): string | null {
  const name = (benefit.split(', ')[0] ?? '').trim();
  if (name.length <= CHIP_MAX) return name;
  const firstWord = name.split(' ')[0] ?? '';
  if (ACRONYM.test(firstWord)) return firstWord;
  const short = (name.split(DETAIL)[0] ?? '').trim();
  return short.length <= CHIP_MAX ? short : null;
}

/**
 * The perks of a job card as a few short chips ("Lương tháng 13", "BHXH · BHYT · BHTN"): the benefits that are
 * not the pay itself, each shortened to its name, so the card never shows a sentence cut off with "…".
 */
export function cardPerkChips(perks: string, max = 2): string[] {
  const chips: string[] = [];
  for (const benefit of splitBenefits(perks)) {
    const text = MONEY.test(benefit) ? null : chipText(benefit);
    if (!text) continue;
    const last = chips[chips.length - 1];
    if (last && isAcronyms(last) && ACRONYM.test(text)) chips[chips.length - 1] = `${last} · ${text}`;
    else chips.push(text);
  }
  return chips.slice(0, max);
}

/** "Gò Vấp, TP. Hồ Chí Minh" → "Gò Vấp, TP.HCM": short enough for the card's fact column. */
export function shortPlace(place: string): string {
  return place.replace(/(Thành phố|TP\.?)\s*(Hồ Chí Minh|HCM)\b/giu, 'TP.HCM');
}
