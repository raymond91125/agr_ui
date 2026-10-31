// The five member anatomy ontologies. UBERON xrefs reach far wider than this —
// FMA, MESH, Wikipedia, the legacy anatomy ontologies — and none of those has a
// page here.
const MEMBER_PREFIXES = new Set(['WBbt', 'FBbt', 'ZFA', 'EMAPA', 'XAO']);

const isObsolete = (term) => term.obsolete || /^obsolete/i.test(term.name || '');

// Invert UBERON's OBO release into `member curie -> [UBERON curie]`.
//
// A member term can land on more than one UBERON term — UBERON:0000369
// `corpus striatum` and UBERON:0002435 `striatum` both absorb EMAPA:17549 —
// so the value is always a list. Five of the 7,414 member terms are ambiguous
// this way once obsolete UBERON terms are out.
export default function parseUberonXrefs(obo) {
  const pairs = new Map();
  let dataVersion;
  let term = null;

  const flush = () => {
    // An obsolete UBERON term keeps its xrefs, so leaving these in is most of
    // what makes a member term look ambiguous: ZFA:0005564 otherwise maps to
    // both `aqueous humor of eyeball` and `obsolete aqueous humor`. Dropping
    // them takes the ambiguous count from 26 to 5.
    if (term?.curie && !isObsolete(term)) {
      for (const xref of term.xrefs) {
        if (!pairs.has(xref)) {
          pairs.set(xref, []);
        }
        pairs.get(xref).push(term.curie);
      }
    }
    term = null;
  };

  for (const line of obo.split('\n')) {
    if (line === '[Term]') {
      flush();
      term = { xrefs: [] };
    } else if (line.startsWith('[')) {
      // [Typedef] and friends: anything that is not a term ends the one before.
      flush();
    } else if (!term) {
      if (line.startsWith('data-version: ')) {
        dataVersion = line.slice('data-version: '.length).trim();
      }
    } else if (line.startsWith('id: UBERON:')) {
      term.curie = line.slice('id: '.length).trim();
    } else if (line.startsWith('name: ')) {
      term.name = line.slice('name: '.length).trim();
    } else if (line.startsWith('is_obsolete: true')) {
      term.obsolete = true;
    } else if (line.startsWith('xref: ')) {
      // `xref: EMAPA:16846 {source="..."}` — the identifier is the first token,
      // and a trailing qualifier block is not part of it.
      const curie = line.slice('xref: '.length).split(/[\s{]/)[0].trim();
      if (MEMBER_PREFIXES.has(curie.split(':')[0])) {
        term.xrefs.push(curie);
      }
    }
  }
  flush();

  // Sorted so that regenerating against an unchanged release produces an
  // unchanged file, which keeps the committed copy reviewable.
  const map = Object.fromEntries([...pairs].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, v.sort()]));
  return { dataVersion, map };
}
