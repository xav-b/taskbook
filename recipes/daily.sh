#!/usr/bin/env bash
#
# Automate the daily manual bootstrap:
# 1. Archive done tasks
# 2. If weekday, create daily standup entry (ultimately should just sync calendars)


tb clear

if [[ $(date +%u) -lt 6 ]]; then
  echo "It's $(date +%A), let's get to work"
  tb event 04:30pm 30m Daily Stand Up
fi
