"""The path engine: which concepts a learner needs, in which order, to reach their question.

The concept map is a directed graph with an edge prerequisite → concept. For a set of target
concepts, the path is every target plus everything it depends on, minus what the learner already
knows, in an order where each concept comes after its prerequisites.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping

import networkx as nx

from app.content.schema import Concept


class UnknownConceptError(ValueError):
    pass


class CycleError(ValueError):
    pass


def build_graph(concepts: Mapping[str, Concept]) -> nx.DiGraph:
    """Build the prerequisite graph. Raises if a prerequisite is missing or there is a cycle."""
    graph = nx.DiGraph()
    for concept in concepts.values():
        graph.add_node(concept.id)
        for prereq in concept.prerequisites:
            if prereq not in concepts:
                raise UnknownConceptError(f"'{concept.id}' requires unknown concept '{prereq}'")
            graph.add_edge(prereq, concept.id)
    try:
        cycle = nx.find_cycle(graph)
    except nx.NetworkXNoCycle:
        return graph
    loop = " → ".join([edge[0] for edge in cycle] + [cycle[0][0]])
    raise CycleError(f"prerequisite cycle: {loop}")


def learning_path(
    graph: nx.DiGraph,
    targets: Iterable[str],
    known: Iterable[str] = (),
) -> list[str]:
    """Ordered list of concept ids to learn.

    A known concept is skipped, and so are prerequisites that are *only* needed for known
    concepts: if you already understand entanglement, you don't need to be walked back through
    everything under it just to reach a question that sits on top of it. A prerequisite that
    another unknown concept still needs stays in the path.

    Known targets are skipped too; if everything is known the path is empty.
    """
    targets = list(dict.fromkeys(targets))
    known = set(known)
    for concept_id in [*targets, *known]:
        if concept_id not in graph:
            raise UnknownConceptError(f"unknown concept '{concept_id}'")

    needed: set[str] = set()
    stack = [t for t in targets if t not in known]
    while stack:
        node = stack.pop()
        if node in needed:
            continue
        needed.add(node)
        stack.extend(p for p in graph.predecessors(node) if p not in known and p not in needed)

    # Break ties by depth in the full map (foundations first), then by id, so the same inputs
    # always give the same path. Stable order matters for the study: every learner with the same
    # answers sees the same sequence.
    depth = _depths(graph)
    subgraph = graph.subgraph(needed)
    return list(nx.lexicographical_topological_sort(subgraph, key=lambda n: (depth[n], n)))


def _depths(graph: nx.DiGraph) -> dict[str, int]:
    """Length of the longest prerequisite chain under each concept (0 for foundations)."""
    depth: dict[str, int] = {}
    for node in nx.topological_sort(graph):
        depth[node] = max((depth[p] + 1 for p in graph.predecessors(node)), default=0)
    return depth
