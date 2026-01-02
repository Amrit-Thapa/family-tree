# ADR-001: Graph Rendering Strategy (SVG vs Canvas)

## Status
Accepted

## Context
The Family Tree application visualizes relationships between people.
The size of a family can range from a few members to hundreds of nodes.

The rendering solution must:
- Support interactive nodes (click, focus)
- Support zoom and pan
- Remain performant as the graph grows
- Be accessible where possible

## Options Considered

### Option 1: SVG Rendering
**Pros**
- Easy DOM inspection and debugging
- Native support for accessibility
- Simple event handling

**Cons**
- Performance degrades with large node counts
- DOM size grows quickly

### Option 2: Canvas Rendering
**Pros**
- Better performance for large graphs
- Lower memory footprint

**Cons**
- Harder accessibility support
- Manual event handling
- More complex debugging

## Decision
Use a **hybrid approach**:
- SVG for small to medium graphs
- Canvas for large graphs

## Consequences
- Increased implementation complexity
- Better long-term performance and scalability
- Clear separation between layout and rendering logic


## Notes
This decision favors long-term scalability over initial simplicity.
The hybrid approach allows development velocity early while avoiding
a hard rewrite when the dataset grows.
