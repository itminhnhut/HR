/** A pressed-or-not choice in a row, like shadcn's Toggle: "7 ngày", "Trực tiếp", "Hôm nay". */
export const toggleClass = (on: boolean) =>
  `inline-flex min-h-11 items-center justify-center gap-2 rounded-control border px-3 text-sm font-medium shadow-[0_1px_2px_rgb(15_23_42/0.05)] transition-colors disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-9 ${on ? 'border-primary bg-primary text-white' : 'border-field bg-white text-navy hover:bg-tint'}`;
