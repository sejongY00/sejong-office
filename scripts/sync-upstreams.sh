#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECTS_DIR="$(cd "$ROOT_DIR/.." && pwd)"
DO_MERGE=false

if [[ "${1:-}" == "--merge" ]]; then
  DO_MERGE=true
fi

sync_repo() {
  local name="$1"
  local dir="$2"
  local upstream_url="$3"
  local upstream_branch="$4"

  echo "========================================"
  echo "[$name] ($dir)"
  echo "========================================"

  if [[ ! -d "$dir/.git" ]]; then
    echo "⚠️  저장소를 찾을 수 없습니다: $dir"
    return
  fi

  cd "$dir"

  if ! git remote get-url upstream >/dev/null 2>&1; then
    echo "➕ upstream 원격 저장소 등록: $upstream_url"
    git remote add upstream "$upstream_url"
  fi

  git fetch upstream "$upstream_branch" --tags --quiet

  local count
  count="$(git rev-list --count "HEAD..upstream/$upstream_branch")"

  if [[ "$count" == "0" ]]; then
    echo "✅ 이미 최신 상태입니다 (upstream/$upstream_branch)."
  else
    echo "🔔 upstream/$upstream_branch 에 새 커밋 ${count}개가 있습니다:"
    git log --oneline -n 10 "HEAD..upstream/$upstream_branch"
    if [[ "$DO_MERGE" == "true" ]]; then
      echo "🔄 upstream/$upstream_branch 머지 진행 중..."
      git merge "upstream/$upstream_branch" --no-edit
      echo "✅ 머지 완료! 확인 후 'cd $dir && git push origin main'으로 배포하세요."
    else
      echo "💡 머지하려면 'npm run sync:upstreams -- --merge'를 실행하세요."
    fi
  fi
  echo ""
}

sync_repo "document (OnlyOffice)" "$PROJECTS_DIR/document" "https://github.com/ranuts/document.git" "main"
sync_repo "rhwp (HWP Studio)" "$PROJECTS_DIR/rhwp" "https://github.com/edwardkim/rhwp.git" "main"
