ALTER TABLE "payroll_recurring_items" DROP CONSTRAINT "payroll_recurring_items_kind";--> statement-breakpoint
ALTER TABLE "payroll_recurring_items" DROP CONSTRAINT "payroll_recurring_items_amount";--> statement-breakpoint
ALTER TABLE "payroll_recurring_items" ADD COLUMN "taxable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_recurring_items" ADD CONSTRAINT "payroll_recurring_items_kind" CHECK ("payroll_recurring_items"."kind" in ('support', 'refund', 'advance', 'insurance-paid'));--> statement-breakpoint
ALTER TABLE "payroll_recurring_items" ADD CONSTRAINT "payroll_recurring_items_amount" CHECK (case when "payroll_recurring_items"."kind" = 'insurance-paid' then "payroll_recurring_items"."amount" = 0 else "payroll_recurring_items"."amount" > 0 end);