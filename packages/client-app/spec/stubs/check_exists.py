#!/usr/bin/env python3
"""Export worker spec files to the durable exports dir (survives worktree
teardown); validate parse + test-block count."""
import ast, os, shutil, subprocess, sys
wt, export = sys.argv[1], sys.argv[2]
os.makedirs(export, exist_ok=True)
out = subprocess.run(["find", os.path.join(wt, "packages/client-app/spec"), "-name", "*.spec.*"],
                     capture_output=True, text=True).stdout.split()
copied, bad, total_it = 0, [], 0
for p in out:
    if "node-bridges" in p or "/stubs/" in p:
        continue
    try:
        ast.parse(open(p).read())
    except SyntaxError as e:
        bad.append(f"{p}: SYNTAX {e}")
        continue
    shutil.copy2(p, os.path.join(export, os.path.basename(p)))
    copied += 1
    total_it += open(p).read().count("it(")
if bad:
    print("VIOLATIONS:"); [print(" ", b) for b in bad[:5]]; sys.exit(1)
if copied == 0 or total_it < 10:
    print(f"INSUFFICIENT: {copied} files {total_it} its"); sys.exit(1)
print(f"OK: {copied} files {total_it} its")
