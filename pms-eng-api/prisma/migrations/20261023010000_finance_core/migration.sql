CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

CREATE TABLE "fee_plans" (
  "id" SERIAL NOT NULL,
  "branch_id" INTEGER NOT NULL,
  "course_id" INTEGER NOT NULL,
  "class_id" INTEGER,
  "name" VARCHAR(255) NOT NULL,
  "amount" INTEGER NOT NULL,
  "effective_from" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fee_plans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fee_plans_amount_nonnegative_check" CHECK ("amount" >= 0)
);

CREATE INDEX "fee_plans_branch_id_is_active_idx" ON "fee_plans"("branch_id", "is_active");
CREATE INDEX "fee_plans_course_id_is_active_idx" ON "fee_plans"("course_id", "is_active");
CREATE INDEX "fee_plans_class_id_is_active_idx" ON "fee_plans"("class_id", "is_active");

ALTER TABLE "fee_plans" ADD CONSTRAINT "fee_plans_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fee_plans" ADD CONSTRAINT "fee_plans_course_id_fkey"
  FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fee_plans" ADD CONSTRAINT "fee_plans_class_id_fkey"
  FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "invoice_sequences" (
  "branch_id" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "last_number" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "invoice_sequences_pkey" PRIMARY KEY ("branch_id", "year"),
  CONSTRAINT "invoice_sequences_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "invoices"
  ADD COLUMN "branch_id" INTEGER,
  ADD COLUMN "fee_plan_id" INTEGER,
  ADD COLUMN "base_amount_snapshot" INTEGER,
  ADD COLUMN "fee_plan_name_snapshot" VARCHAR(255),
  ADD COLUMN "discount_type" "DiscountType",
  ADD COLUMN "discount_value" DECIMAL(38,18);

UPDATE "invoices" AS invoice
SET "branch_id" = class."branch_id"
FROM "classes" AS class
WHERE invoice."class_id" = class."id";

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_fee_plan_id_fkey"
  FOREIGN KEY ("fee_plan_id") REFERENCES "fee_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "invoices_branch_id_idx" ON "invoices"("branch_id");

ALTER TABLE "payments"
  ADD COLUMN "branch_id" INTEGER,
  ADD COLUMN "idempotency_key" VARCHAR(128),
  ADD COLUMN "request_hash" VARCHAR(64);

UPDATE "payments" AS payment
SET "branch_id" = invoice."branch_id"
FROM "invoices" AS invoice
WHERE payment."invoice_id" = invoice."id";

ALTER TABLE "payments" ADD CONSTRAINT "payments_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" DROP CONSTRAINT "payments_invoice_id_fkey";
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");
CREATE UNIQUE INDEX "payments_branch_id_transaction_ref_key" ON "payments"("branch_id", "transaction_ref");