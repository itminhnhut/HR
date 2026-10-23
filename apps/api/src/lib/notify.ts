import { Resend } from 'resend';
import { allowedHrEmails, config } from './config.js';

/**
 * Plain-text emails to HR. Optional: without RESEND_API_KEY nothing is sent.
 * Errors are logged, never thrown, so a mail outage can't block an application.
 */
async function sendToHr(subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM;
  const to = allowedHrEmails();
  if (!apiKey || !from || to.length === 0) return;
  try {
    await new Resend(apiKey).emails.send({ from, to, subject, text });
  } catch (error) {
    console.error('[notify] email failed', error);
  }
}

export function notifyNewApplication(input: { jobTitle: string; fullName: string; phone: string }) {
  return sendToHr(
    `Hồ sơ mới: ${input.jobTitle}`,
    `${input.fullName} (${input.phone}) vừa gửi hồ sơ cho vị trí ${input.jobTitle}.\n\nXem hồ sơ: ${config.siteUrl}/hr/applicants`,
  );
}

export function notifyExpiringJobs(jobs: { title: string; deadline: string }[]) {
  if (jobs.length === 0) return Promise.resolve();
  const lines = jobs.map((job) => `- ${job.title}: hạn nộp ${job.deadline}`).join('\n');
  return sendToHr(
    `${jobs.length} tin tuyển dụng sắp hết hạn`,
    `Các tin sau hết hạn trong 3 ngày tới:\n${lines}\n\nGia hạn hoặc để tin tự đóng: ${config.siteUrl}/hr`,
  );
}
