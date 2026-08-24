#!/usr/bin/env bash

set -euo pipefail

origin_remote="origin"
upstream_remote="upstream"

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "Error: run this script inside a Git repository." >&2
  exit 1
}

cd "$repo_root"

if [[ -n $(git status --porcelain) ]]; then
  echo "Error: the worktree is not clean. Commit or stash your changes before syncing." >&2
  exit 1
fi

branch=$(git symbolic-ref --quiet --short HEAD) || {
  echo "Error: detached HEAD. Switch to the branch you want to sync first." >&2
  exit 1
}

if ! git remote get-url "$origin_remote" >/dev/null 2>&1; then
  echo "Error: remote '$origin_remote' is not configured." >&2
  exit 1
fi

if ! git remote get-url "$upstream_remote" >/dev/null 2>&1; then
  echo "Error: remote '$upstream_remote' is not configured." >&2
  exit 1
fi

echo "Fetching $origin_remote and $upstream_remote..."
git fetch --prune "$origin_remote"
git fetch --prune "$upstream_remote"

for remote in "$origin_remote" "$upstream_remote"; do
  if ! git show-ref --verify --quiet "refs/remotes/$remote/$branch"; then
    echo "Error: branch '$branch' does not exist on remote '$remote'." >&2
    exit 1
  fi
done

safe_branch=${branch//\//-}
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_branch="backup/${safe_branch}-before-upstream-${timestamp}"

git branch "$backup_branch"
echo "Created recovery branch: $backup_branch"

merge_remote_branch() {
  local remote=$1
  local remote_branch="$remote/$branch"

  echo "Merging $remote_branch into $branch..."
  if ! git merge --no-edit "$remote_branch"; then
    echo >&2
    echo "Merge conflict while merging $remote_branch." >&2
    echo "Resolve the conflicts and commit, or run 'git merge --abort'." >&2
    echo "Recovery branch: $backup_branch" >&2
    exit 1
  fi
}

merge_remote_branch "$origin_remote"
merge_remote_branch "$upstream_remote"

echo
echo "Sync complete. Review the result, run the project checks, then push with:"
echo "  git push $origin_remote $branch"
echo
echo "Recovery branch: $backup_branch"
