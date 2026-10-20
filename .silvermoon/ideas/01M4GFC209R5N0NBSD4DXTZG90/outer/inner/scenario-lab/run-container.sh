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

primary_git="${HOME}/workspace-primary.git"
git init --bare "${primary_git}"
git --git-dir="${primary_git}" fetch /scenario-source.bundle HEAD:refs/heads/main
primary_repository="$(git --git-dir="${primary_git}" show refs/heads/main:.silvermoon/config.yaml | sed -n 's/^primaryRepository: //p' | tr -d '\r')"
primary_branch="$(git --git-dir="${primary_git}" show refs/heads/main:.silvermoon/config.yaml | sed -n 's/^primaryBranch: //p' | tr -d '\r')"
if [[ -z "${primary_repository}" || -z "${primary_branch}" ]]; then
  printf '%s\n' "Project config must define primaryRepository and primaryBranch." >&2
  exit 1
fi

if [[ "${primary_branch}" != "main" ]]; then
  git --git-dir="${primary_git}" update-ref \
    "refs/heads/${primary_branch}" \
    refs/heads/main
  git --git-dir="${primary_git}" update-ref -d refs/heads/main
fi
git --git-dir="${primary_git}" symbolic-ref HEAD "refs/heads/${primary_branch}"
git clone --branch "${primary_branch}" "file://${primary_git}" /workspace
git -C /workspace remote set-url origin "${primary_repository}"
git -C /workspace config \
  "url.file://${primary_git}.insteadOf" \
  "${primary_repository}"
git -C /workspace fetch origin "${primary_branch}"
git -C /workspace switch --create scenario
git -C /workspace branch --set-upstream-to="origin/${primary_branch}" scenario

node /scenario-lab/collect.mjs
