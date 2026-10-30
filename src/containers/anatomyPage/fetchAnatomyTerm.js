import { fetchOlsTerm, fetchOlsGraph } from '../../lib/ols';
import groupRelations from './relations.js';
import stageRange from './stageRange.js';

// The single seam between the anatomy page and whatever serves anatomy terms.
//
// Today that is OLS4, because the Alliance API has no anatomy endpoints — see
// the anatomy page design memo. When /api/anatomy/{id} lands it will return the
// term and its relations in one document, the way /api/disease/{id} already
// does, and only this function changes.
//
// Two calls, not four: /graph carries the parents and children the hierarchy
// calls return *and* the property on each edge, so the relations and the stage
// range are two readings of one response rather than two requests.
export default async function fetchAnatomyTerm(ontology, curie) {
  const [term, edges] = await Promise.all([fetchOlsTerm(ontology.olsId, curie), fetchOlsGraph(ontology.olsId, curie)]);
  // A curie that is well-formed but not in the ontology 404s on the term call
  // and never reaches here; this covers a 200 with an empty payload.
  if (!term) return null;
  return {
    term,
    relations: groupRelations(edges, ontology),
    // Asked only of the three members that curate a range. A stray existence
    // relation in another vocabulary would otherwise render a window with no
    // staging series to name.
    stages: ontology.stageSeries ? stageRange(edges) : null,
  };
}
