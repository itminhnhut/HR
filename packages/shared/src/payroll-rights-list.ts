import type { PayrollRightsDto } from './payroll-api.js';

/**
 * `GET /hr/payroll/rights`. `open`: PAYROLL_ADMINS names nobody, so every HR account has both payroll rights and the
 * stored rights decide nothing (changing them answers 409 payroll_open).
 */
export interface PayrollRightsListDto {
  open: boolean;
  accounts: PayrollRightsDto[];
}
