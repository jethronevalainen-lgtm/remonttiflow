#!/usr/bin/env node
/**
 * Static migration lint: guard the RLS helper EXECUTE grants.
 *
 * Production incident 2026-07-24/25: migration
 * 20260724112704_role_based_workspace.sql revoked EXECUTE on the
 * SECURITY DEFINER helpers private.can_access_project /
 * private.can_access_work_order from the authenticated role. RLS policies
 * call these helpers, so every SELECT failed with PostgreSQL 42501
 * "permission denied for function can_access_project". Fixed in the DB by
 * 20260725060309_restore_rls_helper_execute.sql.
 *
 * This script fails the build when a migration repeats that anti-pattern:
 *
 *   ERROR   A migration revokes EXECUTE (or ALL) on a private-schema
 *           function F from the `authenticated` role, F is referenced from
 *           a `create policy` statement in the migrations, and no migration
 *           grants EXECUTE on F back to `authenticated`.
 *
 *   WARNING Any other `revoke` statement mentioning `private.` +
 *           `authenticated` (e.g. trigger functions that are intentionally
 *           not executable by API roles, or revoke-then-grant hardening).
 *           Printed for visibility; does not fail the build.
 *
 * Usage:
 *   node scripts/check-migration-grants.mjs [--dir <migrations-dir>]
 *
 * Exit code 0 = no errors (warnings allowed), 1 = at least one error.
 */

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
let migrationsDir = path.resolve('supabase/migrations');
const dirFlagIndex = args.indexOf('--dir');
if (dirFlagIndex !== -1) {
  const value = args[dirFlagIndex + 1];
  if (!value) {
    console.error('error: --dir requires a path argument');
    process.exit(2);
  }
  migrationsDir = path.resolve(value);
}

if (!fs.existsSync(migrationsDir)) {
  console.error(`error: migrations directory not found: ${migrationsDir}`);
  process.exit(2);
}

/**
 * Replace SQL comments with whitespace so statement matching never sees
 * comment text, while byte offsets (and therefore line numbers) stay intact.
 */
function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
    .replace(/--[^\n]*/g, (match) => ' '.repeat(match.length));
}

function lineNumberAt(text, offset) {
  let line = 1;
  for (let i = 0; i < offset; i += 1) {
    if (text[i] === '\n') line += 1;
  }
  return line;
}

const files = fs
  .readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();

// First pass: collect every private-schema function that is granted EXECUTE
// to `authenticated` anywhere in the migrations, and every function name
// referenced from a `create policy` statement.
const grantedToAuthenticated = new Set();
const policyStatements = [];

const fileContents = new Map();
for (const name of files) {
  const raw = fs.readFileSync(path.join(migrationsDir, name), 'utf8');
  fileContents.set(name, stripComments(raw));
}

for (const sql of fileContents.values()) {
  const grantPattern =
    /\bgrant\s+execute\s+on\s+function\s+private\.([a-zA-Z_][\w]*)\s*\([^;]*?\)\s+to\s+authenticated\b/gi;
  for (const match of sql.matchAll(grantPattern)) {
    grantedToAuthenticated.add(match[1].toLowerCase());
  }
  const policyPattern = /\bcreate\s+policy\b[^;]*;/gi;
  for (const match of sql.matchAll(policyPattern)) {
    policyStatements.push(match[0]);
  }
}

function referencedByPolicy(functionName) {
  const namePattern = new RegExp(`\\b${functionName}\\b`, 'i');
  return policyStatements.some((statement) => namePattern.test(statement));
}

// Second pass: find revokes that mention private. + authenticated.
const revokePattern = /\brevoke\b[^;]*;/gi;
const errors = [];
const warnings = [];

for (const [name, sql] of fileContents) {
  for (const match of sql.matchAll(revokePattern)) {
    const statement = match[0];
    if (!/\bprivate\./i.test(statement) || !/\bauthenticated\b/i.test(statement)) {
      continue;
    }
    const line = lineNumberAt(sql, match.index);
    const location = `${name}:${line}`;
    const summary = statement.replace(/\s+/g, ' ').trim();

    const functionMatch = /\bon\s+function\s+private\.([a-zA-Z_][\w]*)/i.exec(statement);
    const functionName = functionMatch ? functionMatch[1].toLowerCase() : null;

    const isRlSHelper =
      functionName !== null &&
      referencedByPolicy(functionName) &&
      !grantedToAuthenticated.has(functionName);

    if (isRlSHelper) {
      errors.push(
        `${location}: revoking EXECUTE on private.${functionName} from ` +
          '`authenticated` breaks the RLS policies that call it, and no ' +
          'migration grants EXECUTE back to `authenticated`. ' +
          'Incident pattern of 20260724112704 — do not revoke EXECUTE on ' +
          'RLS helper functions from `authenticated`.',
      );
    } else {
      warnings.push(`${location}: revoke mentions private. + authenticated: ${summary}`);
    }
  }
}

for (const warning of warnings) {
  console.warn(`warning: ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`error: ${error}`);
  }
  console.error(`\ncheck-migration-grants: ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}

console.log(
  `check-migration-grants: OK — ${files.length} migration file(s) scanned, ` +
    `${warnings.length} warning(s), no errors`,
);
