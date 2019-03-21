#!/bin/bash
set -e

if [[ -z "$1" ]]; then
  echo "Missing argument: new version to set"
  exit 1
fi

NEW_VERSION=$1

DIR="$(dirname "$BASH_SOURCE")"
DIR_ABSOLUTE_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo $ABSOLUTE_PATH

echo -n "$NEW_VERSION" > $DIR_ABSOLUTE_PATH/../VERSION
cd $DIR_ABSOLUTE_PATH/../main-server && npm version --allow-same-version $NEW_VERSION
cd $DIR_ABSOLUTE_PATH/../mq-server && npm version --allow-same-version $NEW_VERSION
cd $DIR_ABSOLUTE_PATH/../ndid-logger && npm version --allow-same-version $NEW_VERSION
cd $DIR_ABSOLUTE_PATH/../ndid-error && npm version --allow-same-version $NEW_VERSION
