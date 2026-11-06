// This structure at a resource that is not a vocabulary.
//
// A different claim from Cross References, and the reason both exist. A
// cross-reference says the same structure is called something else in another
// ontology; this says someone has built something about this structure — a 3D
// atlas, a neuron reconstruction, a photographic plate — and here is where it
// is. For a fly neuron, Virtual Fly Brain is usually the most useful thing on
// the page, and until recently the page threw it away.
//
// Two members fill it, by two different routes. FBbt carries its references
// in the ontology, where anyone downstream gets them for free: 22,004 of
// 27,217 terms, 81%. WormBase keeps its own in ACEDB, where no download and
// no OLS record can reach them, so they arrive instead as a committed table
// built by bin/build_anatomy_wbbt_resources.js — 2,084 WBbt terms, and that
// generator records what each one is and how it was checked. ZFA, EMAPA and
// XAO carry none at all.
//
// UBERON is the other filled column, and it splits two ways rather than one.
// 8,658 of its 15,047 terms carry a reference outside the anatomy
// vocabularies, across 115 databases, and all but one of those databases is
// another controlled vocabulary saying the same structure under a different
// identifier — FMA, SNOMED, UMLS, NCIT, MeSH, the Allen brain atlases. Those
// are cross-references by any reading, and `toVocabularyXrefs` below sends
// them to that row. The exception is Wikipedia, on 3,554 terms: a page
// written about the structure for a person to read, which is a resource.
//
// An allowlist rather than a filter, because the cost of the two mistakes is
// not symmetric. A resource missing from this page is invisible; a dead link
// on it looks like our bug, and the reader has no way to tell a host that
// moved from an identifier that never resolved. So a resource appears only
// once someone has checked that it answers.
//
// Verified 2026-11-06, each by request:
//
//   VFB            21,872 terms   200, redirects to the v2 Geppetto viewer
//   FlyBrain_NDB      457 terms   200, and OLS supplies the resolver itself
//   bare URL          135 terms   200, all of them www.ento.csiro.au
//   Wikipedia       3,554 terms   200, including the 139 ids that are a
//                                 section anchor rather than a whole article
//   WormAtlas       1,977 terms   all 191 pages loaded in a browser; curl
//                                 cannot see them, and the URL ACEDB stores
//                                 is dead — see the generator
//   WormWiring        520 terms   200
//   Neuralnet         410 terms   200 over http only
//   NemaNode          225 terms   200
//   ZhenLab3D         180 terms   200
//
// Left out, with reasons, so the next person does not re-derive them:
//
//   DoOR                   75 terms   neuro.uni-konstanz.de does not answer
//   larvalbrain_neuropil  160 terms   larvalbrain.org does not answer
//   larvalbrain_axon_tract 185 terms  same host
//   FBdv, GO, BSPO, NCBITaxon         ontology terms, not resources; 17 in all
//   GLOWorm_Scene       1,489 terms   fsbill.vcell.uchc.edu does not answer
//   MODEncodeTissue*       34 terms   one fixed GBrowse track, host is down
//   Spencer2011            19 terms   one fixed page, not about the structure
//
// The three WormBase exclusions are dropped by the generator rather than
// here, so they never reach the browser at all.
//
// Neither member resolves these well itself. FlyBase's term report links VFB
// and prints the rest as bare text, including its own URLs. WormBase's
// External Links widget prints the raw stored value as the link text —
// `db=JSH&cell=AVM`, `c=AVM&m=1` — and its WormAtlas links have been dead
// since the host moved. So this shows a little more than either, not less,
// and every row of it has been checked.
const RESOURCES = {
  VFB: {
    label: 'Virtual Fly Brain',
    // The id arrives as `FBbt_00001060`, underscored, which is the form the
    // report URL wants. This is FlyBase's own linkout target.
    url: (id) => `https://www.virtualflybrain.org/reports/${id}`,
    first: true,
  },
  FLYBRAIN_NDB: {
    label: 'FlyBrain NDB',
    // No template of our own: OLS carries the resolver for this one, and it
    // is a FileMaker URL that nobody should be reconstructing by hand.
  },
  WIKIPEDIA: {
    label: 'Wikipedia',
    // Built here rather than taken from OLS, which gives the http form, and
    // an http link off an https page is a downgrade for no reason. The id is
    // the article title, already underscored, and on 139 UBERON terms it
    // carries a `#section` anchor — `Eye#Simple_eyes` — which belongs in the
    // URL exactly as it arrives.
    url: (id) => `https://en.wikipedia.org/wiki/${id}`,
  },
  // The five WormBase resources. Their URLs are built by the generator, which
  // is where the ACEDB templates and their repairs are recorded, so there is
  // nothing to construct here.
  WORMATLAS: { label: 'WormAtlas', first: true },
  WORMWIRING: { label: 'WormWiring' },
  NEMANODE: { label: 'NemaNode' },
  NEURALNET: { label: 'Neuralnet' },
  ZHENLAB3D: { label: 'Zhen Lab 3D Neuron Viewer' },
};

// A prefix that is neither a resource above nor a mapping to another
// vocabulary: upper ontologies, OBO metadata, and the retired mappings
// UBERON keeps for provenance. Nothing here belongs in either row.
const NOT_A_MAPPING = new Set(['BFO', 'IAO', 'RO', 'UBPROP', 'OBO', 'NOID']);

const keyOf = (database) =>
  String(database)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_');

// A bare-URL xref has no database to look up, so it is named by its host —
// honest, and it keeps working if FlyBase cites a different site next release.
const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
};

// The vocabulary half of the same leftover list, for the Cross References
// row. Only the cross-species page asks for it, and that is deliberate: a
// clean xref slot is UBERON's editorial practice, not a general rule. WBbt
// puts a paper and a curator's initials in the same field, which is why
// src/lib/ols.js keeps a strict allowlist for member terms and why widening
// it everywhere would put `WB:pws` on an anatomy page.
export function toVocabularyXrefs(resources) {
  return (resources || [])
    .filter(({ database }) => {
      if (!database) {
        return false;
      }
      const key = keyOf(database);
      // `WikipediaCategory` and `WikipediaVersioned` are neither the article
      // nor a vocabulary, so they go the same way as the article itself.
      return !RESOURCES[key] && !key.startsWith('WIKIPEDIA') && !NOT_A_MAPPING.has(key) && !/RETIRED/.test(key);
    })
    .map(({ database, id, url }) => ({ curie: `${database}:${id}`, url }));
}

// `resources` is what src/lib/ols.js passes through and what the WormBase
// table adds to it: { database, id, url }, plus `name` where the member
// distinguishes several links into one resource.
//
// Grouped by resource rather than returned flat, because a term often has
// several links into the same place and they are not interchangeable: AVM has
// three WormWiring maps, one per EM series, two Neuralnet views and two
// WormAtlas chapters. Nine identical-looking links in a row say nothing; the
// resource named once with what distinguishes them after it says what each is.
// A term with one link to a resource shows just the resource.
export default function toExternalResources(resources) {
  const groups = new Map();
  for (const { database, id, name, url } of resources || []) {
    let key;
    let label;
    let rank = 1;
    let href = url;
    if (database) {
      const resource = RESOURCES[keyOf(database)];
      if (!resource) {
        continue;
      }
      key = keyOf(database);
      label = resource.label;
      rank = resource.first ? 0 : 1;
      href = resource.url?.(id) || url;
    } else {
      // A host and nothing else is the weakest label on the row, so these
      // sort last whatever they are called.
      const host = url && /^https?:\/\//.test(url) ? hostOf(url) : undefined;
      if (!host) {
        continue;
      }
      key = `url:${host}`;
      label = host;
      rank = 2;
    }
    // An allowlisted resource with no URL from either side is an identifier
    // we cannot act on, and a name with nothing behind it helps no one.
    if (!href) {
      continue;
    }
    const group = groups.get(key) || { key, label, rank, links: [] };
    groups.set(key, group);
    if (!group.links.some((link) => link.href === href)) {
      group.links.push({ key: `${key}:${id}`, name: name || id, href });
    }
  }
  return [...groups.values()]
    .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label))
    .map((group) => ({
      ...group,
      links: group.links.sort((a, b) => String(a.name).localeCompare(String(b.name))),
    }));
}
