#!/usr/bin/env bash

# procrastination made systemic
# hide away tags you don't want on your cognitive load right now
# but need to address before anything in the backlog
alias tblater() {
  tb move @stash $@
}

# dojo style list of today
alias tbtoday='clear && tb list must should would calendar'
