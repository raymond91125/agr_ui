// Pull the objects out of the `data` array of an Alliance download file
// without holding the file in memory.
//
// These files are shaped { "metaData": {...}, "data": [ {...}, {...} ] }, and
// the mouse expression file is 660 MB uncompressed — past the point where
// JSON.parse can be handed the whole thing as a single string. Only a handful
// of records are wanted, so objects are lifted out of the array as the gzip
// decodes and everything already scanned is dropped.
//
// This is a scanner for one known shape, not a JSON parser: it tracks string
// and escape state only well enough to know which braces are structural.
export default async function* streamJsonObjects(chunks, key = 'data') {
  const marker = `"${key}"`;
  let buf = '';
  let pos = 0;
  let started = false;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = -1;

  for await (const chunk of chunks) {
    buf += chunk;

    if (!started) {
      const at = buf.indexOf(marker);
      const open = at === -1 ? -1 : buf.indexOf('[', at + marker.length);
      if (open === -1) {
        // The marker may straddle a chunk boundary, so keep just enough tail
        // to recognise it next time round.
        if (at === -1 && buf.length > marker.length) {
          buf = buf.slice(-marker.length);
        }
        pos = 0;
        continue;
      }
      started = true;
      pos = open + 1;
    }

    for (; pos < buf.length; pos++) {
      const c = buf[pos];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (c === '\\') {
          escaped = true;
        } else if (c === '"') {
          inString = false;
        }
      } else if (c === '"') {
        inString = true;
      } else if (c === '{') {
        if (depth === 0) {
          start = pos;
        }
        depth += 1;
      } else if (c === '}') {
        depth -= 1;
        if (depth === 0) {
          yield JSON.parse(buf.slice(start, pos + 1));
          start = -1;
        }
      } else if (c === ']' && depth === 0) {
        return;
      }
    }

    // Drop everything consumed; keep only a part-read object.
    const keep = start === -1 ? pos : start;
    buf = buf.slice(keep);
    pos -= keep;
    if (start !== -1) {
      start = 0;
    }
  }
}
