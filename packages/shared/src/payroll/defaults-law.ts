import { z } from 'zod';
import { defineSetting } from './setting-core.js';

/**
 * Law parameters (spec 5.8), each with the date it applies from and its source. HR can add a newer row; a month
 * reads the row in force on its reference date (R2).
 */

const money = z.number().int().nonnegative();
const rate = z.number().min(0).max(1);

export const ZONES = ['I', 'II', 'III', 'IV'] as const;
export type Zone = (typeof ZONES)[number];

const zoneMinimums = z.object({ I: money, II: money, III: money, IV: money });
const insuranceRates = z.object({ social: rate, health: rate, unemployment: rate });
const bracket = z.object({ upTo: money.nullable(), rate });

/** Legal floors that block a setting below them (spec 4.8): probation pay BLLĐ Đ.26, overtime BLLĐ Đ.98. */
export const LAW_MIN_PROBATION_RATE = 0.85;
export const LAW_MIN_OVERTIME = { weekday: 1.5, restDay: 2, holiday: 3 } as const;

export const LAW_SETTINGS = {
  'luat.luong-co-so': defineSetting({
    key: 'luat.luong-co-so',
    label: 'Lương cơ sở',
    scope: 'date',
    perPerson: false,
    group: 'insurance',
    schema: money,
    defaults: [
      { from: '2026-01-01', value: 2_340_000, source: 'NĐ 73/2024/NĐ-CP Đ.3' },
      { from: '2026-07-01', value: 2_530_000, source: 'NĐ 161/2026' },
    ],
  }),
  'luat.luong-toi-thieu-vung': defineSetting({
    key: 'luat.luong-toi-thieu-vung',
    label: 'Lương tối thiểu vùng',
    scope: 'date',
    perPerson: true,
    group: 'insurance',
    schema: zoneMinimums,
    defaults: [
      {
        from: '2026-01-01',
        value: { I: 5_310_000, II: 4_730_000, III: 4_140_000, IV: 3_700_000 },
        source: 'NĐ 293/2025',
      },
    ],
  }),
  'luat.he-so-tran': defineSetting({
    key: 'luat.he-so-tran',
    label: 'Trần lương đóng BH (lần lương cơ sở / lần lương tối thiểu vùng)',
    scope: 'date',
    perPerson: false,
    group: 'insurance',
    schema: z.object({ social: z.number().positive(), unemployment: z.number().positive() }),
    defaults: [
      {
        from: '2026-01-01',
        value: { social: 20, unemployment: 20 },
        source: 'Luật BHXH 2024 Đ.31 k1 đ, Đ.141 k13; Luật BHYT Đ.14 k5; Luật Việc làm 2025 Đ.34 k2',
      },
    ],
  }),
  'luat.bh-nld': defineSetting({
    key: 'luat.bh-nld',
    label: 'BH người lao động',
    scope: 'date',
    perPerson: false,
    group: 'insurance',
    schema: insuranceRates,
    defaults: [
      {
        from: '2026-01-01',
        value: { social: 0.08, health: 0.015, unemployment: 0.01 },
        source: 'Luật BHXH 2024 Đ.33 k1; NĐ 188/2025 Đ.6 k1 a; NĐ 374/2025 Đ.4 k1',
      },
    ],
  }),
  'luat.bh-cty': defineSetting({
    key: 'luat.bh-cty',
    label: 'BH công ty',
    scope: 'date',
    perPerson: false,
    group: 'insurance',
    schema: insuranceRates,
    defaults: [
      {
        from: '2026-01-01',
        value: { social: 0.175, health: 0.03, unemployment: 0.01 },
        source:
          'Luật BHXH 2024 Đ.34 k1; NĐ 58/2020 Đ.4 k1 sửa bởi NĐ 158/2025 Đ.43 k2; NĐ 188/2025; NĐ 374/2025 Đ.4 k2',
      },
    ],
  }),
  'luat.kpcd': defineSetting({
    key: 'luat.kpcd',
    label: 'Kinh phí công đoàn',
    scope: 'date',
    perPerson: false,
    group: 'insurance',
    schema: rate,
    defaults: [
      { from: '2026-01-01', value: 0.02, source: 'Luật Công đoàn 2024 Đ.29 k1 b, Đ.30; NĐ 105/2026 Đ.2, Đ.4, Đ.11' },
    ],
  }),
  'luat.doan-phi': defineSetting({
    key: 'luat.doan-phi',
    label: 'Đoàn phí',
    scope: 'date',
    perPerson: false,
    group: 'insurance',
    schema: rate,
    defaults: [{ from: '2026-01-01', value: 0.005, source: 'QĐ 61/QĐ-TLĐ (29/7/2025)' }],
  }),
  'luat.giam-tru': defineSetting({
    key: 'luat.giam-tru',
    label: 'Giảm trừ gia cảnh',
    scope: 'date',
    perPerson: false,
    group: 'tax',
    schema: z.object({ personal: money, dependant: money }),
    defaults: [
      { from: '2026-01-01', value: { personal: 15_500_000, dependant: 6_200_000 }, source: 'NQ 110/2025/UBTVQH15' },
    ],
  }),
  'luat.bieu-thue': defineSetting({
    key: 'luat.bieu-thue',
    label: 'Biểu thuế lũy tiến',
    scope: 'date',
    perPerson: false,
    group: 'tax',
    schema: z.array(bracket).min(1),
    defaults: [
      {
        from: '2026-01-01',
        value: [
          { upTo: 10_000_000, rate: 0.05 },
          { upTo: 30_000_000, rate: 0.1 },
          { upTo: 60_000_000, rate: 0.2 },
          { upTo: 100_000_000, rate: 0.3 },
          { upTo: null, rate: 0.35 },
        ],
        source: 'Luật 109/2025/QH15 Đ.9, Đ.29',
      },
    ],
  }),
  'luat.tran-tien-an': defineSetting({
    key: 'luat.tran-tien-an',
    label: 'Trần tiền ăn miễn thuế',
    scope: 'date',
    perPerson: false,
    group: 'tax',
    schema: money,
    defaults: [
      { from: '2026-01-01', value: 730_000, source: 'NĐ 253/2026 Đ.8 k2 g' },
      { from: '2026-07-01', value: 1_200_000, source: 'NĐ 253/2026 Đ.8 k2 g, Đ.69 k1 b' },
    ],
  }),
  'luat.khau-tru-10': defineSetting({
    key: 'luat.khau-tru-10',
    label: 'Khấu trừ 10%: tỷ lệ và ngưỡng một lần chi',
    scope: 'date',
    perPerson: false,
    group: 'tax',
    schema: z.object({ rate, threshold: money }),
    defaults: [
      { from: '2026-01-01', value: { rate: 0.1, threshold: 2_000_000 }, source: 'NĐ 253/2026 Đ.50 k2' },
      { from: '2026-07-01', value: { rate: 0.1, threshold: 5_000_000 }, source: 'NĐ 253/2026 Đ.50 k2, Đ.69 k1 a' },
    ],
  }),
  'luat.tran-trang-phuc': defineSetting({
    key: 'luat.tran-trang-phuc',
    label: 'Trần trang phục bằng tiền miễn thuế (một năm thuế)',
    scope: 'date',
    perPerson: false,
    group: 'tax',
    schema: money,
    defaults: [{ from: '2026-01-01', value: 5_000_000, source: 'NĐ 253 Đ.8 k2 đ; VBHN 19/VBHN-BTC Đ.10 k8 đ' }],
  }),
  'luat.thu-viec-toi-da': defineSetting({
    key: 'luat.thu-viec-toi-da',
    label: 'Số ngày thử việc tối đa',
    scope: 'date',
    perPerson: false,
    group: 'tax',
    schema: z.object({
      manager: z.number().int(),
      college: z.number().int(),
      intermediate: z.number().int(),
      other: z.number().int(),
    }),
    defaults: [
      { from: '2026-01-01', value: { manager: 180, college: 60, intermediate: 30, other: 6 }, source: 'BLLĐ Đ.25' },
    ],
  }),
  'luat.gioi-han-lam-them': defineSetting({
    key: 'luat.gioi-han-lam-them',
    label: 'Giới hạn giờ làm thêm',
    scope: 'date',
    perPerson: false,
    group: 'tax',
    schema: z.object({ month: z.number().positive(), year: z.number().positive() }),
    defaults: [
      { from: '2026-01-01', value: { month: 40, year: 200 }, source: 'BLLĐ Đ.107 k2, k3; NĐ 145/2020 Đ.60 k4' },
    ],
  }),
} as const;
