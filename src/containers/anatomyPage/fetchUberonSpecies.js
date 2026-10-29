import { fetchOlsTerm } from '../../lib/ols';
import { SPECIES_ANATOMY_ONTOLOGIES } from '../ontologyBrowser/ontologies.js';

// Which species have this structure, and what does each member call it?
//
// UBERON is assembled from the member anatomy ontologies and keeps the
// mappings on the UBERON term itself, as ordinary OBO xrefs:
//
//   UBERON:0000160 (intestine) -> WBbt:0005772, ZFA:0001338, EMAPA:32874, XAO:0000129
//   UBERON:0000948 (heart)     -> ZFA:0000114, EMAPA:16105, XAO:0000064
//
// So the cross-species view needs no Alliance backend work and no UBERON
// mapping of our own. The gaps are meaningful rather than missing data —
// heart has no WBbt row because C. elegans has no heart.
//
// `anatomicalStructureUberonTerm` exists as a curation slot and would give the
// same answer from annotations rather than from the ontology, but nothing
// populates it today. If that changes, this is the function to replace.

// A UBERON term can map to more than one term in the same ontology, so rows are
// grouped by ontology rather than assumed one-to-one.
const groupByOntology = (xrefs) => {
  const byPrefix = new Map();
  for (const { curie } of xrefs || []) {
    const prefix = curie.split(':')[0].toLowerCase();
    if (!byPrefix.has(prefix)) {
      byPrefix.set(prefix, []);
    }
    byPrefix.get(prefix).push(curie);
  }
  return byPrefix;
};

export default async function fetchUberonSpecies(term) {
  const byPrefix = groupByOntology(term?.xrefs);

  // Registry order, so the table reads in Alliance species order regardless of
  // how the xrefs happened to be listed on the UBERON term.
  const wanted = SPECIES_ANATOMY_ONTOLOGIES.flatMap((ontology) =>
    (byPrefix.get(ontology.curiePrefix.toLowerCase()) || []).map((curie) => ({ ontology, curie }))
  );

  // A mapping can point at a term that has since been merged or obsoleted, in
  // which case OLS answers 404 and fetchOlsTerm resolves to null. Drop those
  // rather than linking to a page that will not load.
  const resolved = await Promise.all(
    wanted.map(async ({ ontology, curie }) => {
      const memberTerm = await fetchOlsTerm(ontology.olsId, curie).catch(() => null);
      return memberTerm ? { ontology, term: memberTerm } : null;
    })
  );

  return resolved.filter(Boolean);
}
