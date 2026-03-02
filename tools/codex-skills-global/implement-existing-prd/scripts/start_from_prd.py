#!/usr/bin/env python3
"""Detect an existing PRD (md/json) and generate a `pnpm run ai:loop:start` command."""

from __future__ import annotations

import argparse
import json
import re
import shlex
import sys
from pathlib import Path
from typing import Iterable

IGNORE_PREFIXES = (
    ".git/",
    "node_modules/",
    "dist/",
    ".output/",
    ".vinxi/",
    "tools/ralph-loop/",
    ".ralph-loop/runtime/",
)

STOPWORDS = {
    "implement",
    "implementation",
    "start",
    "run",
    "execute",
    "from",
    "this",
    "that",
    "the",
    "a",
    "an",
    "feature",
    "prd",
    "for",
    "with",
    "using",
    "loop",
    "ralph",
    "please",
}

PENALTY_HINTS = ("demo", "smoke", "example", "sample", "test", "tmp")


def slugify(text: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "-", text.lower()).strip("-")
    value = re.sub(r"-{2,}", "-", value)
    return value or "feature"


def tokenize(query: str) -> list[str]:
    tokens = re.findall(r"[a-z0-9]+", query.lower())
    return [token for token in tokens if token not in STOPWORDS and len(token) > 1]


def is_ignored(path: Path, repo_root: Path) -> bool:
    rel = path.relative_to(repo_root).as_posix()
    return rel.startswith(IGNORE_PREFIXES)


def looks_like_prd_json(path: Path) -> bool:
    try:
        data = json.loads(path.read_text())
    except Exception:
        return False

    if not isinstance(data, dict):
        return False
    user_stories = data.get("userStories")
    return isinstance(user_stories, list)


def gather_candidates(repo_root: Path) -> list[Path]:
    found: dict[str, Path] = {}

    patterns = (
        ".ralph-loop/**/prd.json",
        "**/prd.json",
        "**/prd-*.json",
        "tasks/**/*.md",
        "**/prd-*.md",
    )

    for pattern in patterns:
        for path in repo_root.glob(pattern):
            if not path.is_file():
                continue
            if is_ignored(path, repo_root):
                continue

            name = path.name.lower()
            stem = path.stem.lower()
            suffix = path.suffix.lower()

            if suffix == ".json":
                if name == "prd.json" or name.startswith("prd-"):
                    if looks_like_prd_json(path):
                        found[str(path.resolve())] = path.resolve()
                continue

            if suffix == ".md" and "prd" in stem:
                found[str(path.resolve())] = path.resolve()

    return sorted(found.values())


def explicit_path_from_query(query: str, repo_root: Path) -> Path | None:
    candidates = re.findall(r"[^\s]+(?:\.md|\.json)", query)
    for raw in candidates:
        cleaned = raw.strip("'\"()[]{}<>,")
        p = Path(cleaned)
        if not p.is_absolute():
            p = (repo_root / p).resolve()
        if p.exists() and p.is_file():
            return p
    return None


def score_candidate(path: Path, repo_root: Path, query_tokens: Iterable[str], query_slug: str) -> int:
    rel = path.relative_to(repo_root).as_posix().lower()
    score = 0

    if query_slug and query_slug in rel:
        score += 50

    for token in query_tokens:
        if token in rel:
            score += 8

    if rel.startswith(".ralph-loop/"):
        score += 20
    if rel.startswith("tasks/"):
        score += 16

    if any(hint in rel for hint in PENALTY_HINTS):
        score -= 12

    return score


def choose_source(repo_root: Path, query: str, explicit_source: str | None) -> Path:
    if explicit_source:
        source = Path(explicit_source)
        if not source.is_absolute():
            source = (repo_root / source).resolve()
        if not source.exists() or not source.is_file():
            raise FileNotFoundError(f"Source file not found: {source}")
        return source

    from_query = explicit_path_from_query(query, repo_root)
    if from_query:
        return from_query

    candidates = gather_candidates(repo_root)
    if not candidates:
        raise FileNotFoundError(
            "No PRD candidate found. Expected `tasks/prd-*.md` or `.ralph-loop/<feature>/prd.json`."
        )

    query_tokens = tokenize(query)
    query_slug = slugify("-".join(query_tokens)) if query_tokens else ""

    ranked = sorted(
        candidates,
        key=lambda candidate: (
            score_candidate(candidate, repo_root, query_tokens, query_slug),
            candidate.stat().st_mtime,
        ),
        reverse=True,
    )

    return ranked[0]


def infer_feature_key(source: Path, query: str, explicit_feature: str | None) -> str:
    if explicit_feature:
        return slugify(explicit_feature)

    source_posix = source.as_posix()
    match = re.search(r"\.ralph-loop/([^/]+)/prd\.json$", source_posix)
    if match and match.group(1) != "runtime":
        return slugify(match.group(1))

    stem = source.stem.lower()
    if stem.startswith("prd-"):
        return slugify(stem[4:])

    if source.suffix.lower() == ".json" and stem == "prd":
        parent = source.parent.name
        if parent and parent not in {".ralph-loop", "tasks"}:
            return slugify(parent)
        try:
            data = json.loads(source.read_text())
            branch_name = data.get("branchName") if isinstance(data, dict) else None
            if isinstance(branch_name, str) and branch_name:
                branch_last = branch_name.split("/")[-1]
                if branch_last:
                    return slugify(branch_last)
        except Exception:
            pass

    query_tokens = tokenize(query)
    if query_tokens:
        return slugify("-".join(query_tokens))

    cleaned = re.sub(r"(^|-)prd(-|$)", "-", slugify(stem)).strip("-")
    return cleaned or "feature"


def build_command(args: argparse.Namespace, feature_key: str, source: Path) -> list[str]:
    command = [
        "pnpm",
        "run",
        "ai:loop:start",
        "--",
        feature_key,
        str(source),
        "--agent",
        args.agent,
        "--max-iterations",
        str(args.max_iterations),
        "--dangerous-exec",
        str(args.dangerous_exec),
        "--exec-retries",
        str(args.exec_retries),
    ]

    if args.prepare_only:
        command.append("--prepare-only")

    return command


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Detect existing PRD and generate ai:loop:start command with inferred parameters.",
    )
    parser.add_argument("request", help="User request text, e.g. 'Implement Dashboard Feature PRD'")
    parser.add_argument("--repo-root", default=".", help="Repository root (default: current directory)")
    parser.add_argument("--source", help="Explicit PRD source file path (.md or .json)")
    parser.add_argument("--feature", help="Explicit feature key override")
    parser.add_argument("--agent", default="codex", choices=["codex", "claude", "amp"])
    parser.add_argument("--max-iterations", type=int, default=10)
    parser.add_argument("--dangerous-exec", type=int, choices=[0, 1], default=1)
    parser.add_argument("--exec-retries", type=int, default=2)
    parser.add_argument("--prepare-only", action="store_true")
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve()

    if not (repo_root / "package.json").exists():
        print(f"[error] package.json not found at repo root: {repo_root}", file=sys.stderr)
        return 1

    start_script = repo_root / "scripts/ai/ralph-loop-start.sh"
    if not start_script.exists():
        print(
            "[error] Missing scripts/ai/ralph-loop-start.sh in repository. "
            "Install Ralph loop integration first.",
            file=sys.stderr,
        )
        return 1

    try:
        source = choose_source(repo_root, args.request, args.source)
    except FileNotFoundError as exc:
        print(f"[error] {exc}", file=sys.stderr)
        return 1

    feature_key = infer_feature_key(source, args.request, args.feature)
    command = build_command(args, feature_key, source)
    command_text = " ".join(shlex.quote(part) for part in command)

    print(f"Selected source: {source}")
    print(f"Inferred feature key: {feature_key}")
    print("Command:")
    print(command_text)
    print("Execution: command was not run automatically.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
