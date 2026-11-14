#!/usr/bin/env bash
# Builds the Linux packages (deb and AppImage) from a clean `git archive HEAD`
# copy in the pinned electronuserland/builder image (Ubuntu 22.04, glibc 2.35),
# the same image CI's dist job uses:
#
#   packages/client-app/scripts/dist-linux-docker.sh
#
# Native modules build from source, so they link against this image's glibc
# rather than the prebuilt binaries' newer one (#21). dist:linux runs the
# public-build and glibc floor checks inside the container. Only committed
# files are used, so commit first. The .deb and .AppImage are copied back to
# packages/client-app/dist/; the working tree's node_modules are never touched.
set -euo pipefail

here="$(CDPATH= cd -- "$(dirname "$0")" >/dev/null && pwd)"
repo="$(git -C "$here" rev-parse --show-toplevel)"
# The same digest as e2e/linux-docker.sh and .github/workflows/dist.yml
# (spec/linux-builder-image.spec.js fails if they drift).
image="${DIST_DOCKER_IMAGE:-electronuserland/builder@sha256:22c93521ff6ea682e7ef153bb4846d90b769aa3b3f3f3be9ec9090aabc3e877c}"
work="$(mktemp -d "${TMPDIR:-/tmp}/nylas-dist-linux.XXXXXX")"
trap 'rm -rf "$work"' EXIT

git -C "$repo" archive HEAD | tar -x -C "$work"

docker run --rm --platform linux/amd64 \
	-v "$work:/project" \
	-v nylas-e2e-pnpm-store:/pnpm-store \
	-e npm_config_store_dir=/pnpm-store \
	-e npm_config_build_from_source=true \
	-e CSC_IDENTITY_AUTO_DISCOVERY=false \
	-w /project \
	-e CI=1 \
	"$image" \
	bash -euo pipefail -c "
		corepack enable
		pnpm install --no-frozen-lockfile
		pnpm --filter nylas-mail dist:linux
	"

dist="$repo/packages/client-app/dist"
mkdir -p "$dist"
shopt -s nullglob
for ext in deb AppImage; do
	built=("$work/packages/client-app/dist/"*."$ext")
	if [ "${#built[@]}" -eq 0 ]; then
		echo "dist-linux-docker: no .$ext was built" >&2
		exit 1
	fi
	for file in "${built[@]}"; do
		cp "$file" "$dist/"
		echo "$dist/$(basename "$file")"
	done
done
