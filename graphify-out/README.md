# MovPrompt local project graph

Open `graph.html` in a browser. `graph.json` is the full graph and `GRAPH_REPORT.md` contains the audit and community report.

From the project root:

```sh
graphify query 'gateway readiness' --budget 2000
graphify query 'guest claim recovery' --budget 2000
graphify explain 'render-lifecycle.ts'
```

For a fresh build after source changes, ask Codex to run the Graphify skill locally. No GitHub push or graph hook is configured by this task. All artifacts in this directory are locally ignored by Git.

Read `INTEGRITY.md` before treating paths as exact dependencies. The AST extractor leaves unresolved import targets and the undirected graph collapses multiple relationships; source code is authoritative. Historical planning documents do not prove deployed readiness. Local setup secrets are deliberately excluded.

`docs-coverage.json`, `media-coverage.json`, `video-coverage.json`, and `code-coverage.json` describe the inspected corpus. Video transcripts are unverified and may hallucinate over music. `BENCHMARK.txt` is the library's heuristic comparison, not measured model usage; `cost.json` records unavailable host token counts honestly.
