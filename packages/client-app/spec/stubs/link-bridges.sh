#!/bin/bash
# Re-link the test node-bridge packages into node_modules. pnpm installs
# reify node_modules and drop manual symlinks; this restores them.
set -e
cd "$(dirname "$0")/../.."
mkdir -p node_modules/@electron
for m in nylas-exports nylas-store nylas-component-kit nylas-observables electron; do
  ln -sfn "../spec/stubs/node-bridges/$m" "node_modules/$m"
done
ln -sfn "../../spec/stubs/node-bridges/at-electron-remote" "node_modules/@electron/remote"
echo "test bridges linked"
