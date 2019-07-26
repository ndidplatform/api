#!/bin/sh
set -e 

# Ensure that the first argument is node
if [ "$1" != "node" ]; then
  set -- "node" "$@"
fi

# Check existence and owner of DATA_DIRECTORY_PATH
if [ "$1" = "node" -a "$(id -u)" != "0" ]; then
  if [ ! -d ${DATA_DIRECTORY_PATH} ]; then 
    echo "${DATA_DIRECTORY_PATH} is not directory or missing"
    exit 1
  fi 

  user="$(id -u)"
  group="$(id -g)"

  if [ ! -z "$(find ${DATA_DIRECTORY_PATH} ! -user $user ! -group $group)" ]; then
    echo "${DATA_DIRECTORY_PATH} or the files inside have incorrect owner"
    exit 1
  fi
fi

exec "$@"
