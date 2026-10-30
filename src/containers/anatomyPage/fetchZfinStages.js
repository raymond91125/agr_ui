// When a zebrafish structure is present, from the files ZFIN publishes.
//
// Why files and not an API: no member database serves anatomy with
// `access-control-allow-origin`. FlyBase's API returns clean JSON but sends no
// CORS header, ZFIN's /action/api/ path serves HTML, and MGI, Xenbase and
// Virtual Fly Brain have no anatomy endpoint a browser may call. So nothing on
// this page can reach a member directly; it goes through a proxy or not at all.
//
// These two files are small, versioned with the ZFIN release, and carry exactly
// what the ZFIN term page renders as "Appears at" and "Evident until":
//
//   anatomy_item.txt    ZFA curie -> start stage id, end stage id   (~3,100 rows)
//   stage_ontology.txt  stage id  -> ZFS curie, name, start h, end h   (45 rows)
//
// The dev server proxies /mod/zfin to zfin.org (see vite.config.ts). Where that
// proxy is absent the fetch fails and the section hides itself, which is the
// honest behaviour until the Alliance serves this data itself.

const ZFIN_BASE = '/mod/zfin/downloads';

const parseTsv = (text) =>
  text
    .split('\n')
    .map((line) => line.split('\t'))
    .filter((row) => row.length > 1);

const getText = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} responded ${response.status}`);
  }
  return response.text();
};

async function load() {
  const [items, stages] = await Promise.all([
    getText(`${ZFIN_BASE}/anatomy_item.txt`),
    getText(`${ZFIN_BASE}/stage_ontology.txt`),
  ]);

  const byStageId = new Map();
  for (const [id, curie, name, start, end] of parseTsv(stages)) {
    byStageId.set(id, { curie, name, start: Number(start), end: Number(end) });
  }

  const byTerm = new Map();
  for (const [curie, , startId, endId] of parseTsv(items)) {
    const start = byStageId.get(startId);
    const end = byStageId.get(endId);
    // A term whose stages do not resolve is dropped rather than half-rendered.
    if (start && end) {
      byTerm.set(curie, { start, end });
    }
  }
  return byTerm;
}

// One load per session: together the files are about 230KB and change per ZFIN
// release, not per page view. A failure clears the cache so a later page retries
// rather than inheriting the error for the rest of the session.
let pending;

export default async function fetchZfinStages(curie) {
  if (!pending) {
    pending = load().catch((error) => {
      pending = undefined;
      throw error;
    });
  }
  const byTerm = await pending;
  return byTerm.get(curie) || null;
}
