import fetchData from '../../lib/fetchData';

// Genes curated as markers for an anatomy term, built by
// bin/build_anatomy_marker_sample.js and committed under public/.
//
// Named `sample` for consistency with its three neighbours, though it is not
// one: it holds every marker the Alliance publishes. See the generator for why
// that fits in a file, and for the two things it still cannot show.
const SAMPLE_URL = '/anatomy-marker-sample.json';

// Held for the session and requested only when an anatomy page asks.
let pending;

export default function loadMarkerSample() {
  if (!pending) {
    pending = fetchData(SAMPLE_URL).catch((error) => {
      pending = undefined;
      throw error;
    });
  }
  return pending;
}
