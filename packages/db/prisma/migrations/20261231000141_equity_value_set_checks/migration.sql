-- Closed value sets for the equity columns whose full set is defined in packages/contracts/src/equity
-- and written only through those types (or literals from the same sets). Prisma cannot express CHECK
-- constraints, so schema.prisma does not show them; see docs/cap-table/ENVIRONMENT.md.
-- Columns whose set is not proven (statuses of certificates, options, drafts, exercises, warrants,
-- health findings; transaction and report kinds; securityKind) are deliberately left unconstrained.
-- Existing rows are checked first so a bad value fails the migration with the table, column and value.
DO $$
DECLARE
  c RECORD;
  bad TEXT;
BEGIN
  FOR c IN
    SELECT * FROM (VALUES
      ('equity_stakeholders', 'type', ARRAY['individual','organization']),
      ('equity_stakeholder_properties', 'kind', ARRAY['relationship','job_title','cost_center','department']),
      ('equity_share_classes', 'classType', ARRAY['common','preferred']),
      ('equity_certificates', 'paperStatus', ARRAY['paper','electronic']),
      ('equity_convertible_blocks', 'kind', ARRAY['safe','note']),
      ('equity_convertibles', 'kind', ARRAY['safe','note']),
      ('equity_convertibles', 'interestType', ARRAY['simple','compound']),
      ('equity_convertibles', 'valuationCapType', ARRAY['pre_money','post_money']),
      ('equity_option_grants', 'optionType', ARRAY['iso','nso']),
      ('equity_access_groups', 'level', ARRAY['full_detail','advanced','basic','restricted','none']),
      ('equity_access_grants', 'level', ARRAY['full_detail','advanced','basic','restricted','none']),
      ('equity_access_grants', 'requestedLevel', ARRAY['full_detail','advanced','basic','restricted','none']),
      ('equity_stakeholder_changes', 'kind', ARRAY['match','termination','profile']),
      ('equity_stakeholder_changes', 'status', ARRAY['pending','accepted','rejected'])
    ) AS v(tbl, col, allowed)
  LOOP
    EXECUTE format(
      'SELECT string_agg(DISTINCT %2$I::text, '', '') FROM %1$I WHERE %2$I IS NOT NULL AND NOT (%2$I = ANY (%3$L::text[]))',
      c.tbl, c.col, c.allowed)
    INTO bad;
    IF bad IS NOT NULL THEN
      RAISE EXCEPTION 'Unexpected value(s) in %.%: %', c.tbl, c.col, bad;
    END IF;
    EXECUTE format(
      'ALTER TABLE %1$I ADD CONSTRAINT %4$I CHECK (%2$I IS NULL OR %2$I = ANY (%3$L::text[]))',
      c.tbl, c.col, c.allowed, c.tbl || '_' || c.col || '_values');
  END LOOP;
END $$;
