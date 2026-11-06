import fetchData from '../../lib/fetchData';

// Anatomy function annotations for an anatomy term, built by
// bin/build_anatomy_function_sample.js and committed under public/.
//
// Named `sample` for consistency with its neighbours, though, like the marker
// file, it is not one: it holds every annotation in the WormBase release it was
// built from. Unlike the others it is not from an Alliance file at all — the
// Alliance does not publish anatomy function yet. See the generator for where
// it comes from and for the `qualifies` rule the component has to follow.
//
// Shape: `terms[curie]` lists annotation IDs in two roles, `involved` and
// `notInvolved`; `annotations[id]` holds each annotation once; `anatomy[curie]`
// names every structure an annotation mentions.
const SAMPLE_URL = '/anatomy-function-sample.json';

// Held for the session and requested only when an anatomy page asks.
let pending;

export default function loadFunctionSample() {
  if (!pending) {
    pending = fetchData(SAMPLE_URL).catch((error) => {
      pending = undefined;
      throw error;
    });
  }
  return pending;
}
