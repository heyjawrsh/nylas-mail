#!/usr/bin/env bash
# Builds the Linux app from a clean `git archive HEAD` copy in
# electronuserland/builder (the same OS family as CI) and runs the e2e harness
# there under xvfb. Harness flags pass through:
#
#   packages/client-app/e2e/linux-docker.sh                       # check
#   packages/client-app/e2e/linux-docker.sh --update-axe-baseline
#   packages/client-app/e2e/linux-docker.sh --capture-reference
#
# Only committed files are used, so commit first. Afterwards
# e2e/axe-baseline.json and e2e/reference/linux/ are copied back into this
# tree (they only change with the flags above) and the Playwright report
# lands in e2e/.tmp/linux-report/. The working tree's node_modules and native
# modules are never touched.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(git -C "$here" rev-parse --show-toplevel)"
image="${E2E_DOCKER_IMAGE:-electronuserland/builder:latest}"
work="$(mktemp -d "${TMPDIR:-/tmp}/nylas-e2e-linux.XXXXXX")"
trap 'rm -rf "$work"' EXIT

git -C "$repo" archive HEAD | tar -x -C "$work"

harness_args=""
for arg in "$@"; do harness_args+=" $(printf '%q' "$arg")"; done

# Root in the container needs --no-sandbox; under qemu emulation (an arm64
# host) the GPU process only starts with the other three flags.
docker run --rm --platform linux/amd64 \
	-v "$work:/project" \
	-v nylas-e2e-pnpm-store:/root/.local/share/pnpm/store \
	-w /project \
	-e CI=1 \
	-e E2E_LAUNCH_ARGS="--no-sandbox --disable-gpu --in-process-gpu --no-zygote" \
	"$image" \
	bash -euo pipefail -c "
		command -v xvfb-run >/dev/null || { apt-get update -qq && apt-get install -y -qq xvfb >/dev/null; }
		corepack enable
		pnpm install --no-frozen-lockfile
		pnpm --filter nylas-mail build:e2e
		status=0
		xvfb-run --auto-servernum --server-args='-screen 0 1920x1080x24' \
			pnpm --filter nylas-mail e2e --$harness_args || status=\$?
		exit \$status
	" || status=$?

app="$repo/packages/client-app"
cp "$work/packages/client-app/e2e/axe-baseline.json" "$app/e2e/axe-baseline.json"
if [ -d "$work/packages/client-app/e2e/reference/linux" ]; then
	mkdir -p "$app/e2e/reference/linux"
	cp "$work/packages/client-app/e2e/reference/linux/"*.png "$app/e2e/reference/linux/" 2>/dev/null || true
fi
rm -rf "$app/e2e/.tmp/linux-report"
mkdir -p "$app/e2e/.tmp"
if [ -d "$work/packages/client-app/e2e/.tmp/report" ]; then
	cp -R "$work/packages/client-app/e2e/.tmp/report" "$app/e2e/.tmp/linux-report"
fi
exit "${status:-0}"
