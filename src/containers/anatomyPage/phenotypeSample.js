import fetchData from '../../lib/fetchData';

// Phenotype annotations for a sample of anatomy terms, built by
// bin/build_anatomy_phenotype_sample.js and committed under public/.
//
// A fixture rather than a query, for the same reason as the expression sample:
// the Alliance holds these annotations but can only be asked about them
// gene-first. See the generator for the whole argument, including which
// members put an anatomy term on the annotation and which only reach one
// through their phenotype ontology's definitions.
const SAMPLE_URL = '/anatomy-phenotype-sample.json';

// Held for the session and requested only when an anatomy page asks.
let pending;

export default function loadPhenotypeSample() {
  if (!pending) {
    pending = fetchData(SAMPLE_URL).catch((error) => {
      pending = undefined;
      throw error;
    });
  }
  return pending;
}
