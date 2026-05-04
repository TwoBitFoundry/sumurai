#!/usr/bin/env sh

if [ "${HUSKY-}" = "0" ]; then
  exit 0
fi

if [ -z "${GIT_DIR}" ]; then
  if [ -d .git ]; then
    export GIT_DIR=.git
  fi
fi
