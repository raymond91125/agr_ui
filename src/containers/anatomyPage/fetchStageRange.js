import { curieToIri } from '../../lib/ols';

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

const OLS_BASE = 'https://www.ebi.ac.uk/ols4/api';

// Matched on the IRI's last segment: XAO declares a local property rather than
// reusing RO, so there is no single namespace to key off.
const START_PROPERTIES = new Set(['RO_0002488', 'RO_0002489', 'RO_0002496', 'xao#start_stage']);
const END_PROPERTIES = new Set(['RO_0002492', 'RO_0002493', 'RO_0002497', 'xao#end_stage']);

const propertyKey = (uri) => (uri || '').split('/').pop();

const iriToCurie = (iri) => {
  const tail = (iri || '').split('/').pop();
  const underscore = tail.indexOf('_');
  return underscore === -1 ? tail : `${tail.slice(0, underscore)}:${tail.slice(underscore + 1)}`;
};

export default async function fetchStageRange(ontology, curie) {
  if (!ontology?.stageSeries) {
    return null;
  }

  const iri = curieToIri(curie);
  const url = `${OLS_BASE}/ontologies/${ontology.olsId}/terms/${encodeURIComponent(encodeURIComponent(iri))}/graph`;

  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }
  const data = await response.json();

  const labels = new Map((data?.nodes || []).map((node) => [node.iri, node.label]));

  let start;
  let end;
  for (const edge of data?.edges || []) {
    // The graph carries this term's neighbourhood, ancestors included. Only
    // edges leaving the term itself describe the term's own stage range.
    if (edge?.source !== iri) {
      continue;
    }
    const key = propertyKey(edge.uri);
    const stage = {
      name: labels.get(edge.target) || iriToCurie(edge.target),
      curie: iriToCurie(edge.target),
      relation: edge.label,
    };
    if (!start && START_PROPERTIES.has(key)) {
      start = stage;
    } else if (!end && END_PROPERTIES.has(key)) {
      end = stage;
    }
  }

  // A term with only one end of the range is not a window. Both or nothing.
  return start && end ? { start, end } : null;
}
