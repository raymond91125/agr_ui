import assert from 'assert';

import parseUberonXrefs from './parseUberonXrefs.js';

// Shaped like the real release, including the cases that silently produce a
// wrong committed table if they are mishandled.
const OBO = `format-version: 1.2
data-version: uberon/releases/2026-10-01/uberon-basic.owl

[Term]
id: UBERON:0000160
name: intestine
xref: EMAPA:32874
xref: WBbt:0005772 {source="https://orcid.org/0000-0002-6095-8718"}
xref: FMA:7199
xref: Wikipedia:Intestine

[Term]
id: UBERON:2002288
name: obsolete aqueous humor
is_obsolete: true
xref: ZFA:0005564

[Term]
id: UBERON:0001796
name: aqueous humor of eyeball
xref: ZFA:0005564

[Term]
id: UBERON:0002435
name: striatum
xref: EMAPA:17549

[Term]
id: UBERON:0000369
name: corpus striatum
xref: EMAPA:17549

[Typedef]
id: part_of
xref: EMAPA:99999
`;

describe('parseUberonXrefs', () => {
  const { dataVersion, map } = parseUberonXrefs(OBO);

  it('reads the release the table was built from', () => {
    assert.equal(dataVersion, 'uberon/releases/2026-10-01/uberon-basic.owl');
  });

  it('inverts the mapping and keeps only the member ontologies', () => {
    assert.deepEqual(map['WBbt:0005772'], ['UBERON:0000160']);
    assert.deepEqual(map['EMAPA:32874'], ['UBERON:0000160']);
    assert.equal(map['FMA:7199'], undefined);
    assert.equal(map['Wikipedia:Intestine'], undefined);
  });

  it('strips the qualifier block from an annotated xref', () => {
    // Without this the key is `WBbt:0005772 {source="..."}` and nothing ever
    // matches it — the mapping is silently absent rather than wrong.
    assert.ok(Object.keys(map).every((curie) => !curie.includes('{')));
  });

  it('ignores an obsolete UBERON term, which keeps its xrefs', () => {
    assert.deepEqual(map['ZFA:0005564'], ['UBERON:0001796']);
  });

  it('keeps both targets where UBERON genuinely splits a member term', () => {
    assert.deepEqual(map['EMAPA:17549'], ['UBERON:0000369', 'UBERON:0002435']);
  });

  it('does not read xrefs off a [Typedef] stanza', () => {
    assert.equal(map['EMAPA:99999'], undefined);
  });

  it('sorts its output so an unchanged release regenerates an identical file', () => {
    assert.deepEqual(
      Object.keys(map),
      [...Object.keys(map)].sort((a, b) => a.localeCompare(b))
    );
  });
});
