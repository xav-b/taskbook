#!/usr/bin/env bash

# procrastination made systemic
# hide away tags you don't want on your cognitive load right now
# but need to address before anything in the backlog
function tblater() {
  tb move @stash "$@"
}

# dojo style list of today
alias tbtoday='clear && tb list must should would calendar'

# move out of sight the stuff we can't work on just yet
function tbblock() {
  tb move @blocked "$@"
}

function tbdo() {
  echo -e "creating new task: $@"
  local taskid=$(tb task --json $@ | jq ".id")

  # FIXME: somehow an incorrect flag or argument still yield `0`
  exit_status=$?
  if [ $exit_status -ne 0 ]; then
    echo -e "ERROR: $exit_status"
    exit $exit_status
  fi

  # NOTE: now can test `--notebook` above but not sure this plays nice with the
  # output pipe
  echo -e "task ${taskid} created - opening notes"
  tb comment "${taskid}"

  echo -e "task ${taskid} configured - starting working on it"
  tb begin "${taskid}"
}

function tbp() {
  tb print "$1" | glow
}
