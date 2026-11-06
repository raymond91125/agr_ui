import fetchData from '../../lib/fetchData';

// The publications behind the annotations an anatomy page shows, built by
// bin/build_anatomy_reference_sample.js and committed under public/.
//
// Named `sample` for consistency with its neighbours, and here the word is
// half true. The papers behind the marker and function sets are complete,
// because those sets are; the papers behind expression and phenotype are
// counted only for the terms those two samples cover, for the same reason
// they are samples. The component says which case a term is in.
//
// Shape: `terms[curie]` lists the term's top publications with a count per
// section, `publications[id]` holds each paper's citation and AGRKB curie
// once, and `coverage` carries the totals the footnote quotes.
const SAMPLE_URL = '/anatomy-reference-sample.json';

// Held for the session and requested only when an anatomy page asks.
let pending;

export default function loadReferenceSample() {
  if (!pending) {
    pending = fetchData(SAMPLE_URL).catch((error) => {
      pending = undefined;
      throw error;
    });
  }
  return pending;
}
