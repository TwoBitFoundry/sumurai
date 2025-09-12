-- Migration: Remove JWT sessions table
-- Phase 3 of cache-first JWT session migration - remove database components
-- JWT session validation is now handled entirely through Redis cache

-- Drop all indexes related to jwt_sessions table first
DROP INDEX IF EXISTS idx_jwt_sessions_jwt_id;
DROP INDEX IF EXISTS idx_jwt_sessions_user_id;
DROP INDEX IF EXISTS idx_jwt_sessions_expires_at;
DROP INDEX IF EXISTS idx_jwt_sessions_user_created;
DROP INDEX IF EXISTS idx_jwt_sessions_expired;

-- Drop the jwt_sessions table
-- All foreign key constraints will be automatically dropped with CASCADE
DROP TABLE IF EXISTS jwt_sessions CASCADE;