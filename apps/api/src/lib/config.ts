export const config = {
  siteUrl: (process.env.SITE_URL ?? 'http://localhost:5173').replace(/\/$/, ''),
  companyName: process.env.COMPANY_NAME ?? 'Tên công ty',
  isProduction: process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production',
};

export function allowedHrEmails(): string[] {
  return (process.env.HR_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedHrEmail(email: string | null | undefined): boolean {
  return !!email && allowedHrEmails().includes(email.toLowerCase());
}
