import fetchData from '../../lib/fetchData';

// Member anatomy term -> UBERON term, built by bin/build_anatomy_uberon_map.js
// and committed under public/. See that file for why the table is inverted
// ahead of time rather than queried: OLS holds the mapping only on the UBERON
// term and cannot search xrefs in reverse.
const MAP_URL = '/anatomy-uberon-map.json';

// ~240 KB, so it is held for the session rather than refetched per page, and it
// is requested only when a species anatomy page actually asks for it — nothing
// else in the app imports this.
let pending;

export default function loadUberonMap() {
  if (!pending) {
    pending = fetchData(MAP_URL)
      .then((data) => data?.map || {})
      .catch((error) => {
        // Otherwise one failed load would be cached for the whole session.
        pending = undefined;
        throw error;
      });
  }
  return pending;
}
