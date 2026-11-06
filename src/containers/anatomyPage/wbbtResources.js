import fetchData from '../../lib/fetchData';

// The resources WormBase keeps about its anatomy terms in ACEDB, which reach
// no Alliance download and no OLS record. Built by
// bin/build_anatomy_wbbt_resources.js and committed under public/.
//
// `terms[curie]` is a list of `{ database, id, url }` — the shape
// src/lib/ols.js gives toExternalResources() for OLS xrefs — so a WBbt page
// can add these to `term.resources` and let the allowlist in
// externalResources.js decide what is shown. `resources[database].verified`
// is the date its links were checked; the generator says how each was.
const URL = '/anatomy-wbbt-resources.json';

// Held for the session and requested only when a WBbt page asks.
let pending;

export default function loadWbbtResources() {
  if (!pending) {
    pending = fetchData(URL).catch((error) => {
      pending = undefined;
      throw error;
    });
  }
  return pending;
}
