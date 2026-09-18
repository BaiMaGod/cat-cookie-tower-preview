#!/usr/bin/env sh
cd "$(dirname "$0")"
python3 -m http.server 8080 2>/dev/null || python -m http.server 8080
