#!/bin/sh
# Shrinks production node_modules inside the image build (≈200 MB → ≈75 MB). Only removes what Node never loads in
# this CommonJS app on this system: sharp builds for other platforms, browser bundles, type declarations, ES-module
# copies of packages that also ship CommonJS, source maps and docs. Licence files stay.
set -eu
cd "${1:-node_modules}"
# sharp: keep the native build for this system (musl on Alpine), drop glibc, other OS and WebAssembly builds.
find @img -maxdepth 1 \( -name 'sharp-*linux-*' ! -name '*linuxmusl*' -o -name 'sharp-wasm32' -o -name 'sharp-*darwin*' -o -name 'sharp-*win32*' \) -exec rm -rf {} +
rm -rf @emnapi exceljs/dist
find . -type d \( -name dist-types -o -name dist-es \) -prune -exec rm -rf {} +
find . -type f \( -name '*.d.ts' -o -name '*.d.mts' -o -name '*.d.cts' -o -name '*.map' -o -name '*.md' -o -name '*.markdown' -o -name '*.ts' \) -delete
