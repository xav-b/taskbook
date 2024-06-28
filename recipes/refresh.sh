#!/Usr/bin/env bash

# simple script that redraws periodically your daily view, so you don't have to.
# a low tech to take into account all the checked tasks, new ones, etc... without
# having to implement an acutal advanced tui.

# trap the Control-C signal and break out of the loop
trap break INT

REFRESH_SECONDS=100

while true; do
  clear

  tb list must should would calendar

  # refresh every x seconds
  sleep $REFRESH_SECONDS
done

# run trap again with - to restore the "INT" handler to the default action
trap - INT

echo "👍 time to relax"
