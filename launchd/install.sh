#!/bin/bash
# Azeroth Exchange: install (or reinstall) the scheduled jobs as macOS LaunchAgents.
# Usage: launchd/install.sh [regions]    e.g. launchd/install.sh us   or   launchd/install.sh us,eu,tw,kr
# Default regions: us. Running it again replaces the jobs with the new settings.
#
# Jobs:
#   collector   main.js; checked every 5 minutes (it exits after 6 hours, launchd restarts it)
#   realm-list  realm-list.sh; daily at 04:17
#   bound-json  make-bound-json.sh; hourly at :25 (main.js updates ids.bound.json every 2 hours)
#
# LaunchAgents run while the user is logged in, so the Mac should log in automatically after a restart.

set -e

REGIONS="${1:-us}"
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
AGENTS="$HOME/Library/LaunchAgents"
PREFIX="com.azerothexchange"
DOMAIN="gui/$(id -u)"

if [ ! -f "$DIR/credentials.sh" ]; then
  echo "Missing $DIR/credentials.sh; copy it from the other Mac first."
  exit 1
fi

chmod +x "$DIR/launchd/run-job.sh"
mkdir -p "$AGENTS" "$DIR/logs"

# write_plist <job> <schedule xml>
write_plist () {
  local job="$1" schedule="$2"
  local label="$PREFIX.$job"
  local plist="$AGENTS/$label.plist"

  launchctl bootout "$DOMAIN/$label" 2>/dev/null || true

  cat > "$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$label</string>
  <key>ProgramArguments</key>
  <array>
    <string>$DIR/launchd/run-job.sh</string>
    <string>$job</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>SHATARI_REGIONS</key>
    <string>$REGIONS</string>
  </dict>
$schedule
  <key>StandardOutPath</key>
  <string>$DIR/logs/launchd-$job.log</string>
  <key>StandardErrorPath</key>
  <string>$DIR/logs/launchd-$job.log</string>
</dict>
</plist>
EOF

  plutil -lint "$plist" >/dev/null
  launchctl bootstrap "$DOMAIN" "$plist"
  echo "Installed $label"
}

write_plist collector "  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>300</integer>"

write_plist realm-list "  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>4</integer>
    <key>Minute</key>
    <integer>17</integer>
  </dict>"

write_plist bound-json "  <key>StartCalendarInterval</key>
  <dict>
    <key>Minute</key>
    <integer>25</integer>
  </dict>"

echo "Done. Regions: $REGIONS. Logs: $DIR/logs/"
