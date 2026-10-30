// When a structure is present, read from the ontology itself.
//
// Three members curate a stage range and all three record it on the term as a
// relation to a stage, which OLS serves on the /graph endpoint. It is not in
// the term's `annotation` block, which is why this looked unreachable at first
// and briefly went through ZFIN's download files instead.
//
// The relations are not the same, and the differences are real rather than
// cosmetic:
//
//   EMAPA  RO_0002489 existence starts with            an exact stage
//   ZFA    RO_0002496 existence starts during or after a bound, not a point
//   XAO    xao#start_stage                             the ontology's own property
//
// So the relation travels with the stage and is shown, rather than being
// flattened into one phrasing that would overstate ZFA's precision.

const START_PROPERTIES = new Set(['RO_0002488', 'RO_0002489', 'RO_0002496', 'xao#start_stage']);
const END_PROPERTIES = new Set(['RO_0002492', 'RO_0002493', 'RO_0002497', 'xao#end_stage']);

// The stage edges have a section of their own, so the relations list leaves
// them out rather than repeating them as `existence starts with`.
export const STAGE_PROPERTIES = new Set([...START_PROPERTIES, ...END_PROPERTIES]);

export default function stageRange(edges) {
  let start;
  let end;
  for (const edge of edges || []) {
    // Only an assertion the term makes about itself describes its own range.
    if (edge.direction !== 'out') {
      continue;
    }
    if (!start && START_PROPERTIES.has(edge.property)) {
      start = edge;
    } else if (!end && END_PROPERTIES.has(edge.property)) {
      end = edge;
    }
  }

  // A term with only one end of the range is not a window. Both or nothing.
  return start && end ? { start, end } : null;
}
