#!/bin/bash
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js not found. Install it from https://nodejs.org"; read; exit 1; }
(sleep 2; open http://localhost:3000 2>/dev/null || xdg-open http://localhost:3000) &
node server.js
