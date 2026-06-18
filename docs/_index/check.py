#!/usr/bin/env python3
"""Validate the docs vault: the machine-readable fast-path and the markdown navigation must
AGREE. Dependency-free. Run from repo root:  python3 docs/_index/check.py
Exits non-zero on any failure. Checks:
  - all _index/*.json parse
  - every front-matter has required fields
  - every [[wikilink]] resolves (file + #heading anchor; de-escapes table \\|)
  - every structured `path:line` anchor (front-matter code-anchors, JSON, strict inline) resolves
  - no concept is canonical-for in more than one note
"""
import os, re, json, glob, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DOCS = os.path.join(ROOT, "docs")
fail, warn = [], []

def parse_fm(txt):
    if not txt.startswith("---"):
        return {}, txt, 0
    end = txt.find("\n---", 3)
    if end < 0:
        return {}, txt, 0
    block, body = txt[3:end].strip("\n"), txt[end+4:]
    fm, key = {}, None
    for line in block.split("\n"):
        if re.match(r"^\s*-\s+", line) and key:
            fm[key].append(re.sub(r"^\s*-\s+", "", line).split("#")[0].strip())
        else:
            m = re.match(r"^([A-Za-z0-9_\-]+):\s*(.*)$", line)
            if not m: continue
            k, v = m.group(1), m.group(2).strip()
            if v == "": fm[k] = []; key = k
            elif v.startswith("[") and v.endswith("]"):
                fm[k] = [x.strip() for x in v[1:-1].split(",") if x.strip()]; key = None
            else: fm[k] = v; key = None
    return fm, body, 0

def strip_md(p): return p[:-3] if p.endswith(".md") else p
def kebab(s): return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

# collect notes
notes = {}                  # relpath(no .md) -> {fm, headings(set of normed), basename}
basemap = {}
for n in glob.glob(f"{DOCS}/**/*.md", recursive=True):
    relp = strip_md(os.path.relpath(n, DOCS))
    txt = open(n, encoding="utf-8").read()
    fm, body, _ = parse_fm(txt)
    heads = set()
    for ln in txt.split("\n"):
        hm = re.match(r"^#{1,6}\s+(.*)$", ln)
        if hm:
            h = hm.group(1).strip()
            heads.add(h.lower()); heads.add(kebab(h))
    notes[relp] = {"fm": fm, "heads": heads, "abs": n}
    basemap.setdefault(os.path.basename(relp), []).append(relp)

# 1. JSON parse
idx = {}
for f in glob.glob(f"{DOCS}/_index/*.json"):
    try:
        idx[os.path.basename(f)] = json.load(open(f, encoding="utf-8"))
    except ValueError as e:
        fail.append(f"JSON parse {os.path.basename(f)}: {e}")

# 2. front-matter required fields
REQ = ["title", "layer", "status", "tags", "last-verified", "verified-against"]
for relp, info in notes.items():
    for k in REQ:
        if k not in info["fm"]:
            fail.append(f"front-matter missing '{k}': docs/{relp}.md")

# 3. wikilinks
def resolve_target(t):
    t = t.replace("\\|", "|").split("|")[0].strip()
    anchor = ""
    if "#" in t:
        t, anchor = t.split("#", 1)
    t = t.strip(); anchor = anchor.strip()
    if t == "":            # same-file heading link
        return True, None, anchor
    if t.startswith("docs/"): t = t[5:]
    t = strip_md(t)
    target = None
    if t in notes: target = t
    elif os.path.basename(t) in basemap: target = basemap[os.path.basename(t)][0]
    return (target is not None), target, anchor

LINK = re.compile(r"\[\[([^\]]+)\]\]")
for relp, info in notes.items():
    txt = open(info["abs"], encoding="utf-8").read()
    # skip fenced code & inline code to avoid placeholder examples
    txt_nocode = re.sub(r"`[^`]*`", "", re.sub(r"```.*?```", "", txt, flags=re.S))
    for m in LINK.findall(txt_nocode):
        raw = m.replace("\\|", "|").split("|")[0]
        if raw.strip() in ("", "…") or "…" in raw:
            continue
        ok, target, anchor = resolve_target(m)
        if not ok:
            fail.append(f"broken wikilink [[{m}]] in docs/{relp}.md")
            continue
        if anchor and target is not None:
            heads = notes[target]["heads"]
            if anchor.lower() not in heads and kebab(anchor) not in heads:
                fail.append(f"unresolved #anchor [[{m}]] in docs/{relp}.md")

# 4. path:line anchors
REPO_ANCHOR = re.compile(r"(?:^|[\s`(])((?:arrival|plexus|common)/[\w./\-]+\.(?:ts|tsx|scm|json|js)):(\d+)")
def check_anchor(a, src):
    m = re.match(r"^((?:arrival|plexus|common)/[\w./\-]+):(\d+)$", a)
    if not m: return
    p, ln = m.group(1), int(m.group(2))
    full = os.path.join(ROOT, p)
    if not os.path.isfile(full):
        fail.append(f"anchor file missing {a} ({src})"); return
    n = sum(1 for _ in open(full, encoding="utf-8", errors="replace"))
    if ln > n:
        fail.append(f"anchor line OOB {a} (file has {n}) ({src})")

# 4a. front-matter code-anchors
for relp, info in notes.items():
    for a in info["fm"].get("code-anchors", []):
        check_anchor(a.split()[0], f"docs/{relp}.md code-anchors")
# 4b. JSON anchors (symbols declared_at/exported_from, packages code_anchors)
for s in idx.get("symbols.json", []):
    for key in ("declared_at", "exported_from"):
        raw = (s.get(key) or "").split()
        v = raw[0] if raw else ""
        if ":" in v: check_anchor(v, f"symbols.json {s.get('symbol')}")
for p in idx.get("packages.json", []):
    for a in p.get("code_anchors", []):
        check_anchor(a.split()[0], f"packages.json {p.get('name')}")
# 4c. strict inline anchors in prose
for relp, info in notes.items():
    if relp.startswith("40-history"):  # frozen copies may cite old lines
        continue
    txt = open(info["abs"], encoding="utf-8").read()
    for m in REPO_ANCHOR.finditer(txt):
        check_anchor(f"{m.group(1)}:{m.group(2)}", f"docs/{relp}.md inline")

# 5. canonical-for uniqueness
owner = {}
for relp, info in notes.items():
    for c in info["fm"].get("canonical-for", []):
        if c in owner:
            fail.append(f"duplicate canonical-for '{c}': docs/{relp}.md & docs/{owner[c]}.md")
        else:
            owner[c] = relp

# report
print(f"notes={len(notes)}  json={len(idx)}  concepts={len(owner)}")
for f in idx:
    print(f"  {f}: {len(idx[f])}")
if warn:
    print(f"\nWARN ({len(warn)}):")
    for w in warn[:40]: print("  ", w)
if fail:
    print(f"\nFAIL ({len(fail)}):")
    for f in fail[:80]: print("  ", f)
    sys.exit(1)
print("\nOK — fast-path and markdown navigation agree.")
