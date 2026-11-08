/** The column the sheet opens on: the day a link asks for (`?ngay=`, from the leave list), else today. */
export const dayToOpen = (
  days: readonly { iso: string; key: string }[],
  asked: string | null,
  todayKey: string | undefined,
) => (asked ? days.find((d) => d.iso === asked)?.key : undefined) ?? todayKey;
