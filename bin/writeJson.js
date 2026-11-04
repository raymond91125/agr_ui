import fs from 'fs';
import { format, resolveConfig } from 'prettier';

// Write a generated table the way `npx prettier --check .` expects to find it.
//
// CI checks every file in the repo, these tables included, so a generator that
// writes its JSON on one line turns the build red the moment it runs. The
// alternative was to list them in .prettierignore, and formatting is worth the
// bytes: a table is regenerated against a new ontology or Alliance release
// from time to time, and a one-line file renders that as a single changed line
// no reviewer can read. Formatted, the diff names the mappings that actually
// moved — which is the review these tables need most, since nothing warns when
// one goes stale. The largest of them pays about 2 KB gzipped for it.
//
// Through prettier itself rather than `JSON.stringify(value, null, 2)`, which
// does not agree with it: prettier keeps a short array on one line up to the
// configured printWidth, and the stringified form would fail the check it is
// meant to satisfy.
export default async function writeJson(destination, value) {
  const options = await resolveConfig(destination);
  fs.writeFileSync(destination, await format(JSON.stringify(value), { ...options, filepath: destination }));
}
