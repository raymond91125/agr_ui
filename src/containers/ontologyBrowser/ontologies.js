import { ANNOTATION_TYPES } from './annotationTypes.js';

// Root of the disease ontology ("disease"). Also identifies the root disease
// portal, whose page is an index of the portals rather than a disease page.
export const DISEASE_ROOT_CURIE = 'DOID:4';

// Supported ontologies in the browser.
//
// `source` says where terms come from:
//   'agr' — the Alliance API (/api/disease/...), which also carries annotation
//           counts and feeds the site search index.
//   'ols'  — the EBI Ontology Lookup Service. The Alliance API has no anatomy
//           endpoints yet, so the anatomy ontologies are read from OLS4. They
//           therefore have no count badges and no site-search category; term
//           search goes to OLS instead of /api/search_autocomplete.
//
// Anatomy ontologies are species-specific and deliberately not interoperable —
// WBbt, ZFA, XAO and EMAPA "intestine" are four different assertions about four
// different animals. UBERON is listed last because it is the cross-species
// bridge rather than any one member's vocabulary.
//
// Rat has no entry on purpose: there is no rat anatomy ontology. RGD annotates
// anatomy with UBERON, so for rat the UBERON page *is* the anatomy page.
//
// Listed in the Alliance species order from SPECIES_NAME_ORDER.
export const ONTOLOGIES = [
  {
    id: 'disease',
    label: 'Disease (DO)',
    group: 'Disease',
    source: 'agr',
    rootCurie: DISEASE_ROOT_CURIE,
    rootName: 'disease',
    curiePrefix: 'DOID',
    searchCategory: 'disease_search_result',
    annotationTypes: ANNOTATION_TYPES,
    entityPath: (curie) => `/disease/${curie}`,
    entityLabel: 'disease page',
    termUrl: (curie) => `https://www.disease-ontology.org/?id=${curie}`,
    available: true,
  },
  {
    id: 'emapa',
    label: 'Mouse Developmental Anatomy (EMAPA)',
    group: 'Anatomy',
    source: 'ols',
    olsId: 'emapa',
    entityPath: (curie) => `/anatomy/${curie}`,
    entityLabel: 'anatomy page',
    // EMAPA's declared root (EMAPA:0, "Anatomical structure") has exactly one
    // child, so starting there costs the user a click for nothing. Open on
    // "mouse", which is where MGI's own anatomy browser starts.
    rootCurie: 'EMAPA:25765',
    rootName: 'mouse',
    curiePrefix: 'EMAPA',
    stageSeries: 'Theiler stages (TS)',
    species: 'Mus musculus',
    mod: 'MGI',
    termUrl: (curie) => `https://www.informatics.jax.org/vocab/gxd/anatomy/${curie}`,
    available: true,
  },
  {
    id: 'xao',
    label: 'Xenopus Anatomy (XAO)',
    group: 'Anatomy',
    source: 'ols',
    olsId: 'xao',
    entityPath: (curie) => `/anatomy/${curie}`,
    entityLabel: 'anatomy page',
    rootCurie: 'XAO:0000000',
    rootName: 'Xenopus anatomical entity',
    curiePrefix: 'XAO',
    stageSeries: 'Nieuwkoop–Faber stages (NF)',
    // XAO covers both Alliance Xenopus species, so this names the genus rather
    // than one of them.
    species: 'Xenopus laevis and X. tropicalis',
    // `provider` is who curates the vocabulary; `mod` is who we can send a
    // reader to for a given term. They are the same member everywhere except
    // here, where Xenbase curates XAO but cannot be linked to per term (see
    // the note on termUrl below).
    provider: 'Xenbase',
    // No `mod` link-out. Xenbase addresses its anatomy pages by an internal
    // numeric anatomyId, and that id cannot be derived from an XAO curie —
    // the offsets between the two id spaces are arbitrary:
    //
    //   skin            XAO:0000023  -> anatomyId 23    (+0)
    //   heart           XAO:0000064  -> anatomyId 63    (+1)
    //   hindbrain       XAO:0000015  -> anatomyId 16    (-1)
    //   circulatory sys XAO:0001010  -> anatomyId 448   (+562)
    //   stylopod        XAO:0004263  -> anatomyId 3309  (+954)
    //
    // The low numbers look like an off-by-one but are coincidence, and guessing
    // would silently link some terms to the wrong structure. The curie-based
    // route (anatomyitem.do?anatomyItemId=XAO:...) 404s, and the Alliance's own
    // resourceDescriptors carry no XAO entry, so there is no resolver to use.
    // Point at the ontology source instead.
    termUrl: (curie) => `https://www.ebi.ac.uk/ols4/ontologies/xao/classes?obo_id=${encodeURIComponent(curie)}`,
    available: true,
  },
  {
    id: 'zfa',
    label: 'Zebrafish Anatomy (ZFA)',
    group: 'Anatomy',
    source: 'ols',
    olsId: 'zfa',
    entityPath: (curie) => `/anatomy/${curie}`,
    entityLabel: 'anatomy page',
    rootCurie: 'ZFA:0100000',
    rootName: 'zebrafish anatomical entity',
    curiePrefix: 'ZFA',
    species: 'Danio rerio',
    mod: 'ZFIN',
    // Present on the three members that curate a stage range. The term carries
    // it as a relation to a stage term, which OLS serves on /graph.
    stageSeries: 'Zebrafish developmental stages (ZFS)',
    termUrl: (curie) => `https://zfin.org/${curie}`,
    available: true,
  },
  {
    id: 'fbbt',
    label: 'Drosophila Anatomy (FBbt)',
    group: 'Anatomy',
    source: 'ols',
    olsId: 'fbbt',
    entityPath: (curie) => `/anatomy/${curie}`,
    entityLabel: 'anatomy page',
    rootCurie: 'FBbt:10000000',
    rootName: 'anatomical entity',
    curiePrefix: 'FBbt',
    species: 'Drosophila melanogaster',
    mod: 'FlyBase',
    termUrl: (curie) => `https://flybase.org/cgi-bin/cvreport.html?id=${curie}`,
    available: true,
  },
  {
    id: 'wbbt',
    label: 'C. elegans Anatomy (WBbt)',
    group: 'Anatomy',
    source: 'ols',
    olsId: 'wbbt',
    entityPath: (curie) => `/anatomy/${curie}`,
    entityLabel: 'anatomy page',
    rootCurie: 'WBbt:0000100',
    rootName: 'C. elegans anatomical entity',
    curiePrefix: 'WBbt',
    species: 'Caenorhabditis elegans',
    mod: 'WormBase',
    termUrl: (curie) => `https://www.wormbase.org/db/get?name=${curie};class=Anatomy`,
    available: true,
  },
  {
    id: 'uberon',
    label: 'Cross-species Anatomy (UBERON)',
    group: 'Anatomy',
    source: 'ols',
    olsId: 'uberon',
    entityPath: (curie) => `/anatomy/${curie}`,
    entityLabel: 'anatomy page',
    rootCurie: 'UBERON:0001062',
    rootName: 'anatomical entity',
    curiePrefix: 'UBERON',
    // No `species`: UBERON is the bridge between the member vocabularies, so
    // its page answers "which species have this structure, and what does each
    // member call it" rather than describing one animal.
    crossSpecies: true,
    termUrl: (curie) => `https://www.ebi.ac.uk/ols4/ontologies/uberon/classes?obo_id=${encodeURIComponent(curie)}`,
    available: true,
  },
];

export const DEFAULT_ONTOLOGY_ID = 'disease';

// The member anatomy ontologies, in Alliance species order. The UBERON page
// walks these to decide which species a structure has been mapped into.
export const SPECIES_ANATOMY_ONTOLOGIES = ONTOLOGIES.filter((o) => o.group === 'Anatomy' && o.species);

export const getOntology = (id) =>
  ONTOLOGIES.find((o) => o.id === id) || ONTOLOGIES.find((o) => o.id === DEFAULT_ONTOLOGY_ID);

// Ontology that owns a curie's prefix, so /anatomy/:id can work out which
// vocabulary — and therefore which species and which member — it is looking at.
// Returns undefined for a prefix no registered ontology claims.
export const getOntologyForCurie = (curie) => {
  const prefix = (curie || '').split(':')[0].toLowerCase();
  return prefix ? ONTOLOGIES.find((o) => o.curiePrefix.toLowerCase() === prefix) : undefined;
};

// Chooser groups, in registry order, so the <select> can use <optgroup>.
export const ONTOLOGY_GROUPS = ONTOLOGIES.reduce((groups, ontology) => {
  const group = groups.find((g) => g.label === ontology.group);
  if (group) {
    group.ontologies.push(ontology);
  } else {
    groups.push({ label: ontology.group, ontologies: [ontology] });
  }
  return groups;
}, []);
