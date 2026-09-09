#!/usr/bin/env bash
# Wipes everything: the app's SQLite file (candidates, audit log, live markets) and
# Temporal's Postgres volume (workflow history, schedules). After this, run `npm run dev`.
# Nothing happens automatically, so trigger a sweep yourself in the UI when you're ready to demo.
set +e

echo "Stopping containers..."
# `docker compose down` occasionally reports a transient "already in progress" error on this
# machine even though it actually finishes fine. Just retry a couple of times instead of
# treating that as a real failure.
for i in 1 2 3; do
  docker compose down && break
  sleep 2
done

echo "Removing Temporal's Postgres volume..."
docker volume rm novelty-markets_postgres-data >/dev/null 2>&1

echo "Removing app database..."
rm -f data/novelty-markets.sqlite

echo "Clean. Next: npm run dev, then trigger a sweep yourself in the UI when ready to demo."
