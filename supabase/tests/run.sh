#!/usr/bin/env bash
# Apply every migration to a throwaway PostgreSQL database and run the SQL
# scenario tests in supabase/tests/*.test.sql.
#
# Usage: PGHOST=... PGPORT=... PGUSER=postgres bash supabase/tests/run.sh
# Requires a superuser connection. The database named by TEST_DB (default
# pr_os_test) is dropped and recreated.
set -euo pipefail

cd "$(dirname "$0")/../.."

TEST_DB="${TEST_DB:-pr_os_test}"
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

"${PSQL[@]}" -d postgres -c "drop database if exists ${TEST_DB} with (force)"
"${PSQL[@]}" -d postgres -c "create database ${TEST_DB}"

"${PSQL[@]}" -d "$TEST_DB" -f supabase/tests/supabase-stub.sql

for migration in supabase/migrations/*.sql; do
  if ! "${PSQL[@]}" -d "$TEST_DB" -f "$migration" > /dev/null; then
    echo "migration failed: $migration" >&2
    exit 1
  fi
done
echo "applied $(ls supabase/migrations/*.sql | wc -l) migrations"

"${PSQL[@]}" -d "$TEST_DB" -f supabase/tests/helpers.sql

failed=0
for test_file in supabase/tests/*.test.sql; do
  # Each scenario runs in its own transaction and is rolled back.
  if output=$( { echo "begin;"; cat "$test_file"; echo "rollback;"; } \
      | "${PSQL[@]}" -d "$TEST_DB" 2>&1 ); then
    echo "ok   $test_file"
  else
    echo "FAIL $test_file"
    echo "$output" | sed 's/^/     /'
    failed=1
  fi
done

exit "$failed"
