import fetchData from '../../lib/fetchData';

// Figures illustrating a sample of anatomy terms, built by
// bin/build_anatomy_image_sample.js and committed under public/.
//
// A fixture like the other three, but for a different reason. Those invert an
// Alliance download that can only be queried gene-first; this one has no
// download behind it at all, because the FMS publishes no image datatype and
// no member but ZFIN keys images to the anatomy term. See the generator.
//
// The fixture holds ZFIN's URLs, not copies. Nothing here is served by the
// Alliance.
const SAMPLE_URL = '/anatomy-image-sample.json';

// Held for the session and requested only when an anatomy page asks.
let pending;

export default function loadImageSample() {
  if (!pending) {
    pending = fetchData(SAMPLE_URL).catch((error) => {
      pending = undefined;
      throw error;
    });
  }
  return pending;
}
