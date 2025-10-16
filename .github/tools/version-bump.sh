#!/bin/bash

# Version Bump Script for luci-app-droidnet
# Usage: ./version-bump.sh <bump_type>
#   bump_type: patch, minor, or major

set -euo pipefail

usage() {
  echo "Usage: $0 <bump_type>"
  echo "  bump_type: patch, minor, or major"
  echo ""
  echo "Examples:"
  echo "  $0 patch                    # Update versions with patch bump"
  echo "  $0 minor                    # Update versions with minor bump"
  echo "  $0 major                    # Update versions with major bump"
  exit 1
}

validate_version() {
  local version="$1"
  if ! [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "❌ Invalid version format: '$version'. Expected X.Y.Z format." >&2
    return 1
  fi
  return 0
}

bump_version() {
  local current_version="$1"
  local bump_type="$2"

  IFS='.' read -r major minor patch <<< "$current_version"

  case "$bump_type" in
    "patch")
      echo "$major.$minor.$((patch + 1))"
      ;;
    "minor")
      echo "$major.$((minor + 1)).0"
      ;;
    "major")
      echo "$((major + 1)).0.0"
      ;;
    *)
      echo "❌ Invalid bump type: '$bump_type'. Expected patch, minor, or major." >&2
      return 1
      ;;
  esac
}

update_package_json() {
  local new_version="$1"
  local package_json="package.json"
  
  if [ -f "$package_json" ]; then
    echo "Updating $package_json"
    sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$new_version\"/" "$package_json"
    return 0
  fi
  return 1
}

update_makefile() {
  local new_version="$1"
  local makefile="Makefile"
  local src_makefile="src/Makefile"
  local updated=false
  
  if [ -f "$makefile" ]; then
    echo "Updating $makefile"
    sed -i "s/PKG_VERSION:=.*/PKG_VERSION:=$new_version/" "$makefile"
    updated=true
  fi
  
  if [ -f "$src_makefile" ]; then
    echo "Updating $src_makefile"
    sed -i "s/PKG_VERSION:=.*/PKG_VERSION:=$new_version/" "$src_makefile"
    updated=true
  fi
  
  if [ "$updated" = true ]; then
    return 0
  fi
  return 1
}

main() {
  if [ $# -ne 1 ]; then
    usage
  fi

  local bump_type="$1"

  case "$bump_type" in
    "patch" | "minor" | "major") ;;
    *)
      echo "❌ Invalid bump type: '$bump_type'. Expected patch, minor, or major." >&2
      exit 1
      ;;
  esac

  echo "🔍 Getting current version..."

  local current_version
  if [ -f "package.json" ]; then
    current_version=$(grep '"version"' package.json | sed 's/.*"version": "\([^"]*\)".*/\1/')
  else
    echo "❌ package.json not found"
    exit 1
  fi

  echo "Current version: $current_version"

  if ! validate_version "$current_version"; then
    exit 1
  fi

  local new_version
  new_version=$(bump_version "$current_version" "$bump_type")

  echo "New version: $new_version"

  local has_changes=false

  if update_package_json "$new_version"; then
    has_changes=true
  fi

  if update_makefile "$new_version"; then
    has_changes=true
  fi

  echo ""
  echo "📋 Summary:"
  echo "Bump Type: $bump_type"
  echo "Version: v$current_version → v$new_version"
  echo ""

  if [ "$has_changes" = true ]; then
    echo "✅ Version bump completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Review the changes: git diff"
    echo "2. Commit the changes: git add . && git commit -m 'chore: bump version to v$new_version'"
    echo "3. Create a tag: git tag v$new_version"
    echo "4. Push changes and tag: git push && git push --tags"
    exit 0
  else
    echo "ℹ️  No files were updated."
    exit 0
  fi
}

main "$@"