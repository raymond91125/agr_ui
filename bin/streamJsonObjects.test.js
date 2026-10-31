import assert from 'assert';

import streamJsonObjects from './streamJsonObjects.js';

const collect = async (text, chunkSize, key) => {
  async function* chunks() {
    for (let i = 0; i < text.length; i += chunkSize) {
      yield text.slice(i, i + chunkSize);
    }
  }
  const out = [];
  for await (const object of streamJsonObjects(chunks(), key)) {
    out.push(object);
  }
  return out;
};

// The shape of an Alliance download file, including the parts that break a
// naive brace counter: metaData before the array, braces and brackets inside
// strings, an escaped quote, and nested objects.
// Defined once and asserted against by reference, so the test cannot disagree
// with itself about how many backslashes it meant.
const BRACES = 'contains { a brace } and ] a bracket';
const ESCAPES = 'an escaped \\" quote and a backslash \\\\';

const FILE = JSON.stringify({
  metaData: { release: 'WS298', dataProvider: { type: 'curated' } },
  data: [
    { geneId: 'WB:WBGene00000001', whereExpressed: { anatomicalStructureTermId: 'WBbt:0005772' } },
    { geneId: 'WB:WBGene00000002', note: BRACES },
    { geneId: 'WB:WBGene00000003', note: ESCAPES },
  ],
});

describe('streamJsonObjects', () => {
  it('yields every object in the array', async () => {
    const out = await collect(FILE, 1 << 16);
    assert.equal(out.length, 3);
    assert.equal(out[0].whereExpressed.anatomicalStructureTermId, 'WBbt:0005772');
  });

  it('is not confused by braces or brackets inside strings', async () => {
    const out = await collect(FILE, 1 << 16);
    assert.equal(out[1].note, BRACES);
    assert.equal(out[2].note, ESCAPES);
  });

  it('gives the same answer however the stream is chopped up', async () => {
    // The real file arrives in gzip-sized chunks that fall anywhere, including
    // mid-token and mid-escape.
    const whole = await collect(FILE, 1 << 16);
    for (const size of [1, 2, 3, 7, 13, 64]) {
      assert.deepEqual(await collect(FILE, size), whole, `chunk size ${size}`);
    }
  });

  it('stops at the end of the array rather than reading on', async () => {
    const trailing = `{"data":[{"a":1}],"after":[{"b":2}]}`;
    assert.deepEqual(await collect(trailing, 4), [{ a: 1 }]);
  });

  it('can read a different key', async () => {
    assert.deepEqual(await collect(`{"rows":[{"a":1},{"a":2}]}`, 5, 'rows'), [{ a: 1 }, { a: 2 }]);
  });
});
