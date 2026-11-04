import type { TemplateKey } from '../message-templates.js';

/** A template with its texts already filled in (no placeholders left, apart from fields with no value). */
export interface MailContent {
  key: TemplateKey;
  subject: string;
  body: string;
  note: string;
  calloutTitle: string;
  callout: string;
  closing: string;
}

/** The values the fixed parts of the design show: details card, signature, confirm button. */
export interface MailDetails {
  interviewIso: string | null;
  address: string;
  meetingUrl: string;
  interviewer: string;
  duration: string;
  candidateName: string;
  jobTitle: string;
  hrName: string;
  hrPhone: string;
  hrTitle: string;
  hrAlias: string;
  hrEmail: string;
  /** Opens the candidate's CV. Only on interview invitations with a stored file. */
  cvUrl?: string;
}
