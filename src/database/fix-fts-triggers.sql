-- Fix FTS trigger conflicts
-- This script removes conflicting FTS triggers that cause 'unsafe use of virtual table' errors
-- 
-- Problem: The FTS5 virtual tables (tasks_fts, memory_fts) are configured with content= option
-- which means SQLite automatically maintains synchronization with the source tables.
-- However, manual triggers were also created which attempt to do the same thing,
-- creating a conflict that causes "unsafe use of virtual table" errors.
--
-- Solution: Remove the manual triggers and let FTS5's automatic synchronization handle it.

-- Remove tasks_fts triggers (conflicting with automatic FTS5 synchronization)
DROP TRIGGER IF EXISTS tasks_fts_insert;
DROP TRIGGER IF EXISTS tasks_fts_delete;
DROP TRIGGER IF EXISTS tasks_fts_update;

-- Remove memory_fts triggers (conflicting with automatic FTS5 synchronization)
DROP TRIGGER IF EXISTS memory_fts_insert;
DROP TRIGGER IF EXISTS memory_fts_delete;
DROP TRIGGER IF EXISTS memory_fts_update;

-- Note: FTS5 tables with content='table_name' automatically maintain synchronization.
-- Manual triggers are not needed and cause conflicts. This fix aligns the database
-- schema with FTS5 best practices and resolves write operation failures.