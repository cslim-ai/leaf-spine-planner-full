# Calculation Cross-check Report

- Date: 2026-06-07
- Purpose: Cross-check project calculation output against an independent oracle.
- Result: No mismatches found in the tested cases.
- Recommendation: No source-code or calculation-formula correction is recommended from this validation run.
- Browser visual DOM check: not covered by this script. This script validates calculation and result-detail module outputs.

## Scope

| Axis | Values |
| --- | --- |
| Node count | 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024 |
| Node ports | 1, 2, 4, 8 |
| Node link speed | 25G, 100G, 200G, 400G, 800G |
| Leaf ports | 32, 64, 72, 128 |
| Leaf spare ports | 0, 2, 4, 8 |
| Leaf link speed | 100G, 200G, 400G, 800G |
| Spine ports | 32, 64, 72, 128 |
| Spine link speed | 100G, 200G, 400G, 800G |
| Twin-port options | Leaf, Leaf-Spine, Spine |
| Modes | nonblocking, oversubscribed 2:1, oversubscribed 3:1, oversubscribed 4:1 |
| Fabric designs | single, multi-planar, multi-pods, multi-planar + multi-pods |
| Custom switch counts | auto plus selected custom Leaf/Spine count pairs |

## Summary

| Metric | Count |
| --- | ---: |
| Generated pool | 111,150 |
| Checked cases | 73,447 |
| Feasible cases | 29,317 |
| Infeasible cases | 44,130 |
| Non-blocking cases | 18,851 |
| Oversubscribed cases | 54,596 |
| Multi-planar cases | 35,138 |
| Multi-pods cases | 37,279 |
| Custom switch count cases | 63,708 |
| Asymmetric Spine spec cases | 34,784 |
| Leaf Twin-port cases | 37,358 |
| Leaf-Spine Twin-port enabled cases | 18,891 |
| Spine Twin-port cases | 37,051 |
| Mismatch groups | 0 |

## Representative Cases

### Case 1: 512 nodes, 8 ports, 800G, multi-planar + multi-pods, Leaf-Spine Twin-port enabled

| Field | Value |
| --- | --- |
| Node count | 512 |
| Node ports | 8 |
| Node link speed | 800G |
| Leaf ports | 128 |
| Leaf spare ports | 8 |
| Leaf link speed | 100G |
| Leaf Twin-port | true |
| Native Leaf-Spine uplink | false |
| Spine ports | 64 |
| Spine link speed | 800G |
| Spine Twin-port | true |
| Mode | 2:1 oversubscribed |
| Multi-planar | true |
| Multi-pods | true |
| Pod node count | 16 |
| Feasible | true |
| Leaf count | 256 |
| Spine count | 256 |
| Per-group Leaf count | 4 |
| Per-group Spine count | 4 |
| Uplinks per Leaf | 128 |
| Total Leaf-Spine links | 32,768 |
| ECMP path count | 4-way |
| Oversubscription | 2 |
| Leaf port usage | 80 / 128 |
| Spine port usage | 64 / 64 |

### Case 2: 512 nodes, 8 ports, 800G, multi-planar + multi-pods, native Leaf-Spine uplinks

| Field | Value |
| --- | --- |
| Node count | 512 |
| Node ports | 8 |
| Node link speed | 800G |
| Leaf ports | 64 |
| Leaf spare ports | 4 |
| Leaf link speed | 200G |
| Leaf Twin-port | true |
| Native Leaf-Spine uplink | true |
| Spine ports | 64 |
| Spine link speed | 200G |
| Spine Twin-port | false |
| Mode | 4:1 oversubscribed |
| Multi-planar | true |
| Multi-pods | true |
| Pod node count | 128 |
| Feasible | true |
| Leaf count | 144 |
| Spine count | 72 |
| Per-group Leaf count | 18 |
| Per-group Spine count | 9 |
| Uplinks per Leaf | 29 |
| Total Leaf-Spine links | 4,176 |
| ECMP path count | 9-way |
| Oversubscription | 3.93 |
| Leaf port usage | 58 / 64 |
| Spine port usage | 58 / 64 |

### Case 3: Oversubscribed design

| Field | Value |
| --- | --- |
| Node count | 64 |
| Node ports | 8 |
| Node link speed | 400G |
| Leaf ports | 64 |
| Leaf spare ports | 4 |
| Leaf link speed | 800G |
| Leaf Twin-port | false |
| Native Leaf-Spine uplink | false |
| Spine ports | 64 |
| Spine link speed | 800G |
| Spine Twin-port | true |
| Mode | 2:1 oversubscribed |
| Multi-planar | false |
| Multi-pods | false |
| Pod node count | 64 |
| Feasible | true |
| Leaf count | 16 |
| Spine count | 16 |
| Per-group Leaf count | 16 |
| Per-group Spine count | 16 |
| Uplinks per Leaf | 16 |
| Total Leaf-Spine links | 256 |
| ECMP path count | 16-way |
| Oversubscription | 2 |
| Leaf port usage | 48 / 64 |
| Spine port usage | 8 / 64 |

### Case 4: Asymmetric Spine specification

| Field | Value |
| --- | --- |
| Node count | 32 |
| Node ports | 2 |
| Node link speed | 100G |
| Leaf ports | 72 |
| Leaf spare ports | 2 |
| Leaf link speed | 100G |
| Leaf Twin-port | true |
| Native Leaf-Spine uplink | true |
| Spine ports | 72 |
| Spine link speed | 800G |
| Spine Twin-port | false |
| Mode | nonblocking |
| Multi-planar | false |
| Multi-pods | true |
| Pod node count | 16 |
| Feasible | true |
| Leaf count | 4 |
| Spine count | 4 |
| Per-group Leaf count | 2 |
| Per-group Spine count | 2 |
| Uplinks per Leaf | 16 |
| Total Leaf-Spine links | 64 |
| ECMP path count | 2-way |
| Oversubscription | 1 |
| Leaf port usage | 24 / 72 |
| Spine port usage | 16 / 72 |

### Case 5: Infeasible input

| Field | Value |
| --- | --- |
| Node count | 1,024 |
| Node ports | 2 |
| Node link speed | 25G |
| Leaf ports | 32 |
| Leaf spare ports | 4 |
| Leaf link speed | 100G |
| Leaf Twin-port | false |
| Native Leaf-Spine uplink | false |
| Spine ports | 128 |
| Spine link speed | 200G |
| Spine Twin-port | true |
| Mode | 2:1 oversubscribed |
| Multi-planar | true |
| Multi-pods | true |
| Pod node count | 128 |
| Feasible | false |

## Mismatch Details

No mismatches were found.

## Conclusion

Based on 73,447 checked cases, the independent oracle matched the project calculation results and result-display derived values. No source-code or calculation-formula correction is recommended from this validation run.
