-- Least-privilege runtime role and row-level security for Space-owned content.
--
-- Migrations keep running as the owner role. The app connects as a login role that
-- is a member of rakazo_app: DML on the app tables only, no CREATE on the schema, no
-- superuser, no BYPASSRLS. `pnpm db:migrate` creates that login from DATABASE_URL and
-- grants it rakazo_app (see apps/api/src/cli/migrate-database.ts).
--
-- Table owners and superusers bypass these policies, so an install that still
-- connects the app as the owner keeps working unchanged until it switches.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rakazo_app') THEN
    BEGIN
      CREATE ROLE rakazo_app NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE WARNING 'Cannot create role rakazo_app (the migration role lacks CREATEROLE). Create it with NOLOGIN NOBYPASSRLS and rerun the grants in this migration; until then the app must connect as the owner and row-level security is not enforced.';
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rakazo_app') THEN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO rakazo_app', current_database());
    GRANT USAGE ON SCHEMA public TO rakazo_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rakazo_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rakazo_app;
    REVOKE ALL ON TABLE "_prisma_migrations" FROM rakazo_app;
    -- Tables created by later migrations (run by this same owner role).
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rakazo_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO rakazo_app;
  END IF;
END $$;

-- PostgreSQL 15+ already denies this; older servers let every role create objects.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Every protected table gets permissive policies:
--   *_tenant: rows of the Space (or user) set for this connection by the app;
--   *_system: the explicit cross-tenant bypass (runAsSystem in packages/db).
-- With neither setting, a query sees no rows and writes are rejected.

DO $$
DECLARE
  protected text;
BEGIN
  -- Tables with their own "spaceId" column.
  FOREACH protected IN ARRAY ARRAY[
    -- chat, memory and skills
    'threads', 'events', 'memory_documents', 'artifacts', 'bot_secrets', 'agent_secrets',
    'taught_skills', 'agent_skills',
    -- bots, runs and what they are connected to
    'bots', 'runs', 'tasks', 'routines', 'connections', 'mcp_servers', 'mcp_oauth_sessions',
    'bot_mcp_servers', 'computers', 'boards', 'tickets', 'ticket_comments',
    'messaging_identities', 'external_conversations', 'usage_records', 'scratchpad_items',
    'action_approval_rules',
    -- fork: bots, pages and notifications
    'bot_connection_access', 'bot_skill_settings', 'bot_pages', 'bot_pins', 'teach_held_values',
    'scratchpad_approvals', 'routine_watch_states', 'notifications', 'artifact_shares',
    'account_exports', 'model_oauth_states', 'sidebar_pages',
    -- fork: mail
    'mail_messages', 'mail_searches', 'mail_sender_stats', 'mail_sender_decisions',
    'mail_action_logs', 'inbox_todos', 'inbox_sender_feedback', 'compose_sends',
    -- fork: finance
    'finance_accounts', 'finance_statements', 'finance_transactions', 'finance_treasury_yields',
    'finance_bills', 'finance_sync_states', 'finance_wallets', 'finance_crypto_holdings',
    'finance_preferences', 'finance_crypto_snapshots', 'finance_exchange_connections',
    'finance_exchange_balances', 'finance_exchange_snapshots',
    -- fork: contacts, investors, fundraising and cap table
    'contacts', 'contact_photos', 'investor_shares', 'investor_portal_tokens',
    'portal_sessions', 'investor_updates', 'audit_requests', 'fundraise_rounds', 'safes',
    'safe_sync_states', 'cap_table_snapshots',
    -- fork: data room
    'data_room_folders', 'data_room_items', 'data_room_changes', 'data_room_imports',
    'data_room_item_texts', 'data_room_chunks', 'data_room_preferences',
    'data_room_sync_states',
    -- fork: legal
    'legal_contracts', 'legal_deadlines', 'legal_nodes', 'legal_edges',
    -- fork: meetings, Devin and the company graph
    'meetings', 'meeting_sync_states', 'meeting_tombstones', 'devin_connection_states',
    'devin_sessions', 'company_entities', 'company_identities', 'company_edges',
    'company_events', 'company_event_entities', 'company_evidence', 'company_candidates',
    'company_candidate_resolutions', 'company_corrections', 'company_rejections',
    'company_source_blocks', 'company_merges', 'company_import_runs',
    'company_import_evidence', 'company_import_candidates', 'company_import_sources',
    'company_refresh_sources', 'company_import_units', 'company_import_calls'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', protected);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING ("spaceId" = NULLIF(current_setting(''app.space_id'', true), ''''))',
      protected || '_tenant', protected);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (current_setting(''app.rls_bypass'', true) = ''on'')',
      protected || '_system', protected);
  END LOOP;

  -- Tables owned by one user, with no Space.
  FOREACH protected IN ARRAY ARRAY[
    'user_model_credentials', 'user_voice_credentials', 'transcription_selections'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', protected);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING ("userId" = NULLIF(current_setting(''app.user_id'', true), ''''))',
      protected || '_tenant', protected);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (current_setting(''app.rls_bypass'', true) = ''on'')',
      protected || '_system', protected);
  END LOOP;

  -- Tables that only exist as children of a protected row: (table, parent, link column).
  -- The Space is the parent's.
  FOREACH protected IN ARRAY ARRAY[
    'messages|threads|threadId',
    'memory_revisions|memory_documents|documentId',
    'steering_messages|bots|botId',
    'external_messages|external_conversations|externalConversationId',
    'mail_search_rows|mail_searches|searchId',
    'bot_page_revisions|bot_pages|pageId',
    'notification_deliveries|notifications|notificationId',
    'mail_sync_states|connections|connectionId',
    'contact_photo_syncs|connections|connectionId'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', split_part(protected, '|', 1));
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (EXISTS (SELECT 1 FROM %I p WHERE p."id" = %I.%I AND p."spaceId" = NULLIF(current_setting(''app.space_id'', true), '''')))',
      split_part(protected, '|', 1) || '_tenant', split_part(protected, '|', 1),
      split_part(protected, '|', 2), split_part(protected, '|', 1), split_part(protected, '|', 3));
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (current_setting(''app.rls_bypass'', true) = ''on'')',
      split_part(protected, '|', 1) || '_system', split_part(protected, '|', 1));
  END LOOP;
END $$;

-- Space secrets belong to the Space; account-level secrets (no Space) to their user.
ALTER TABLE "secrets" ENABLE ROW LEVEL SECURITY;
CREATE POLICY secrets_tenant ON "secrets"
  USING (
    "spaceId" = NULLIF(current_setting('app.space_id', true), '')
    OR ("spaceId" IS NULL AND "userId" = NULLIF(current_setting('app.user_id', true), ''))
  );
CREATE POLICY secrets_system ON "secrets"
  USING (current_setting('app.rls_bypass', true) = 'on');

-- Direct messages resolve their Space through the identity; group posts through the
-- thread message they mirror. A row with neither is only reachable as system.
ALTER TABLE "messaging_outbound" ENABLE ROW LEVEL SECURITY;
CREATE POLICY messaging_outbound_tenant ON "messaging_outbound"
  USING (
    EXISTS (
      SELECT 1 FROM "messaging_identities" i
      WHERE i."id" = "messaging_outbound"."identityId"
        AND i."spaceId" = NULLIF(current_setting('app.space_id', true), '')
    )
    OR EXISTS (
      SELECT 1 FROM "messages" m JOIN "threads" t ON t."id" = m."threadId"
      WHERE m."id" = "messaging_outbound"."sourceMessageId"
        AND t."spaceId" = NULLIF(current_setting('app.space_id', true), '')
    )
  );
CREATE POLICY messaging_outbound_system ON "messaging_outbound"
  USING (current_setting('app.rls_bypass', true) = 'on');
