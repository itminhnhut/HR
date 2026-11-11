import { PLACEHOLDERS, type MailContent, type TemplateKey, type TemplateValues } from '@careers/shared';
import { mailText } from '../mail/mailSections';

type Key = keyof TemplateValues;

const SIGNATURE: Key[] = ['hrName', 'hrPhone', 'hrTitle', 'hrAlias'];
const INTERVIEW: Key[] = ['interviewTime', 'interviewer', 'duration'];

/** What the fixed frame of each mail shows, whether or not the editable text mentions it. */
const FRAME: Record<TemplateKey, Key[]> = {
  interview_onsite: [...INTERVIEW, 'address', ...SIGNATURE],
  interview_online: [...INTERVIEW, 'meetingUrl', ...SIGNATURE],
  rejection: SIGNATURE,
  rejection_interview: SIGNATURE,
  call: ['duration', ...SIGNATURE],
  payslip: SIGNATURE,
};

/** Left empty, the frame reads wrong or leaves a hole. The others have a default, or are optional like the job title and alias. */
const NEEDED: Key[] = ['interviewTime', 'meetingUrl', 'hrName', 'hrPhone'];

/** The mail design drops any meeting link that is not http(s). */
export const isUsableLink = (url: string) => /^https?:\/\/\S+$/i.test(url.trim());

const isFilled = (key: Key, values: TemplateValues) =>
  key === 'meetingUrl' ? isUsableLink(values.meetingUrl) : values[key].trim() !== '';

/** The order of the boxes: the candidate, the interview, then the HR. */
const BOX_ORDER: Key[] = [
  'candidateName',
  'jobTitle',
  'interviewTime',
  'interviewDate',
  'address',
  'meetingUrl',
  'interviewer',
  'duration',
  'hrName',
  'hrPhone',
  'hrTitle',
  'hrAlias',
  'company',
];

/** Which boxes to show: the frame's, and the ones the text asks for. An interview date comes from the time box. */
export function fieldsFor(template: MailContent): Key[] {
  const text = mailText(template);
  const frame = FRAME[template.key];
  return BOX_ORDER.filter((key) => {
    if (key === 'interviewDate' && frame.includes('interviewTime')) return false;
    return frame.includes(key) || PLACEHOLDERS.some((p) => p.key === key && text.includes(p.token));
  });
}

/** Tokens that would reach the candidate as they are, plus what the frame still needs. */
export function missingTokens(content: MailContent, values: TemplateValues): string[] {
  const text = mailText(content);
  const frame = FRAME[content.key];
  return PLACEHOLDERS.filter(
    ({ key, token }) => text.includes(token) || (frame.includes(key) && NEEDED.includes(key) && !isFilled(key, values)),
  ).map((p) => p.token);
}
