// Phenotype term -> the anatomy term its logical definition is about.
//
// ZFIN and FlyBase curate a phenotype against an anatomy term directly, so the
// annotation already names the structure. WormBase and Xenbase submit a term
// from a pre-composed phenotype ontology instead — WBPhenotype, XPO — and the
// structure is inside that term's definition rather than on the annotation.
// `abnormal multiciliated cell` is equivalent to a quality inhering in an XAO
// cell type, and that XAO identifier is the only way back to an anatomy page.
//
// The definitions are in the OWL and nowhere else: every one of xpo.obo,
// wbphenotype.obo, mp.obo and apo.obo has zero `intersection_of` lines on its
// own stanzas, so the OBO releases cannot answer this question at all.
//
// RDF/XML rather than a parser because the shape wanted is narrow and the
// files are 16-75 MB. The one thing a regex cannot do here is nesting: an
// equivalentClass holds anonymous `<owl:Class>` elements of its own, so
// matching to the first `</owl:Class>` truncates the definition and drops
// entities. Hence the depth count below.

// Matches an opening, closing or self-closing owl:Class tag.
const CLASS_TAG = /<(\/?)owl:Class\b([^>]*?)(\/?)>/g;

const curies = (text, prefix) => {
  const found = new Set();
  for (const match of text.matchAll(new RegExp(`obo/${prefix}_(\\d+)`, 'g'))) {
    found.add(`${prefix}:${match[1]}`);
  }
  return [...found].sort();
};

// Equivalence axioms do not nest inside one another, so each is the span from
// its opening tag to the next closing one. The self-closing `rdf:resource`
// form names a single class and carries no restriction, but is read anyway so
// that a release which starts using it is not silently skipped.
const equivalences = (body) => {
  const spans = [];
  for (const match of body.matchAll(/<owl:equivalentClass\b([^>]*?)(\/?)>/g)) {
    if (match[2] === '/') {
      spans.push(match[1]);
      continue;
    }
    const start = match.index + match[0].length;
    const end = body.indexOf('</owl:equivalentClass>', start);
    spans.push(body.slice(start, end === -1 ? undefined : end));
  }
  return spans;
};

export default function parsePhenotypeEntities(owl, { phenotypePrefix, entityPrefix }) {
  const about = new RegExp(`rdf:about="http://purl\\.obolibrary\\.org/obo/${phenotypePrefix}_(\\d+)"`);
  const map = {};
  const open = [];

  CLASS_TAG.lastIndex = 0;
  for (let tag = CLASS_TAG.exec(owl); tag; tag = CLASS_TAG.exec(owl)) {
    const [text, closing, attributes, selfClosing] = tag;
    if (selfClosing) {
      continue;
    }
    if (!closing) {
      open.push({ attributes, bodyStart: tag.index + text.length });
      continue;
    }

    const stanza = open.pop();
    if (!stanza) {
      continue; // a stray close tag; the file is not ours to repair
    }
    const named = stanza.attributes.match(about);
    if (!named) {
      continue;
    }
    const entities = equivalences(owl.slice(stanza.bodyStart, tag.index)).flatMap((span) => curies(span, entityPrefix));
    if (entities.length) {
      map[`${phenotypePrefix}:${named[1]}`] = [...new Set(entities)].sort();
    }
  }

  const version = owl.match(/<owl:versionIRI rdf:resource="([^"]+)"/);
  return { versionIri: version?.[1], map };
}
