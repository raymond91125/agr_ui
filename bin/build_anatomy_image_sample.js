import fs from 'fs';

import { parseFigures, parseImageRecord } from './parseZfinFigures.js';
import writeJson from './writeJson.js';

// The figures a member uses to illustrate an anatomy term.
//
// This generator is the odd one of the four. The expression, phenotype and
// reagent samples all inverted an Alliance download that already held the
// answer and could only be queried gene-first. There is no download to invert
// here. The FMS publishes no image datatype at all — IMAGE, IMAGES, PHOTO and
// FIGURE each answer 204 — and nothing in src/resourceDescriptors.js is keyed
// by an anatomy term: all five `gene/expression_images` templates take a gene,
// and WBbt, ZFA and vfb have no registered pages whatever.
//
// What the expression files do carry, per annotation, is a link to the member
// page holding the figure, and never a picture: WormBase a WB:Expr pattern,
// ZFIN a ZDB-FIG, MGI an assay. FlyBase, Xenbase, RGD and SGD carry not even
// that. Following those links does not scale and does not pay: liver alone has
// 2,377 distinct ZFIN figures and 17,907 MGI assays, and of the thirty ZFIN
// figures carrying the most liver annotations only nine have an image behind
// them, because a figure whose image was never deposited is still a figure.
// Ranking by annotation count does not select for pictures.
//
// So this reads the one place a member keys images to the term itself: the
// Figures row of a ZFIN term page. Of the six member vocabularies it is the
// only one. Surveyed in a real browser on 2026-11-05, the WBbt page paints
// seven images and the EMAPA page eight, every one of them site furniture;
// FlyBase gives a count into image search rather than a figure; and Xenbase
// publishes no XAO term report page at all, every candidate route returning
// the same navigation shell.
//
// Coverage follows the same curve as every other section: twelve of the
// fifteen most-annotated ZFA terms carry figures, and none of fifteen sampled
// from the middle of the distribution do.
//
// Two things the output deliberately does not claim. First, these are the
// figures ZFIN chose to illustrate the term, not every figure showing it —
// liver has four here and thousands in the expression literature — so the
// count is of what is shown and the section says what it is a count of.
// Second, nothing is copied: the fixture holds ZFIN's own URLs and the page
// hotlinks them, so ZFIN serves every byte and can withdraw them without a
// deploy on our side. That matters because the images are not ours to
// republish. The Alliance files are CC BY 4.0; these figures are not covered
// by it and nobody warrants them — ZFIN's terms state it makes no
// representation that its data is free from third-party copyright
// infringement and that the licensee assumes the entire risk, and MGI attaches
// a per-image copyright field that sometimes names an individual to ask.
// Every thumbnail is captioned with ZFIN's own attribution and links to the
// record it came from.
//
// Not wired into `npm run generators`: it reads ZFIN directly, a page per term
// and a page per figure, and it should be run deliberately. Run it by hand.
//
//   node bin/build_anatomy_image_sample.js

const ZFIN = 'https://zfin.org';
const DESTINATION = 'public/anatomy-image-sample.json';

// A courtesy gap between requests. This takes about thirty of them.
const PAUSE_MS = 400;

// The terms the expression, phenotype and reagent samples already use, so the
// four sections on a page are cut from the same two terms and a reader can
// check one against another.
const SAMPLE = {
  ZFIN: {
    species: 'Danio rerio',
    terms: ['ZFA:0000135', 'ZFA:0000123'],
  },
};

const pause = () => new Promise((resolve) => setTimeout(resolve, PAUSE_MS));

async function page(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`);
  }
  return response.text();
}

const terms = {};

for (const [mod, member] of Object.entries(SAMPLE)) {
  console.log(`${mod}:`);
  for (const curie of member.terms) {
    const figures = parseFigures(await page(`${ZFIN}/action/ontology/term/${curie}`));
    await pause();

    // A term with no Figures row is the common case and not an error. A term
    // whose page we could not read at all throws above, which is the
    // distinction worth keeping.
    if (figures.length === 0) {
      console.log(`  ${curie.padEnd(16)} no figures`);
      continue;
    }

    const images = [];
    for (const figure of figures) {
      const record = parseImageRecord(await page(`${ZFIN}/action/image/view/${figure.id}`));
      await pause();
      images.push({
        id: figure.id,
        thumb: `${ZFIN}${figure.thumb}`,
        page: `${ZFIN}/action/image/view/${figure.id}`,
        ...record,
      });
    }

    terms[curie] = {
      sources: [mod],
      species: member.species,
      totalImages: images.length,
      images,
    };

    const captioned = images.filter((image) => image.label).length;
    console.log(`  ${curie.padEnd(16)} ${String(images.length).padStart(3)} figures  ${captioned} captioned`);
  }
}

if (Object.keys(terms).length === 0) {
  throw new Error('no term yielded a figure — has the ZFIN term page changed shape?');
}

await writeJson(DESTINATION, {
  source: { mod: 'ZFIN', species: 'Danio rerio', home: ZFIN, retrieved: new Date().toISOString().slice(0, 10) },
  terms,
});
console.log(`\n${DESTINATION}: ${Object.keys(terms).length} terms, ${fs.statSync(DESTINATION).size} bytes`);
