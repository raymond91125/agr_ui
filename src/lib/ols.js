import fetchData from './fetchData';

// Client for the EBI Ontology Lookup Service (OLS4).
//
// The Alliance API has no anatomy endpoints — /openapi carries disease, gene,
// allele, variant, reference and expression only — so the anatomy ontologies in
// the browser are served straight from OLS4, which publishes WBbt, ZFA, FBbt,
// EMAPA and UBERON and sends `access-control-allow-origin: *`.
//
// Everything here normalizes to the shape the Alliance disease endpoints
// already return ({ curie, name, descendantCount, definition, synonyms }) so
// the tree and detail panel do not need to care which source a term came from.

const OLS_BASE = 'https://www.ebi.ac.uk/ols4/api';

// One page is enough for a hierarchy request: the widest anatomy node in any of
// the five ontologies is UBERON's `anatomical structure` at 63 children.
const PAGE_SIZE = 500;

export const curieToIri = (curie) => `http://purl.obolibrary.org/obo/${curie.replace(':', '_')}`;

// The inverse, for payloads that identify a term only by IRI — the /graph
// endpoint names every node and edge end that way. An IRI that is not an OBO
// purl has no curie, so its last segment stands in for one.
export const iriToCurie = (iri) => {
  const tail = (iri || '').split('/').pop();
  const underscore = tail.indexOf('_');
  return underscore === -1 ? tail : `${tail.slice(0, underscore)}:${tail.slice(underscore + 1)}`;
};

// OLS4 addresses terms by IRI, and the IRI must be percent-encoded *twice* —
// once because it is a path segment, and again because the gateway decodes it
// before the application sees it. Single-encoding 404s.
const termPath = (olsId, curie) =>
  `${OLS_BASE}/ontologies/${olsId}/terms/${encodeURIComponent(encodeURIComponent(curieToIri(curie)))}`;

const isObsolete = (term) => term?.is_obsolete === true || /^obsolete/i.test(term?.label || '');

// OLS serves every ontology with its upper-ontology and cross-ontology imports
// folded in — BFO, CL, GO and NCBITaxon terms all surface inside wbbt and fbbt.
// This is a species anatomy browser, so keep only each ontology's own terms.
const ownTerm = (prefix) => (term) =>
  !!term?.obo_id && !isObsolete(term) && term.obo_id.split(':')[0].toLowerCase() === prefix.toLowerCase();

// OBO definitions arrive as an array, and for several WBbt terms the first
// entry is a `LINKOUT::WORMATLAS::<url>` annotation rather than prose. Take the
// first entry that is an actual definition.
const pickDefinition = (description) => {
  const entries = Array.isArray(description) ? description : [description];
  return entries.find((d) => typeof d === 'string' && d.trim() && !/^LINKOUT::/i.test(d)) || undefined;
};

// An anatomy cross-reference means "the same structure in another vocabulary".
// OBO's xref slot is a grab-bag that also holds the citation a definition came
// from and the initials of the curator who added the term, and OLS reports all
// three identically — WBbt:0005772 xrefs WBPaper:00038216 (a paper) and
// WBbt:0005733 xrefs WB:pws (a person) alongside CARO:0000066 (a real mapping).
// A resolver URL does not separate them: OLS resolves WB:pws happily. So keep
// only references into vocabularies that describe anatomy.
//
// UBERON and CL are the cross-species bridges; the member ontologies map to
// each other directly; CARO, TAO, MA, EHDAA2, AAO and BTO are the legacy
// anatomy ontologies UBERON itself was assembled from, and still carry the
// mappings for terms UBERON has not absorbed.
const ANATOMY_XREF_PREFIXES = new Set([
  'UBERON',
  'CL',
  'WBBT',
  'ZFA',
  'FBBT',
  'EMAPA',
  'XAO',
  'CARO',
  'TAO',
  'MA',
  'EHDAA2',
  'AAO',
  'BTO',
]);

// OBO xrefs arrive as { database, id, description, url }. `database` is null
// for bare-URL xrefs (FBbt cites web pages this way), and `url` is null for
// databases OLS has no resolver for — those still carry a usable identifier,
// so keep them as plain text rather than dropping them.
const normalizeXrefs = (oboXref) =>
  (oboXref || [])
    .filter((x) => x?.database && x?.id && ANATOMY_XREF_PREFIXES.has(String(x.database).toUpperCase()))
    .map((x) => ({
      curie: `${x.database}:${x.id}`,
      url: x.url || undefined,
    }));

// Where a definition came from. OBO records it on the definition itself rather
// than in the term's xref slot, which is why these survive the anatomy filter
// above: WBbt cites a paper (WBPaper:00038216), FBbt a curator's initials
// (FBC:GG), XAO the UBERON term it was aligned to. OLS resolves a URL for the
// ones it has a resolver for and leaves the rest as identifiers.
const normalizeDefinitionSources = (citations) => [
  ...new Map(
    (citations || [])
      .flatMap((citation) => citation?.oboXrefs || [])
      .filter((x) => x?.database && x?.id)
      .map((x) => [`${x.database}:${x.id}`, { curie: `${x.database}:${x.id}`, url: x.url || undefined }])
  ).values(),
];

const normalize = (term) => ({
  curie: term.obo_id,
  name: term.label || term.obo_id,
  xrefs: normalizeXrefs(term.obo_xref),
  definitionSources: normalizeDefinitionSources(term.obo_definition_citation),
  // OBO subsets — FBbt puts `wing` in FB_gloss and cur. Curation metadata, so
  // it reads as provenance rather than as anatomy.
  subsets: term.in_subset || [],
  // OLS reports only *whether* a term has children, never how many. The tree
  // uses descendantCount solely to decide whether to draw a chevron, so 1
  // stands in for "some" and 0 is a true leaf.
  descendantCount: term.has_children ? 1 : 0,
  definition: pickDefinition(term.description),
  synonyms: term.synonyms || [],
});

export async function fetchOlsTerm(olsId, curie, options) {
  const url = `${OLS_BASE}/ontologies/${olsId}/terms?iri=${encodeURIComponent(curieToIri(curie))}`;
  const data = await fetchData(url, options);
  const term = data?._embedded?.terms?.[0];
  return term ? normalize(term) : null;
}

// Anatomy hierarchies run through `part_of` as much as `is_a` — OLS4's plain
// `children` call returns *nothing* for WBbt:0005772 (intestine) while
// `hierarchicalChildren` returns intestinal lumen and intestinal cell. Always
// use the hierarchical variants here.
async function fetchRelated(olsId, curie, relation, prefix, options) {
  const data = await fetchData(`${termPath(olsId, curie)}/${relation}?size=${PAGE_SIZE}`, options);
  // A leaf term answers with a page of zero and no _embedded block at all.
  return (data?._embedded?.terms || []).filter(ownTerm(prefix)).map(normalize);
}

export const fetchOlsChildren = (olsId, curie, prefix, options) =>
  fetchRelated(olsId, curie, 'hierarchicalChildren', prefix, options);

export const fetchOlsParents = (olsId, curie, prefix, options) =>
  fetchRelated(olsId, curie, 'hierarchicalParents', prefix, options);

// Returns the ancestor *set*, not an ordered path — which is all the browser
// needs, since forceExpanded is a Set of curies to open.
export const fetchOlsAncestors = (olsId, curie, prefix, options) =>
  fetchRelated(olsId, curie, 'hierarchicalAncestors', prefix, options);

export async function searchOls(olsId, query, prefix, { rows = 20, signal } = {}) {
  const url =
    `${OLS_BASE}/search?q=${encodeURIComponent(query)}` +
    `&ontology=${olsId}&type=class&rows=${rows}` +
    `&fieldList=${encodeURIComponent('obo_id,label,description,has_children')}`;
  const data = await fetchData(url, { signal });
  return (data?.response?.docs || []).filter(ownTerm(prefix)).map(normalize);
}

// The term's immediate neighbourhood, with the property on each edge — which
// `hierarchicalParents` and `hierarchicalChildren` do not carry. They answer
// *which* terms are adjacent but not *how*, and in an anatomy ontology the how
// is the point: `is a` and `part of` are different claims, and `develops from`
// is a third. One /graph call covers both questions, so the anatomy page reads
// this instead of the two hierarchy calls.
//
// Edges come back from the term's point of view: `direction` says which way the
// assertion runs, and curie/name are always the far end.
export async function fetchOlsGraph(olsId, curie, options) {
  const data = await fetchData(`${termPath(olsId, curie)}/graph`, options);
  const iri = curieToIri(curie);
  const names = new Map((data?.nodes || []).map((node) => [node.iri, node.label]));

  return (data?.edges || [])
    .map((edge) => {
      // In practice the graph is a star around the term, but it is served as a
      // neighbourhood: an edge between two of the term's neighbours says
      // nothing about the term itself.
      const direction = edge?.source === iri ? 'out' : edge?.target === iri ? 'in' : null;
      if (!direction) {
        return null;
      }
      const other = direction === 'out' ? edge.target : edge.source;
      return {
        direction,
        // Property labels arrive already readable — 'part of', 'develops from',
        // 'existence starts with'. Only the OWL primitive comes through raw,
        // and `is a` is how an OBO ontology is read aloud.
        relation: edge.label === 'subClassOf' ? 'is a' : edge.label,
        // Matched on the last IRI segment: XAO declares its own stage
        // properties rather than reusing RO, so there is no one namespace.
        property: (edge.uri || '').split('/').pop(),
        curie: iriToCurie(other),
        name: names.get(other) || iriToCurie(other),
      };
    })
    .filter((edge) => edge && !isObsolete({ label: edge.name }));
}

// A release date is in `version` for some ontologies and nowhere but the
// version IRI for others — WBbt, EMAPA, XAO and UBERON all leave `version`
// null while naming the release in `.../releases/YYYY-MM-DD/...`. Only FBbt
// and ZFA fill `version`, and FBbt fills it with a date while others elsewhere
// in OLS use names like "2.1", so the shape is checked rather than trusted.
//
// Exported for its test: four of the six vocabularies here depend on the
// fallback, and a wrong regex would quietly blank the field rather than fail.
export const releaseDate = (config) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(config?.version || '')) {
    return config.version;
  }
  return (config?.versionIri || '').match(/\/releases\/(\d{4}-\d{2}-\d{2})\//)?.[1];
};

// The vocabulary a term belongs to, rather than the term: who publishes it,
// when it last shipped, how big it is, and where to report a problem with it.
//
// Identical for every term in an ontology, so the caller is expected to cache
// it per ontology rather than per term.
export async function fetchOlsOntology(olsId, options) {
  const data = await fetchData(`${OLS_BASE}/ontologies/${olsId}`, options);
  if (!data?.config) {
    return null;
  }
  return {
    title: data.config.title,
    description: data.config.description,
    release: releaseDate(data.config),
    // OLS's own ingest date, which says when this copy was refreshed and is
    // not the same claim as the release date above.
    indexed: (data.updated || '').slice(0, 10) || undefined,
    termCount: data.numberOfTerms,
    homepage: data.config.homepage,
    tracker: data.config.tracker,
    mailingList: data.config.mailingList,
  };
}
