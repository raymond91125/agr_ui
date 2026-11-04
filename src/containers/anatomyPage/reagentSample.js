import fetchData from '../../lib/fetchData';

// Reagents whose phenotype reaches a sample of anatomy terms, built by
// bin/build_anatomy_reagent_sample.js and committed under public/.
//
// A fixture rather than a query, for the same reason as the expression and
// phenotype samples. See the generator for what the Alliance publishes and,
// more to the point here, what it does not: there is no antibody, probe or
// image datatype in the FMS at all.
const SAMPLE_URL = '/anatomy-reagent-sample.json';

// Held for the session and requested only when an anatomy page asks.
let pending;

export default function loadReagentSample() {
  if (!pending) {
    pending = fetchData(SAMPLE_URL).catch((error) => {
      pending = undefined;
      throw error;
    });
  }
  return pending;
}
