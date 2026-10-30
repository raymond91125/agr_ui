import { STAGE_PROPERTIES } from './stageRange.js';

// Everything else the ontology asserts about the term, grouped by relation.
//
// This is the one section every member vocabulary can fill. WBbt and FBbt have
// no stage axis and no UBERON mapping of their own, but both carry relations
// the hierarchy cannot express — FBbt records which neurons have their soma in
// a structure, and WBbt encodes the invariant C. elegans lineage as
// `child nucleus of`. Each member's own page shows these: ZFIN lists typed
// relations, MGI labels its parents `is-a` and `part-of`, and Xenbase draws
// `develops from` as a second tree beside the anatomy one.

// What the ontology browser draws as the tree. Held apart from the rest so
// that it sorts first and so that the import filter below applies only to it.
const HIERARCHY = new Set(['is a', 'part of', 'has part']);

// Hierarchy first, then lineage, then whatever a given ontology happens to
// declare — `overlaps`, `has soma location`, `produces`, `site_of`.
const ORDER = ['is a', 'part of', 'has part', 'develops from', 'child nucleus of'];

const rank = (relation) => {
  const index = ORDER.indexOf(relation);
  return index === -1 ? ORDER.length : index;
};

const byRelation = (a, b) => rank(a.relation) - rank(b.relation) || a.relation.localeCompare(b.relation);

const group = (edges) => {
  const groups = new Map();
  for (const edge of edges) {
    const terms = groups.get(edge.relation);
    if (terms) {
      terms.push(edge);
    } else {
      groups.set(edge.relation, [edge]);
    }
  }
  return [...groups]
    .map(([relation, terms]) => ({
      relation,
      terms: terms.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort(byRelation);
};

export default function groupRelations(edges, ontology) {
  const prefix = ontology.curiePrefix.toLowerCase();

  const kept = (edges || []).filter((edge) => {
    if (STAGE_PROPERTIES.has(edge.property)) {
      return false;
    }
    if (!HIERARCHY.has(edge.relation)) {
      // Left as asserted, whichever vocabulary the far end comes from. UBERON
      // genuinely points `site_of` into GO and `in taxon` into NCBITaxon;
      // dropping those would hide the statement rather than tidy it up.
      return true;
    }
    // The hierarchy, though, is the species vocabulary's own. OLS serves every
    // ontology with its imports folded in, so without this each WBbt nucleus
    // would list `is a continuant` (BFO) and `is a nucleus` (GO) above its real
    // parent. This also keeps the lists identical to the ontology browser's,
    // which filters the same way.
    return edge.curie.split(':')[0].toLowerCase() === prefix;
  });

  const out = group(kept.filter((edge) => edge.direction === 'out'));
  const incoming = group(kept.filter((edge) => edge.direction === 'in'));
  return out.length || incoming.length ? { out, in: incoming } : null;
}
