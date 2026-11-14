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

here="$(CDPATH= cd -- "$(dirname "$0")" >/dev/null && pwd)"
repo="$(git -C "$here" rev-parse --show-toplevel)"
# Pinned by digest so the Linux references and axe baseline don't drift with
# the image's fonts and libraries (the 2026-10-24 build of :latest).
image="${E2E_DOCKER_IMAGE:-electronuserland/builder@sha256:22c93521ff6ea682e7ef153bb4846d90b769aa3b3f3f3be9ec9090aabc3e877c}"
work="$(mktemp -d "${TMPDIR:-/tmp}/nylas-e2e-linux.XXXXXX")"
trap 'rm -rf "$work"' EXIT

git -C "$repo" archive HEAD | tar -x -C "$work"

harness_args=""
for arg in "$@"; do harness_args+=" $(printf '%q' "$arg")"; done

# The unpacked app's chrome-sandbox isn't setuid, so it needs --no-sandbox;
# under qemu emulation (an arm64 host) the GPU process only starts with the
# other three flags. Native modules build from source so they link against
# this image's glibc rather than the prebuilt binaries' newer one (#21).
docker run --rm --platform linux/amd64 \
	-v "$work:/project" \
	-v nylas-e2e-pnpm-store:/pnpm-store \
	-e npm_config_store_dir=/pnpm-store \
	-e npm_config_build_from_source=true \
	-w /project \
	-e CI=1 \
	-e E2E_LAUNCH_ARGS="--no-sandbox --disable-gpu --in-process-gpu --no-zygote" \
	"$image" \
	bash -euo pipefail -c "
		corepack enable
		pnpm install --no-frozen-lockfile
		pnpm --filter nylas-mail build:e2e
		# Electron's runtime libraries aren't in the builder image. Chromium's
		# list from Playwright covers nss, gbm and xvfb; Electron also links
		# GTK 3 and a few desktop libraries that list leaves out.
		pnpm --filter nylas-mail exec playwright install-deps chromium
		apt-get install -y --no-install-recommends libgtk-3-0 libnotify4 libxss1 libxtst6 libsecret-1-0
		# CI runs the harness as an ordinary user, and Electron refuses some
		# child processes as root, so run it as one here too.
		useradd -m e2e
		chown -R e2e /project
		status=0
		cd /project/packages/client-app
		runuser -u e2e -- env HOME=/home/e2e \
			xvfb-run --auto-servernum --server-args='-screen 0 1920x1080x24' \
			node e2e/run.mjs$harness_args || status=\$?
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
