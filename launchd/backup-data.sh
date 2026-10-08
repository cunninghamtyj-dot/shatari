#!/bin/bash
# Azeroth Exchange: nightly backup of the price data to Dropbox (run by launchd via run-job.sh backup).
# Bundles data/ into one zstd-compressed tar (millions of tiny files would be very slow to sync one by one),
# uploads it with rclone, and prunes old copies.
#
# Remote: the rclone remote named in BACKUP_REMOTE (default "dropbox:azeroth-exchange"). The Mac mini's "dropbox"
# remote is scoped to one Dropbox app folder, so it can't see the rest of the Dropbox.
# Keeps: daily/ copies for 7 days, plus a weekly/ copy (Sundays) for 8 weeks.
# Only data/ is backed up: never credentials.sh.
#
# Restore: rclone copy <remote>/daily/data-YYYY-MM-DD.tar.zst . && tar --zstd -xf data-YYYY-MM-DD.tar.zst
#          (stop the collector first: launchd/uninstall.sh, then reinstall with launchd/install.sh)

set -euo pipefail

cd "$( dirname "${BASH_SOURCE[0]}" )/.."

REMOTE="${BACKUP_REMOTE:-dropbox:azeroth-exchange}"
STAMP="$(date +%Y-%m-%d)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/azeroth-backup.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
ARCHIVE="$WORK/data-$STAMP.tar.zst"

echo "$(date '+%F %T') Backup starting."

# The collector writes each file to a dotfile and renames it, so skip in-progress dotfiles.
tar --zstd --exclude '.*' -cf "$ARCHIVE" data
SIZE="$(du -h "$ARCHIVE" | cut -f1)"
echo "$(date '+%F %T') Archive built: $SIZE."

# Quick integrity check before uploading.
tar --zstd -tf "$ARCHIVE" > /dev/null
echo "$(date '+%F %T') Archive verified."

rclone copyto "$ARCHIVE" "$REMOTE/daily/data-$STAMP.tar.zst"
echo "$(date '+%F %T') Uploaded daily/data-$STAMP.tar.zst."

if [ "$(date +%u)" = "7" ]; then
    rclone copyto "$REMOTE/daily/data-$STAMP.tar.zst" "$REMOTE/weekly/data-$STAMP.tar.zst"
    echo "$(date '+%F %T') Saved weekly copy."
fi

# Prune old copies (a folder may not exist yet, e.g. weekly/ before the first Sunday).
for spec in "daily 7d" "weekly 57d"; do
    set -- $spec
    if rclone lsf "$REMOTE/$1/" > /dev/null 2>&1; then
        rclone delete --min-age "$2" "$REMOTE/$1/"
    fi
done
echo "$(date '+%F %T') Old copies pruned. Backup finished."
