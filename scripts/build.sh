#!/bin/bash
set -e

echo "=== Installing dependencies ==="
pnpm install --frozen-lockfile || pnpm install

echo "=== Building Next.js application ==="
pnpm next build

echo "=== Build completed successfully ==="
