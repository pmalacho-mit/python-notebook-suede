#!/bin/bash

DIRNAME="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKERFILE="${DIRNAME}/compose.yml"
docker compose -f "${DOCKERFILE}" down && docker compose -f "${DOCKERFILE}" up --build yjs-websocket-server