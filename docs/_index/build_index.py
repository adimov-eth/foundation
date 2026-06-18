#!/usr/bin/env python3
"""Generate docs/_index/*.json — the agent fast-path — from the vault notes and
package source. Dependency-free (stdlib only). Run from repo root:  python3 docs/_index/build_index.py

Outputs (all under docs/_index/):
  packages.json  symbols.json  concepts.json  glossary.json  backlog.json  dangling-docs.json
symbols.json is SOURCE-DERIVED from each package's src/index.ts (re-exports, export *, direct
declares, aliases, type-only), with declaration sites resolved in the package source.
"""
import os, re, json, glob

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DOCS = os.path.join(ROOT, "docs")
IDX = os.path.join(DOCS, "_index")

def rel(p): return os.path.relpath(p, ROOT)
def strip_md(p): return p[:-3] if p.endswith(".md") else p

# ── front-matter ──────────────────────────────────────────────────────────────
def parse_fm(txt):
    if not txt.startswith("---"):
        return {}, txt
    end = txt.find("\n---", 3)
    if end < 0:
        return {}, txt
    block, body = txt[3:end].strip("\n"), txt[end+4:]
    fm, key = {}, None
    for line in block.split("\n"):
        if re.match(r"^\s*-\s+", line) and key:
            fm[key].append(re.sub(r"^\s*-\s+", "", line).split("#")[0].strip())
        else:
            m = re.match(r"^([A-Za-z0-9_\-]+):\s*(.*)$", line)
            if not m:
                continue
            k, v = m.group(1), m.group(2).strip()
            if v == "":
                fm[k] = []; key = k
            elif v.startswith("[") and v.endswith("]"):
                fm[k] = [x.strip() for x in v[1:-1].split(",") if x.strip()]; key = None
            else:
                fm[k] = v; key = None
    return fm, body

NOTES = {}
for n in glob.glob(f"{DOCS}/**/*.md", recursive=True):
    NOTES[os.path.relpath(n, DOCS)] = parse_fm(open(n, encoding="utf-8").read())

# ── package <-> repo path map ───────────────────────────────────────────────────
PKGMAP = {"plexus": "plexus"}
for p in ["arrival", "arrival-chain", "arrival-inference", "arrival-provenance",
          "arrival-chain-view", "arrival-sweet", "arrival-mcp", "arrival-serializer",
          "arrival-env", "arrival-scheme-env-infer", "arrival-scheme-env-ramda"]:
    PKGMAP[p] = f"arrival/{p}"
for c in ["collections", "error-invariant", "lexical-namer", "eslint-config", "tsconfig"]:
    PKGMAP[f"common-{c}"] = f"common/{c}"

# ── symbols.json (source-derived) ───────────────────────────────────────────────
RE_REEXPORT = re.compile(r'export\s+(type\s+)?\{([^}]*)\}\s*from\s*["\']([^"\']+)["\']')
RE_STAR     = re.compile(r'export\s+\*\s+from\s*["\']([^"\']+)["\']')
RE_DIRECT   = re.compile(r'^export\s+(?:declare\s+)?(?:default\s+)?(?:abstract\s+)?'
                         r'(const|let|var|class|function|interface|type|enum)\s+([A-Za-z0-9_$]+)')

def mod_to_file(srcdir, modpath):
    if not modpath.startswith("."):
        return None
    base = os.path.normpath(os.path.join(srcdir, modpath))
    for cand in (base, base[:-3] if base.endswith(".js") else base + ".ts",
                 (base[:-3] + ".ts") if base.endswith(".js") else base + ".ts",
                 os.path.join(base, "index.ts")):
        c = cand if cand.endswith(".ts") else cand + ".ts"
        if os.path.isfile(c):
            return c
    # try replacing .js -> .ts directly
    if base.endswith(".js") and os.path.isfile(base[:-3] + ".ts"):
        return base[:-3] + ".ts"
    return base + ".ts" if os.path.isfile(base + ".ts") else None

def find_decl(symbol, srcdir, prefer=None):
    """Return (decl_file, line, kind, signature) for symbol within a package src dir."""
    files = []
    if prefer and os.path.isfile(prefer):
        files.append(prefer)
    files += sorted(glob.glob(f"{srcdir}/**/*.ts", recursive=True))
    pat = re.compile(r'^export\s+(?:declare\s+)?(?:abstract\s+)?'
                     r'(const|let|var|class|function|interface|type|enum)\s+' + re.escape(symbol) + r'\b')
    pat2 = re.compile(r'^(?:export\s+)?(?:declare\s+)?(?:abstract\s+)?'
                      r'(class|function|interface|type|enum|const)\s+' + re.escape(symbol) + r'\b')
    seen = set()
    for f in files:
        if f in seen:
            continue
        seen.add(f)
        try:
            lines = open(f, encoding="utf-8", errors="replace").read().split("\n")
        except OSError:
            continue
        for i, ln in enumerate(lines, 1):
            m = pat.match(ln) or pat2.match(ln)
            if m:
                sig = ln.strip()
                sig = re.sub(r'^export\s+', '', sig)
                if not re.search(r'[;{]\s*$|\)\s*$|=\s*$|=>\s*$', sig) and len(sig) < 200:
                    sig += " (multiline)"
                return rel(f), i, m.group(1), sig[:200]
    return None, None, None, None

def index_exports(pkg, srcdir, indexfile, depth=0, acc=None, seen_files=None):
    if acc is None: acc = []
    if seen_files is None: seen_files = set()
    if not os.path.isfile(indexfile) or indexfile in seen_files or depth > 3:
        return acc
    seen_files.add(indexfile)
    lines = open(indexfile, encoding="utf-8", errors="replace").read().split("\n")
    idxrel = rel(indexfile)
    for i, ln in enumerate(lines, 1):
        m = RE_REEXPORT.search(ln)
        if m:
            type_only = bool(m.group(1))
            srcfile = mod_to_file(os.path.dirname(indexfile), m.group(3))
            for item in m.group(2).split(","):
                item = item.strip()
                if not item:
                    continue
                tonly = type_only or item.startswith("type ")
                item = re.sub(r'^type\s+', '', item)
                parts = re.split(r'\s+as\s+', item)
                orig = parts[0].strip()
                name = parts[-1].strip()
                df, dl, kind, sig = find_decl(orig, srcdir, prefer=srcfile)
                acc.append({"symbol": name, "kind": ("type" if tonly else (kind or "?")),
                            "package": pkg, "exported_from": f"{idxrel}:{i}",
                            "declared_at": (f"{df}:{dl}" if df else (rel(srcfile) if srcfile else "")),
                            "signature": sig or "", "note": ("aliased from " + orig) if name != orig else ""})
            continue
        m = RE_STAR.search(ln)
        if m:
            srcfile = mod_to_file(os.path.dirname(indexfile), m.group(1))
            if srcfile:
                index_exports(pkg, srcdir, srcfile, depth+1, acc, seen_files)
            continue
        m = RE_DIRECT.match(ln)
        if m and depth == 0:
            kind, name = m.group(1), m.group(2)
            sig = re.sub(r'^export\s+', '', ln.strip())
            acc.append({"symbol": name, "kind": kind, "package": pkg,
                        "exported_from": f"{idxrel}:{i}", "declared_at": f"{idxrel}:{i}",
                        "signature": sig[:200], "note": ""})
        elif m and depth > 0:  # direct export inside a star-reexported module
            kind, name = m.group(1), m.group(2)
            sig = re.sub(r'^export\s+', '', ln.strip())
            acc.append({"symbol": name, "kind": kind, "package": pkg,
                        "exported_from": f"{rel(indexfile)}:{i} (via export *)",
                        "declared_at": f"{rel(indexfile)}:{i}", "signature": sig[:200], "note": "via export *"})
    return acc

symbols = []
for pkgid, repo in PKGMAP.items():
    idx = os.path.join(ROOT, repo, "src", "index.ts")
    if os.path.isfile(idx):
        symbols += index_exports("@here.build/" + pkgid, os.path.join(ROOT, repo, "src"), idx)
# de-dup by (package, symbol)
seen, dedup = set(), []
for s in symbols:
    k = (s["package"], s["symbol"])
    if k in seen:
        continue
    seen.add(k); dedup.append(s)
symbols = sorted(dedup, key=lambda s: (s["package"], s["symbol"]))

# ── packages.json ───────────────────────────────────────────────────────────────
def pkg_json(repo):
    pj = os.path.join(ROOT, repo, "package.json")
    if not os.path.isfile(pj):
        return {}, []
    try:
        data = json.load(open(pj, encoding="utf-8"))
    except (OSError, ValueError):
        return {}, []
    eps = sorted(data.get("exports", {}).keys()) if isinstance(data.get("exports"), dict) else (["."] if data.get("main") else [])
    deps = sorted(data.get("dependencies", {}).keys()) if isinstance(data.get("dependencies"), dict) else []
    return {"entrypoints": eps, "deps": deps}, deps

packages = []
for relnote, (fm, body) in sorted(NOTES.items()):
    if not relnote.startswith("10-reference/packages/") or relnote.endswith("_moc.md"):
        continue
    base = strip_md(os.path.basename(relnote))
    repo = PKGMAP.get(base)
    extra, _ = pkg_json(repo) if repo else ({}, [])
    packages.append({"name": base, "repo_path": repo or "", "note": "docs/" + relnote,
                     "summary": fm.get("summary", ""),
                     "entrypoints": extra.get("entrypoints", []),
                     "deps": extra.get("deps", []),
                     "code_anchors": fm.get("code-anchors", [])})

# ── concepts.json ───────────────────────────────────────────────────────────────
concepts = {}
for relnote, (fm, body) in NOTES.items():
    for c in fm.get("canonical-for", []):
        concepts[c] = "docs/" + relnote

# ── glossary.json ───────────────────────────────────────────────────────────────
gloss = []
gtxt = open(f"{DOCS}/00-meta/glossary.md", encoding="utf-8").read().split("\n")
i = 0
while i < len(gtxt):
    h = re.match(r"^###\s+(\S+)", gtxt[i])
    if h:
        slug = h.group(1)
        body = ""
        for j in range(i+1, min(i+4, len(gtxt))):
            if gtxt[j].strip():
                body = gtxt[j].strip(); break
        bm = re.match(r"^\*\*(.+?)\*\*\s+—\s+(.*)$", body)
        term = bm.group(1) if bm else slug
        rest = bm.group(2) if bm else body
        see = re.search(r"\[\[([^\]|#]+)", rest)
        defn = re.split(r"\s*→\s*", rest)[0]
        gloss.append({"slug": slug, "term": term, "definition": defn.strip(),
                      "see": see.group(1) if see else ""})
    i += 1

# ── backlog.json ────────────────────────────────────────────────────────────────
backlog = []
for f in sorted(glob.glob(f"{DOCS}/90-backlog/items/*.md")):
    fm, body = NOTES[os.path.relpath(f, DOCS)]
    base = strip_md(os.path.basename(f))
    mp = re.match(r"(\d+)-p(\d)-(.+)", base)
    h1 = re.search(r"^#\s+(.+)", body, re.M)
    backlog.append({"id": base, "order": int(mp.group(1)) if mp else 0,
                    "priority": "P" + mp.group(2) if mp else "?",
                    "slug": mp.group(3) if mp else base,
                    "title": fm.get("title") or (h1.group(1).strip() if h1 else base),
                    "note": "docs/" + os.path.relpath(f, DOCS)})
backlog.sort(key=lambda x: x["order"])

# ── dangling-docs.json ──────────────────────────────────────────────────────────
dang = []
for line in open(f"{DOCS}/30-reconciliation/dangling-doc-map.md", encoding="utf-8"):
    if not line.startswith("|") or re.match(r"^\|\s*-{2,}", line) or "Referenced doc" in line:
        continue
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    if not cells:
        continue
    mds = re.findall(r"[\w./\-]+\.md", cells[0])
    if not mds:
        continue
    status = "recoverable" if "40-history" in line else "lost"
    code = ""
    if len(cells) > 1:
        cm = re.findall(r"`([^`]+:\d+)`", cells[1])
        code = ", ".join(cm)
    rec = ""
    if status == "recoverable":
        rm = re.search(r"\[\[([^\]|#]+)", line.replace("\\|", "|"))
        rec = rm.group(1) if rm else ""
    dang.append({"ref": mds[0], "status": status, "referenced_by": code, "recovered_as": rec})

# ── write ───────────────────────────────────────────────────────────────────────
out = {"packages.json": packages, "symbols.json": symbols, "concepts.json": concepts,
       "glossary.json": gloss, "backlog.json": backlog, "dangling-docs.json": dang}
for fn, data in out.items():
    json.dump(data, open(os.path.join(IDX, fn), "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    print(f"{fn}: {len(data)} entries")
