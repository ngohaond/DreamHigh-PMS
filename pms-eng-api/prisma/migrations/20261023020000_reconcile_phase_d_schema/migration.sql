ALTER TABLE "levels"
  ADD COLUMN IF NOT EXISTS "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE';

DO $$
DECLARE
    column_row RECORD;
BEGIN
    FOR column_row IN
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND data_type = 'timestamp with time zone'
          AND (table_name, column_name) IN (
            ('branches', 'created_at'),
            ('class_students', 'enrolled_at'),
            ('exams', 'scheduled_at'),
            ('leads', 'created_at'),
            ('payments', 'paid_at'),
            ('sessions', 'start_time'),
            ('sessions', 'end_time'),
            ('students', 'created_at'),
            ('system_users', 'created_at'),
            ('system_users', 'updated_at'),
            ('invoices', 'issue_date'),
            ('invoices', 'due_date')
          )
    LOOP
        EXECUTE format(
            'ALTER TABLE %I ALTER COLUMN %I TYPE TIMESTAMP(3) USING %I AT TIME ZONE ''UTC''',
            column_row.table_name,
            column_row.column_name,
            column_row.column_name
        );
    END LOOP;
END $$;