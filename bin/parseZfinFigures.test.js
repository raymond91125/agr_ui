import assert from 'assert';

import { parseFigures, parseImageRecord } from './parseZfinFigures.js';

// Cut from the pages the generator actually reads, on 2026-11-05: the Figures
// row of https://zfin.org/action/ontology/term/ZFA:0000135 and the record at
// https://zfin.org/action/image/view/ZDB-IMAGE-030328-454. Trimmed, but not
// tidied — the stray whitespace, the empty class attribute and the two
// different thumbnail path shapes are all ZFIN's.
const TERM_PAGE = `
  <dl class="attribute-list">
    <dt class="col-sm-2 mb-sm-2 attribute-list-item-dt">References </dt>
    <dd class="col-sm-10 mb-sm-10 attribute-list-item-dd"><ul><li>TAO:0000135</li></ul></dd>
    <dt class="col-sm-2 mb-sm-2 attribute-list-item-dt">Figures </dt>
    <dd class="col-sm-10 mb-sm-10 attribute-list-item-dd">
      <a href="/action/image/view/ZDB-IMAGE-100806-49"><img src="/imageLoadUp/ZDB-IMAGE-100806-49_thumb.jpg"></a>
      <a href="/action/image/view/ZDB-IMAGE-030328-454"><img src="/imageLoadUp/2001/ZDB-PUB-010810-1/ZDB-IMAGE-030328-454_thumb.jpg"></a>
    </dd>
    <dt class="col-sm-2 mb-sm-2 attribute-list-item-dt">Ontology </dt>
    <dd class="col-sm-10 mb-sm-10 attribute-list-item-dd"><span>Anatomy Ontology</span></dd>
  </dl>`;

const IMAGE_PAGE = `
  <html><head><title>ZFIN Image: Thisse et al., 2001, Fig. 5</title></head><body>
  <img class="figure-image " src="/imageLoadUp/2001/ZDB-PUB-010810-1/ZDB-IMAGE-030328-454_annot.jpg"/>
  <dl>
    <dt>ID </dt><dd>ZDB-IMAGE-030328-454</dd>
    <dt>Genes </dt><dd><a href="/ZDB-GENE-980526-474">bmp2b</a>, <a href="/ZDB-GENE-990415-72">shha</a></dd>
    <dt>Publication </dt><dd><a href="/ZDB-PUB-010810-1">Thisse et al., 2001</a></dd>
  </dl>
  <section class="section " id="developmental-stage">
    <div class="heading"> Developmental Stage </div>
    <a href="/zf_info/zfbook/stages/index.html#Pharyngula"><span class="stage" title="Pharyngula:Prim-15 (30.0h-36.0h)">Prim-15</span></a>
    <b> to </b><a href="/zf_info/zfbook/stages/index.html#Pharyngula"><span class="stage" title="Pharyngula:Prim-25 (36.0h-42.0h)">Prim-25</span></a>
  </section>
  <section class="section " id="orientation"><div class="heading"> Orientation </div></section>
  </body></html>`;

describe('parseFigures', () => {
  it('reads the figures a term is illustrated with, in order', () => {
    assert.deepEqual(parseFigures(TERM_PAGE), [
      { id: 'ZDB-IMAGE-100806-49', thumb: '/imageLoadUp/ZDB-IMAGE-100806-49_thumb.jpg' },
      { id: 'ZDB-IMAGE-030328-454', thumb: '/imageLoadUp/2001/ZDB-PUB-010810-1/ZDB-IMAGE-030328-454_thumb.jpg' },
    ]);
  });

  it('returns nothing for a term with no Figures row', () => {
    // The common case by a wide margin, and the reason the generator must be
    // able to tell an unillustrated term from a page it failed to read.
    assert.deepEqual(parseFigures(TERM_PAGE.replace(/Figures /, 'Relationships ')), []);
  });

  it('takes only the Figures row, not every thumbnail on the page', () => {
    const withBanner = TERM_PAGE.replace(
      '<dl class="attribute-list">',
      '<dl class="attribute-list"><a href="/action/image/view/ZDB-IMAGE-000000-1"><img src="/images/banner.gif">'
    );
    assert.deepEqual(
      parseFigures(withBanner).map((figure) => figure.id),
      ['ZDB-IMAGE-100806-49', 'ZDB-IMAGE-030328-454']
    );
  });
});

describe('parseImageRecord', () => {
  it('takes the attribution whole, as ZFIN words it', () => {
    assert.equal(parseImageRecord(IMAGE_PAGE).label, 'Thisse et al., 2001, Fig. 5');
  });

  it('reads every gene, splitting on the markup rather than the comma', () => {
    assert.deepEqual(parseImageRecord(IMAGE_PAGE).genes, ['bmp2b', 'shha']);
  });

  it('reads both ends of the stage range', () => {
    assert.deepEqual(parseImageRecord(IMAGE_PAGE).stages, ['Prim-15', 'Prim-25']);
  });

  it('does not reach past the stage section into the next one', () => {
    const extra = IMAGE_PAGE.replace(
      '<section class="section " id="orientation"><div class="heading"> Orientation </div></section>',
      '<section class="section " id="orientation"><span class="stage">Long-pec</span></section>'
    );
    assert.deepEqual(parseImageRecord(extra).stages, ['Prim-15', 'Prim-25']);
  });

  it('separates an unpublished figure from one it could not read', () => {
    // Both of these are real: around half the figures a ZFIN term page shows
    // are an ID, a stage and nothing else, and the page credits those to ZFIN
    // instead of printing an empty caption.
    assert.equal(parseImageRecord(IMAGE_PAGE).published, true);
    const unpublished = `
      <html><head><title>ZFIN</title></head><body>
      <dl><dt>ID </dt><dd>ZDB-IMAGE-100806-49</dd></dl>
      <section class="section " id="developmental-stage">
        <div class="heading"> Developmental Stage </div>
        <a href="/zf_info/zfbook/stages/index.html#Larval"><span class="stage">Protruding-mouth</span></a>
      </section></body></html>`;
    const record = parseImageRecord(unpublished);
    assert.equal(record.published, false);
    assert.equal(record.label, undefined);
    assert.deepEqual(record.genes, []);
    assert.deepEqual(record.stages, ['Protruding-mouth']);
  });

  it('leaves the fields empty rather than inventing them', () => {
    const bare = parseImageRecord('<html><head><title>ZFIN</title></head><body></body></html>');
    assert.equal(bare.label, undefined);
    assert.deepEqual(bare.genes, []);
    assert.deepEqual(bare.stages, []);
    assert.equal(bare.published, false);
  });
});
