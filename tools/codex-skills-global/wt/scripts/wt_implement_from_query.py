#!/usr/bin/env python3
"""Resolve a loose PRD query under tasks/ and run `pnpm run ai:wt-implement`."""

from __future__ import annotations

import argparse
import re
import shlex
import subprocess
import sys
from pathlib import Path

STOPWORDS = {
    "a",
    "an",
    "and",
    "from",
    "implement",
    "implementation",
    "md",
    "please",
    "prd",
    "run",
    "the",
    "this",
    "to",
    "use",
    "with",
    "wt",
}

PENALTY_HINTS = ("example", "sample", "smoke", "test", "tmp")


def tokenize(text: str) -> list[str]:
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    return [token for token in tokens if token not in STOPWORDS and len(token) > 1]


def slugify(text: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return re.sub(r"-{2,}", "-", value)


def is_tasks_md(path: Path, repo_root: Path) -> bool:
    if not path.is_file() or path.suffix.lower() != ".md":
        return False
    try:
        rel = path.resolve().relative_to(repo_root.resolve())
    except ValueError:
        return False
    return rel.as_posix().startswith("tasks/")


def gather_candidates(repo_root: Path) -> list[Path]:
    tasks_dir = repo_root / "tasks"
    if not tasks_dir.exists() or not tasks_dir.is_dir():
        return []
    candidates = [path.resolve() for path in tasks_dir.rglob("*.md") if path.is_file()]
    return sorted(candidates)


def explicit_match(repo_root: Path, query: str) -> Path | None:
    raw = query.strip().strip("\"'")
    if not raw:
        return None

    probes: list[Path] = []
    raw_path = Path(raw)
    if raw_path.is_absolute():
        probes.append(raw_path.resolve())
    else:
        probes.append((repo_root / raw).resolve())
        probes.append((repo_root / "tasks" / raw).resolve())
        if not raw.endswith(".md"):
            probes.append((repo_root / f"{raw}.md").resolve())
            probes.append((repo_root / "tasks" / f"{raw}.md").resolve())

    seen: set[Path] = set()
    for probe in probes:
        if probe in seen:
            continue
        seen.add(probe)
        if is_tasks_md(probe, repo_root):
            return probe

    return None


def score_candidate(path: Path, repo_root: Path, query: str, tokens: list[str]) -> int:
    rel = path.relative_to(repo_root).as_posix().lower()
    stem = path.stem.lower()

    query_norm = query.lower().strip()
    query_slug = slugify(query)

    score = 0

    if query_norm == rel:
        score += 240
    if query_norm == stem:
        score += 220
    if query_slug and query_slug == stem:
        score += 200
    if query_norm and rel.endswith(query_norm):
        score += 140
    if query_slug and rel.endswith(query_slug):
        score += 130
    if query_norm and query_norm in stem:
        score += 100
    if query_slug and query_slug in stem:
        score += 90
    if query_norm and query_norm in rel:
        score += 80
    if query_slug and query_slug in rel:
        score += 70

    for token in tokens:
        if token in stem:
            score += 18
        elif token in rel:
            score += 10

    if rel.startswith("tasks/prd-"):
        score += 8

    if any(hint in rel for hint in PENALTY_HINTS):
        score -= 20

    return score


def choose_candidate(repo_root: Path, query: str, candidates: list[Path]) -> tuple[Path | None, list[tuple[Path, int]], str]:
    explicit = explicit_match(repo_root, query)
    if explicit is not None:
        return explicit, [], "explicit"

    tokens = tokenize(query)
    scored: list[tuple[Path, int]] = []
    for candidate in candidates:
        scored.append((candidate, score_candidate(candidate, repo_root, query, tokens)))

    ranked = sorted(
        scored,
        key=lambda item: (
            -item[1],
            -item[0].stat().st_mtime,
            len(item[0].relative_to(repo_root).as_posix()),
        ),
    )

    if not ranked or ranked[0][1] <= 0:
        return None, ranked, "no_match"

    top_score = ranked[0][1]
    top = [item for item in ranked if item[1] == top_score]
    if len(top) > 1:
        return None, ranked, "ambiguous"

    return ranked[0][0], ranked, "ranked"


def print_candidates(repo_root: Path, ranked: list[tuple[Path, int]], title: str, limit: int) -> None:
    print(title)
    for index, (path, score) in enumerate(ranked[:limit], start=1):
        rel = path.relative_to(repo_root).as_posix()
        print(f"  {index}. {rel} (score={score})")


def build_command(resolved_rel_path: str, passthrough: list[str]) -> list[str]:
    return ["pnpm", "run", "ai:wt-implement", "--", resolved_rel_path, *passthrough]


def parse_args(raw_args: list[str]) -> tuple[argparse.Namespace, list[str]]:
    if "--" in raw_args:
        divider = raw_args.index("--")
        left = raw_args[:divider]
        passthrough = raw_args[divider + 1 :]
    else:
        left = raw_args
        passthrough = []

    parser = argparse.ArgumentParser(
        description="Resolve a loose PRD matcher and run ai:wt-implement.",
    )
    parser.add_argument("query", nargs="+", help="Loose PRD matcher, e.g. 'devcontainer chromium'.")
    parser.add_argument("--repo-root", default=".", help="Repository root (default: current directory)")
    parser.add_argument("--print-only", action="store_true", help="Print resolved command without executing")
    parser.add_argument(
        "--max-candidates",
        type=int,
        default=5,
        help="How many candidates to show on ambiguity/no match",
    )

    args = parser.parse_args(left)
    return args, passthrough


def main() -> int:
    args, passthrough = parse_args(sys.argv[1:])
    query = " ".join(args.query).strip()

    repo_root = Path(args.repo_root).resolve()
    if not (repo_root / "package.json").exists():
        print(f"[error] package.json not found at repository root: {repo_root}", file=sys.stderr)
        return 1

    candidates = gather_candidates(repo_root)
    if not candidates:
        print("[error] No tasks/*.md files found.", file=sys.stderr)
        return 1

    resolved, ranked, reason = choose_candidate(repo_root, query, candidates)

    if resolved is None:
        if reason == "ambiguous":
            print("[error] Ambiguous PRD query. Multiple files tied for best score.", file=sys.stderr)
        else:
            print("[error] No PRD match found for query.", file=sys.stderr)
        print_candidates(
            repo_root,
            ranked,
            "Top candidates:",
            max(1, args.max_candidates),
        )
        print(
            "Hint: pass a more specific query or an explicit path like tasks/prd-worktrees.md.",
            file=sys.stderr,
        )
        return 2 if reason == "ambiguous" else 1

    resolved_rel = resolved.relative_to(repo_root).as_posix()
    command = build_command(resolved_rel, passthrough)
    command_text = " ".join(shlex.quote(part) for part in command)

    print(f"Resolved PRD: {resolved_rel}")
    print(f"Command: {command_text}")

    if args.print_only:
        print("Execution skipped (--print-only).")
        return 0

    completed = subprocess.run(command, cwd=repo_root, check=False)
    return completed.returncode


if __name__ == "__main__":
    raise SystemExit(main())
