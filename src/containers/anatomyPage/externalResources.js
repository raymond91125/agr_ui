// This structure at a resource that is not a vocabulary.
//
// A different claim from Cross References, and the reason both exist. A
// cross-reference says the same structure is called something else in another
// ontology; this says someone has built something about this structure — a 3D
// atlas, a neuron reconstruction, a photographic plate — and here is where it
// is. For a fly neuron, Virtual Fly Brain is usually the most useful thing on
// the page, and until now the page threw it away.
//
// FlyBase only, in practice, and that is a finding rather than a limit. FBbt
// carries these in the ontology itself, where anyone downstream gets them for
// free: 22,004 of 27,217 terms, 81%. ZFA, EMAPA and XAO carry none. WormBase
// has them in quantity — WormAtlas, WormWiring, NemaNode, Neuralnet and more,
// on about half of WBbt — but keeps them in ACEDB rather than in WBbt, so
// they reach no download and no OLS record and cannot be read from here at
// all. UBERON carries two dozen per term (FMA, MeSH, NCIT, Wikipedia, UMLS),
// which is a separate question about the cross-species page and deliberately
// not answered by this table.
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
//
// Left out, with reasons, so the next person does not re-derive them:
//
//   DoOR                   75 terms   neuro.uni-konstanz.de does not answer
//   larvalbrain_neuropil  160 terms   larvalbrain.org does not answer
//   larvalbrain_axon_tract 185 terms  same host
//   FBdv, GO, BSPO, NCBITaxon         ontology terms, not resources; 17 in all
//
// FlyBase's own term report resolves exactly one of these, VFB, and prints
// the rest as bare text — including its own bare URLs, which it does not even
// make clickable. So this shows a little more than the member does, not less,
// and every row of it has been checked.
const RESOURCES = {
  VFB: {
    label: 'Virtual Fly Brain',
    // The id arrives as `FBbt_00001060`, underscored, which is the form the
    // report URL wants. This is FlyBase's own linkout target.
    url: (id) => `https://www.virtualflybrain.org/reports/${id}`,
  },
  FLYBRAIN_NDB: {
    label: 'FlyBrain NDB',
    // No template of our own: OLS carries the resolver for this one, and it
    // is a FileMaker URL that nobody should be reconstructing by hand.
    url: () => undefined,
    withId: true,
  },
};

// A bare-URL xref has no database to look up, so it is named by its host —
// honest, and it keeps working if FlyBase cites a different site next release.
const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
};

// `resources` is what src/lib/ols.js passes through: { database, id, url }.
// Returns what the summary renders, in the order the allowlist declares, then
// by identifier so the list is stable between loads.
export default function toExternalResources(resources) {
  const out = [];
  for (const { database, id, url } of resources || []) {
    if (!database) {
      const host = url && /^https?:\/\//.test(url) ? hostOf(url) : undefined;
      if (host) {
        out.push({ key: `url:${url}`, label: host, href: url, rank: 2 });
      }
      continue;
    }
    const resource = RESOURCES[database.toUpperCase().replace(/[^A-Z0-9]/g, '_')];
    if (!resource) {
      continue;
    }
    const href = resource.url(id) || url;
    // An allowlisted resource with no URL from either side is an identifier
    // we cannot act on, and a name with nothing behind it helps no one.
    if (!href) {
      continue;
    }
    out.push({
      key: `${database}:${id}`,
      label: resource.withId ? `${resource.label} ${id}` : resource.label,
      href,
      rank: resource.withId ? 1 : 0,
    });
  }
  return out.sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label));
}
