import { fetchOlsTerm } from '../../lib/ols';
import { UBERON_ONTOLOGY } from '../ontologyBrowser/ontologies.js';
import fetchUberonSpecies from './fetchUberonSpecies.js';
import loadUberonMap from './uberonMap.js';

// The same structure in the other species, from either side of the mapping.
//
// On the UBERON page this is a straight read of the term's own xrefs. From a
// species page it has to be pivoted: find the UBERON term that absorbs this
// one, then ask what else that term absorbs. Both end in the same table.
//
// Two sources for the pivot, because the members and UBERON do not record the
// mapping in the same place. XAO declares a UBERON xref on most of its terms;
// WBbt, ZFA and EMAPA declare none, and UBERON carries those instead. The
// term's own xrefs are already in hand, so they are preferred and the table is
// consulted for the rest.
export default async function fetchAcrossSpecies(ontology, term) {
  if (ontology.crossSpecies) {
    return { through: [], rows: await fetchUberonSpecies(term) };
  }

  const declared = (term.xrefs || []).map(({ curie }) => curie).filter((curie) => curie.startsWith('UBERON:'));
  const map = await loadUberonMap();
  const curies = [...new Set([...declared, ...(map[term.curie] || [])])];
  if (!curies.length) {
    return { through: [], rows: [] };
  }

  // A mapping can name a term UBERON has since retired, which 404s at OLS.
  const through = (
    await Promise.all(curies.map((curie) => fetchOlsTerm(UBERON_ONTOLOGY.olsId, curie).catch(() => null)))
  ).filter(Boolean);

  // UBERON:0000369 and UBERON:0002435 both absorb EMAPA:17549 and share most
  // of their other xrefs, so the union is deduplicated before it is resolved.
  const xrefs = [...new Map(through.flatMap((uberon) => uberon.xrefs || []).map((x) => [x.curie, x])).values()];
  const rows = await fetchUberonSpecies({ xrefs });

  // The page's own term comes back as one of the rows. Drop it — the reader is
  // looking at it. A sibling from the same ontology stays, since two terms
  // mapping onto one structure is worth seeing.
  return { through, rows: rows.filter(({ term: row }) => row.curie !== term.curie) };
}
