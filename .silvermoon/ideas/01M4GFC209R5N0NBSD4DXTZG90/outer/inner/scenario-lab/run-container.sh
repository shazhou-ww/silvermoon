#!/usr/bin/env bash
set -euo pipefail

cd /checkout
mkdir -p /scenario-lab/corpus

printf '%s\n' "Provisioning the device-level runtime and canonical skill from this checkout."
pnpm setup:dev

mkdir -p "${HOME}/.config/silvermoon"

find \
  /checkout/src/business/objectives \
  /checkout/dist/src/business/objectives \
  -type f -path '*/checks/*/run.js' -exec sed -i 's/\r$//' {} +

git init --bare /tmp/silvermoon-primary.git
git --git-dir=/tmp/silvermoon-primary.git fetch /scenario-source.bundle HEAD:refs/heads/main
primary_repository="$(git --git-dir=/tmp/silvermoon-primary.git show refs/heads/main:.silvermoon/config.yaml | sed -n 's/^primaryRepository: //p' | tr -d '\r')"
primary_branch="$(git --git-dir=/tmp/silvermoon-primary.git show refs/heads/main:.silvermoon/config.yaml | sed -n 's/^primaryBranch: //p' | tr -d '\r')"
if [[ -z "${primary_repository}" || -z "${primary_branch}" ]]; then
  printf '%s\n' "Project config must define primaryRepository and primaryBranch." >&2
  exit 1
fi

if [[ "${primary_branch}" != "main" ]]; then
  git --git-dir=/tmp/silvermoon-primary.git update-ref \
    "refs/heads/${primary_branch}" \
    refs/heads/main
  git --git-dir=/tmp/silvermoon-primary.git update-ref -d refs/heads/main
fi
git --git-dir=/tmp/silvermoon-primary.git symbolic-ref HEAD "refs/heads/${primary_branch}"
git clone --branch "${primary_branch}" file:///tmp/silvermoon-primary.git /workspace
git -C /workspace remote set-url origin "${primary_repository}"
git -C /workspace config \
  "url.file:///tmp/silvermoon-primary.git.insteadOf" \
  "${primary_repository}"
git -C /workspace fetch origin "${primary_branch}"
git -C /workspace switch --create scenario
git -C /workspace branch --set-upstream-to="origin/${primary_branch}" scenario

node /scenario-lab/collect.mjs
