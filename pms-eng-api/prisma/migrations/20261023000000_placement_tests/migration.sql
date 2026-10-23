ALTER TABLE "levels"
  ADD COLUMN "min_placement_score" DECIMAL(8,2),
  ADD COLUMN "max_placement_score" DECIMAL(8,2);

CREATE TABLE "placement_tests" (
  "id" SERIAL NOT NULL,
  "student_id" INTEGER NOT NULL,
  "branch_id" INTEGER NOT NULL,
  "program_id" INTEGER NOT NULL,
  "listening_score" DECIMAL(8,2) NOT NULL,
  "reading_score" DECIMAL(8,2) NOT NULL,
  "writing_score" DECIMAL(8,2) NOT NULL,
  "total_score" DECIMAL(8,2) NOT NULL,
  "test_date" DATE NOT NULL,
  "recommended_level_id" INTEGER,
  "notes" VARCHAR(2000),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "placement_tests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "placement_tests_student_id_test_date_idx" ON "placement_tests"("student_id", "test_date");
CREATE INDEX "placement_tests_branch_id_test_date_idx" ON "placement_tests"("branch_id", "test_date");

ALTER TABLE "placement_tests" ADD CONSTRAINT "placement_tests_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "placement_tests" ADD CONSTRAINT "placement_tests_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "placement_tests" ADD CONSTRAINT "placement_tests_program_id_fkey"
  FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "placement_tests" ADD CONSTRAINT "placement_tests_recommended_level_id_fkey"
  FOREIGN KEY ("recommended_level_id") REFERENCES "levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;