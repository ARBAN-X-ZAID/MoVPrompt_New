# Local graph verification

- JSON parses: 6,540 nodes and 14,587 edges; all nodes have community names.
- HTML loaded in the Codex browser via 127.0.0.1:8768. Screenshot confirmed rendered node clusters and community legend.
- Clicking a graph node displayed Marketing Studio Configuration, degree 43, and its neighbor list.
- HTML is aggregated to 421 community nodes and 1,035 cross-community edges because the source graph exceeds 5,000 nodes.
- CLI query gateway readiness succeeds; output saved in QUERY_SMOKE.txt.
- Git check-ignore confirms graph.json and graph.html are locally excluded.
- Env files and .local-setup nodes: zero.
- See INTEGRITY.md for known unresolved/collapsed raw AST relationships; this is not a clean dependency-integrity claim.
