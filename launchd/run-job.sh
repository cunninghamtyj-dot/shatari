#!/bin/bash
# Azeroth Exchange: runs one scheduled job for launchd (macOS's replacement for cron).
# Usage: run-job.sh collector|realm-list|bound-json|backup
# Output goes to logs/<job>-YYYY-MM-DD.log; logs older than 14 days are deleted.

JOB="$1"
cd "$( dirname "${BASH_SOURCE[0]}" )/.." || exit 1

export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
# Use the same temp dir as Terminal, so main.js's "already running" lock
# (a socket in the temp dir) also sees collectors started by hand.
export TMPDIR="$(getconf DARWIN_USER_TEMP_DIR)"

mkdir -p logs
find logs -name '*.log' -mtime +14 -delete
exec >> "logs/${JOB}-$(date +%Y-%m-%d).log" 2>&1

case "$JOB" in
  collector)
    source ./credentials.sh
    # main.js exits after 6 hours (or at once if another copy is running);
    # launchd starts it again on its next check.
    exec node src/main.js
    ;;
  realm-list)
    exec ./realm-list.sh
    ;;
  bound-json)
    exec ./make-bound-json.sh
    ;;
  backup)
    exec ./launchd/backup-data.sh
    ;;
  *)
    echo "Unknown job: $JOB"
    exit 1
    ;;
esac
