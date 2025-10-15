#!/usr/bin/env sh

# This script is sourced by husky hooks

# Exit if HUSKY env var is set to 0 (to disable hooks)
if [ "${HUSKY-}" = "0" ]; then
  exit 0
fi

# Navigate to git root
if [ -z "${GIT_DIR}" ]; then
  if [ -d .git ]; then
    export GIT_DIR=.git
  fi
fi
