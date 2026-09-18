[graphify] MultiDiGraph edge-collapse diagnostic
input: <in-memory>
input_stage: provided JSON (normal graph.json is post-build)
effective_directed: <direct-call>
nodes: 6749
unverified_code_nodes: 0
raw_edges: 15685
valid_candidate_edges: 14735
missing_endpoint_edges: 0
dangling_endpoint_edges: 950
self_loop_edges: 3
exact_duplicate_edges: 6
directed_unique_endpoint_pairs: 14611
directed_same_endpoint_collapsed_edges: 124
undirected_unique_endpoint_pairs: 14603
undirected_same_endpoint_collapsed_edges: 132
same_endpoint_group_count: 122
relation_variant_groups: 87
source_file_variant_groups: 4
source_location_variant_groups: 27
context_variant_groups: 1
post_build_graph_type: Graph
post_build_edges: 14587
producer_suppression_sites: 12
producer_suppression_examples:
  - L1204 seen_ids arity=unknown
  - L1685 seen_ids arity=unknown
  - L1687 seen_doc_refs arity=unknown
  - L2052 seen_ids arity=unknown
  - L2199 seen_ids arity=unknown
  - L2837 seen_keys arity=unknown
  - L3006 seen_keys arity=unknown
  - L4698 seen_ids arity=unknown
examples:
  - apps_api_src_campaign_eligibility_createcampaigneligibilityservice -> apps_api_src_campaign_eligibility_createcampaigneligibilityservice_assertpresenter edges=3 relations=['calls', 'contains', 'indirect_call'] locations=['L106', 'L66', 'L82'] contexts=['', 'call', 'collection']
  - apps_web_src_lib_director_videomodelcatalog -> supabase_functions_shared_videomodelcatalog edges=3 relations=['imports_from', 're_exports'] locations=['L13', 'L6'] contexts=['export', 're-export']
  - apps_api_src_app -> apps_api_src_config edges=2 relations=['imports_from'] locations=['L15', 'L16'] contexts=['import']
  - apps_api_src_app_createapi -> apps_api_src_app_createapi_generationavailability edges=2 relations=['calls', 'contains'] locations=['L209', 'L93'] contexts=['', 'call']
  - apps_api_src_asset_content_verifier_createffmpegimagedecoder -> apps_api_src_asset_content_verifier_createffmpegimagedecoder_finish edges=2 relations=['calls', 'contains'] locations=['L191', 'L194'] contexts=['', 'call']
note: normal graph.json is post-build; raw producer loss must be measured earlier.