#!/usr/bin/env bash
# Proves the Linux .deb runs on stock Ubuntu 22.04 (glibc 2.35, #21): installs
# it on a plain ubuntu:22.04 image and runs the e2e harness against the
# installed app under xvfb. Build the deb first:
#
#   packages/client-app/scripts/dist-linux-docker.sh
#   packages/client-app/e2e/linux-deb-docker.sh
#
# Stage 1 installs the harness's node_modules on a clean `git archive HEAD`
# copy in the pinned builder image (from source, like the deb's own native
# modules). Stage 2 runs on stock ubuntu:22.04 with only Node, xvfb and the
# deb (which pulls its own dependencies). Only committed files are used, so
# commit first. The Playwright report lands in e2e/.tmp/linux-deb-report/.
set -euo pipefail

here="$(CDPATH= cd -- "$(dirname "$0")" >/dev/null && pwd)"
repo="$(git -C "$here" rev-parse --show-toplevel)"
app="$repo/packages/client-app"
# The same digest as e2e/linux-docker.sh and .github/workflows/dist.yml
# (spec/linux-builder-image.spec.js fails if they drift).
builder="electronuserland/builder@sha256:22c93521ff6ea682e7ef153bb4846d90b769aa3b3f3f3be9ec9090aabc3e877c"
# ubuntu:22.04 as of 2026-11-14
stock="ubuntu@sha256:74b12b11ffa550fba1929ad4d8d16533c34f6612728469671afba1b03b66881c"
# The builder image's Node, so stage 1's native modules load in stage 2.
node_version="24.22.1"

version="$(node -p "require('$app/package.json').version")"
deb="nylas-mail_${version}_amd64.deb"
if [ ! -f "$app/dist/$deb" ]; then
	echo "linux-deb-docker: no $app/dist/$deb; build it with scripts/dist-linux-docker.sh" >&2
	exit 1
fi

work="$(mktemp -d "${TMPDIR:-/tmp}/nylas-e2e-deb.XXXXXX")"
trap 'rm -rf "$work"' EXIT
git -C "$repo" archive HEAD | tar -x -C "$work"
cp "$app/dist/$deb" "$work/$deb"

docker run --rm --platform linux/amd64 \
	-v "$work:/project" \
	-v nylas-e2e-pnpm-store:/pnpm-store \
	-e npm_config_store_dir=/pnpm-store \
	-e npm_config_build_from_source=true \
	-w /project \
	-e CI=1 \
	"$builder" \
	bash -euo pipefail -c "
		corepack enable
		pnpm install --no-frozen-lockfile
	"

# --no-sandbox and the GPU flags match linux-docker.sh: the container blocks
# the sandbox's namespaces, and under qemu (an arm64 host) the GPU process
# only starts with the other three.
docker run --rm --platform linux/amd64 \
	-v "$work:/project" \
	-w /project \
	-e CI=1 \
	-e DEBIAN_FRONTEND=noninteractive \
	-e E2E_LAUNCH_ARGS="--no-sandbox --disable-gpu --in-process-gpu --no-zygote" \
	"$stock" \
	bash -euo pipefail -c "
		apt-get update
		apt-get install -y --no-install-recommends ca-certificates curl xz-utils xvfb xauth
		cd /tmp
		curl -fsSLO https://nodejs.org/dist/v$node_version/node-v$node_version-linux-x64.tar.xz
		curl -fsSLO https://nodejs.org/dist/v$node_version/SHASUMS256.txt
		grep ' node-v$node_version-linux-x64.tar.xz\$' SHASUMS256.txt | sha256sum -c -
		tar -xJf node-v$node_version-linux-x64.tar.xz -C /usr/local --strip-components=1
		cd /project
		apt-get install -y --no-install-recommends ./$deb
		# the deb's dependencies are enough; nothing else is installed
		useradd -m e2e
		chown -R e2e /project
		status=0
		cd /project/packages/client-app
		runuser -u e2e -- env HOME=/home/e2e E2E_APP_PATH='/opt/Nylas Mail/nylas-mail' \
			xvfb-run --auto-servernum --server-args='-screen 0 1920x1080x24' \
			node e2e/run.mjs || status=\$?
		exit \$status
	" || status=$?

rm -rf "$app/e2e/.tmp/linux-deb-report"
mkdir -p "$app/e2e/.tmp"
if [ -d "$work/packages/client-app/e2e/.tmp/report" ]; then
	cp -R "$work/packages/client-app/e2e/.tmp/report" "$app/e2e/.tmp/linux-deb-report"
fi
exit "${status:-0}"
