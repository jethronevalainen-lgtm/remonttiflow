-- ==========================================================================
-- seed.sql — intentionally empty
--
-- VaKantti must start without demo organizations, projects, employees,
-- customers, work orders or other sample business data.
--
-- Local development environments should create test tenants and users through
-- dedicated test setup or one-off SQL that is not committed as the default
-- seed. This prevents `supabase db reset` from silently recreating demo data
-- that can later leak into production-facing views.
-- ==========================================================================

select 'VaKantti seed completed without demo data.' as seed_status;
