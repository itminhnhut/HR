/** The same short names as the grid's day headers. */
export const weekdayName = (date: Date) => (date.getDay() === 0 ? 'CN' : `T${date.getDay() + 1}`);

export const toDate = (iso: string) => {
  const [y = 2026, m = 1, d = 1] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const toIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
