/** "Nhân viên Kinh doanh B2B" -> "nhan-vien-kinh-doanh-b2b-x7k2" */
export function slugify(title: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const suffix = crypto.randomUUID().slice(0, 4);
  return `${base || 'viec-lam'}-${suffix}`;
}
