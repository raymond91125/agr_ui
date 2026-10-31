import fetchData from '../../lib/fetchData';

// Expression annotations for a sample of anatomy terms, built by
// bin/build_anatomy_expression_sample.js and committed under public/.
//
// A fixture rather than a query, because the Alliance API can only be asked
// about expression gene-first — /api/expression takes a required list of gene
// IDs. The rows themselves are real: they come out of the Alliance's own
// expression files, which carry the native anatomy term every annotation was
// curated against. See the generator for the whole argument.
const SAMPLE_URL = '/anatomy-expression-sample.json';

// ~40 KB, held for the session and requested only when an anatomy page asks.
let pending;

export default function loadExpressionSample() {
  if (!pending) {
    pending = fetchData(SAMPLE_URL).catch((error) => {
      pending = undefined;
      throw error;
    });
  }
  return pending;
}
