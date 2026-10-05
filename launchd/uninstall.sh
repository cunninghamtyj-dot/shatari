#!/bin/bash
# Azeroth Exchange: stop and remove the scheduled jobs installed by install.sh.
# Price data and logs are left alone.

AGENTS="$HOME/Library/LaunchAgents"
DOMAIN="gui/$(id -u)"

for job in collector realm-list bound-json; do
  label="com.azerothexchange.$job"
  launchctl bootout "$DOMAIN/$label" 2>/dev/null && echo "Stopped $label"
  rm -f "$AGENTS/$label.plist"
done
