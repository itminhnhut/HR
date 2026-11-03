import { ASSISTANT_EVAL } from './cvs-assistant.js';
import { HVAC_EVAL } from './cvs-hvac.js';
import { LOGISTICS_EVAL } from './cvs-logistics.js';
import { SALES_EVAL } from './cvs-sales-engineer.js';
import type { JobEval } from './types.js';

export const ALL_JOBS: readonly JobEval[] = [HVAC_EVAL, ASSISTANT_EVAL, LOGISTICS_EVAL, SALES_EVAL];
