# Graphify (MovPrompt, fast/low-token)

Use the existing knowledge graph. Do not rebuild unless the user explicitly asks.

## Fast path (default)

If `graphify-out/graph.json` exists and the user asked a codebase question:

```bash
if [ ! -f graphify-out/.graphify_python ]; then
  PYTHON=$(command -v python3)
  mkdir -p graphify-out
  "$PYTHON" -c "import sys; open('graphify-out/.graphify_python','w',encoding='utf-8').write(sys.executable)"
fi
graphify query "<question>" --budget 1500
```

Then answer from that output only. Quote `source_location` when citing a fact. Do not run detect, extract, cluster, label, HTML, Obsidian, wiki, or video transcription.

## Incremental update (only when asked)

```bash
graphify update . --no-viz --no-label
```

AST-only. Never `--mode deep`. Never dispatch semantic subagents. Never rebuild from scratch unless `graphify-out/graph.json` is missing or the user says `--force`.

## Forbidden by default

- Full `/graphify .` pipeline
- `--mode deep`, `--html`, `--svg`, `--obsidian`, `--wiki`, `--mcp`
- Whisper / video transcription
- Pasting the full `GRAPH_REPORT.md`

If the user asks `/graphify --help`, print official usage and stop.
