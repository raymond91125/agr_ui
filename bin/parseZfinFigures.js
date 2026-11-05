// The two bits of ZFIN markup an anatomy page needs: the figures a term is
// illustrated with, and what each one is of.
//
// Parsed out of served HTML because there is nothing else to parse. ZFIN
// publishes no image API, the Alliance publishes no image datatype, and the
// expression downloads carry a figure identifier but never a picture — see
// bin/build_anatomy_image_sample.js for the whole survey. Both pages below are
// rendered server-side and come back complete to a plain request, which is
// what makes this viable at all; MGI paints its figures in with script and
// WormBase answers a bare fetch with a bot check.
//
// Narrow regexes over a real parser on purpose. These run at build time
// against two known pages, and a regex that stops matching is a generator that
// fails loudly on the next run rather than a dependency carried into the
// bundle. The tests below pin the markup each one expects.

// The `Figures` row of an anatomy term page: an ordered list of thumbnails,
// each linking to the image record.
//
// Anchored on the Figures label rather than scanning the page for images,
// because an anatomy term page also carries thumbnails that are not figures of
// the term — the site banner among them — and because the row's absence is the
// answer for most terms and has to be distinguishable from a parse failure.
const FIGURES_ROW = /Figures\s*<\/dt>\s*<dd[^>]*>(.*?)<\/dd>/s;
const THUMBNAIL = /<a[^>]*href="\/action\/image\/view\/(ZDB-IMAGE-[\w-]+)"[^>]*>\s*<img[^>]*src="([^"]+)"/g;

export function parseFigures(html) {
  const row = html.match(FIGURES_ROW);
  if (!row) {
    return [];
  }
  const figures = [];
  for (const [, id, src] of row[1].matchAll(THUMBNAIL)) {
    figures.push({ id, thumb: src });
  }
  return figures;
}

// An image record, for the caption. The title carries the attribution ZFIN
// itself uses — `ZFIN Image: Thisse et al., 2001, Fig. 5` — which is the
// publication and the figure number in the form a reader would cite, so it is
// taken whole rather than reassembled from the fields below it.
const TITLE = /<title>\s*ZFIN Image:\s*(.*?)\s*<\/title>/s;
const GENES_ROW = /Genes\s*<\/dt>\s*<dd[^>]*>(.*?)<\/dd>/s;
const PUBLICATION_ROW = /Publication\s*<\/dt>\s*<dd[^>]*>(.*?)<\/dd>/s;
const STAGE_SECTION = /<section[^>]*id="developmental-stage"[^>]*>(.*?)<\/section>/s;
const STAGE = /<span class="stage"[^>]*>(.*?)<\/span>/g;
const TAG = /<[^>]+>/g;

const textOf = (html) => html.replace(TAG, ' ').replace(/\s+/g, ' ').trim();

export function parseImageRecord(html) {
  const title = html.match(TITLE);
  const genes = html.match(GENES_ROW);
  const stageSection = html.match(STAGE_SECTION);

  return {
    label: title ? textOf(title[1]) : undefined,
    // Reported separately from the label, and not derived from it, because
    // the difference matters downstream: around half the figures ZFIN
    // illustrates a term with carry no publication at all — no title, no
    // genes, an ID and a stage and nothing else. Those are ZFIN's own to
    // show, and the page credits them to ZFIN rather than leaving the caption
    // blank, which it can only do if the data distinguishes `no publication`
    // from `we failed to read one`.
    published: Boolean(html.match(PUBLICATION_ROW)),
    // ZFIN renders these comma-separated inside one cell, with each gene
    // linked. Split on the markup rather than on the comma: a gene symbol may
    // contain one.
    genes: genes ? [...genes[1].matchAll(/<a[^>]*>(.*?)<\/a>/gs)].map(([, cell]) => textOf(cell)).filter(Boolean) : [],
    // A range, given as its two ends; a figure pinned to one stage has one.
    stages: stageSection ? [...stageSection[1].matchAll(STAGE)].map(([, stage]) => textOf(stage)) : [],
  };
}
