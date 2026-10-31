import fs from 'fs';
import parseUberonXrefs from './parseUberonXrefs.js';

// Member anatomy term -> the UBERON term(s) that absorb it.
//
// The anatomy page needs this to answer "what is this structure called in the
// other species" from a species page. UBERON holds the mapping on the UBERON
// term, as ordinary OBO xrefs, so the UBERON page can read it straight from
// OLS. A species page needs it the other way round, and OLS cannot search
// xrefs in reverse: the v1 search ignores them and the v2 class filter accepts
// `label` and `shortForm` but returns nothing for hasDbXref. The whole table is
// only 7,600 pairs, so invert it once here instead.
//
// Deliberately NOT wired into `npm run generators`, which the build runs: that
// would put a 12 MB download from an external host on the critical path of
// every CI build. The output is committed, and `data-version` in it says which
// UBERON release it came from. Re-run by hand when that looks stale:
//
//   node bin/build_anatomy_uberon_map.js
//
// Replaced wholesale once the Alliance API serves anatomy; `/api/anatomy/{id}`
// would carry the UBERON term beside the rest of the term's data, and the
// `anatomicalStructureUberonTerm` curation slot is the same answer again from
// annotations rather than from the ontology.

// `basic` rather than the full release: both carry exactly the same member
// xrefs — 7,636 pairs either way — and it is 12 MB against 22 MB.
const SOURCE = 'http://purl.obolibrary.org/obo/uberon/basic.obo';
const DESTINATION = 'public/anatomy-uberon-map.json';

const response = await fetch(SOURCE);
if (!response.ok) {
  throw new Error(`${SOURCE} answered ${response.status} ${response.statusText}`);
}
const { dataVersion, map } = parseUberonXrefs(await response.text());

if (!dataVersion || Object.keys(map).length === 0) {
  throw new Error('parsed no mappings — has the OBO format changed?');
}

fs.writeFileSync(DESTINATION, `${JSON.stringify({ dataVersion, source: SOURCE, map }, null, 0)}\n`);

const byPrefix = {};
let ambiguous = 0;
for (const [curie, targets] of Object.entries(map)) {
  byPrefix[curie.split(':')[0]] = (byPrefix[curie.split(':')[0]] || 0) + 1;
  if (targets.length > 1) ambiguous += 1;
}
console.log(`${DESTINATION}: ${Object.keys(map).length} member terms from ${dataVersion}`);
console.log(`  ${JSON.stringify(byPrefix)}`);
console.log(`  ${ambiguous} map to more than one UBERON term`);
