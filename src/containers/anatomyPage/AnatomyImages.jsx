import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import CommaSeparatedList from '../../components/commaSeparatedList.jsx';
import ExternalLink from '../../components/ExternalLink.jsx';
import MemberText from './MemberText.jsx';
import style from './style.module.scss';

// Figures showing the structure.
//
// The only section here whose data is not an Alliance download, and the only
// one serving nothing of its own: every thumbnail below is loaded from
// zfin.org at the reader's browser, so ZFIN serves it, counts it, and can
// withdraw it at any time without a deploy on our side. Nothing is copied.
// bin/build_anatomy_image_sample.js has the licence reasoning; the short form
// is that the Alliance's CC BY 4.0 covers its annotation files and not the
// figures in the literature they cite.
//
// Which makes the caption load-bearing rather than decoration. A figure
// reproduced without its source is the thing we are trying not to do, so every
// one carries ZFIN's own attribution where ZFIN gives one and a credit to ZFIN
// where it does not — about half of them, which have an identifier and a stage
// and no publication at all — and all of them link back to the record.
const Figure = ({ image, mod }) => (
  <figure className={style.figure}>
    {/* Not ExternalLink: it appends an arrow glyph after its children, which
        belongs beside text and not hanging off the corner of a picture. */}
    <a href={image.page} target="_blank" rel="noopener noreferrer">
      <img
        className={style.thumb}
        src={image.thumb}
        // The caption carries the attribution, so alt text is free to say
        // what the picture is for someone who cannot see it. It is not known
        // beyond the genes and the stage, so it says only that much.
        alt={image.genes?.length ? `${image.genes.join(', ')} in this structure` : 'Figure of this structure'}
        loading="lazy"
      />
    </a>
    <figcaption className={`${style.caption} text-muted`}>
      {image.label || mod}
      {image.genes?.length > 0 && (
        <>
          <br />
          <CommaSeparatedList>
            {image.genes.map((gene) => (
              <MemberText key={gene}>{gene}</MemberText>
            ))}
          </CommaSeparatedList>
        </>
      )}
      {image.stages?.length > 0 && (
        <>
          <br />
          {image.stages.join(' to ')}
        </>
      )}
    </figcaption>
  </figure>
);

Figure.propTypes = {
  image: PropTypes.object.isRequired,
  mod: PropTypes.string.isRequired,
};

const AnatomyImages = ({ term, sample, source, ontology }) => {
  const credited = sample.images.filter((image) => image.published).length;
  const uncredited = sample.totalImages - credited;

  return (
    <>
      <p className="text-muted">
        {/* Counted as what it is. This is not every figure showing the
            structure — ZFIN's expression literature holds thousands for
            liver — it is the set ZFIN picked to illustrate the term, which is
            a different and smaller claim. */}
        <b>
          {sample.totalImages.toLocaleString()} {sample.totalImages === 1 ? 'figure' : 'figures'}
        </b>{' '}
        illustrate {term.name} at {source.mod}.
      </p>

      <div className={style.figures}>
        {sample.images.map((image) => (
          <Figure key={image.id} image={image} mod={source.mod} />
        ))}
      </div>

      <p className="small text-muted">
        Shown from {source.mod}, not copied: each figure is loaded from{' '}
        <ExternalLink href={source.home}>{source.home.replace(/^https:\/\//, '')}</ExternalLink> and links back to the
        record it comes from.{' '}
        {credited > 0 && (
          <>
            {credited} of {sample.totalImages} {credited === 1 ? 'names' : 'name'} a publication and{' '}
            {credited === 1 ? 'is' : 'are'} captioned with it;{' '}
          </>
        )}
        {uncredited > 0 && (
          <>
            {uncredited} {uncredited === 1 ? 'names' : 'name'} none and {uncredited === 1 ? 'is' : 'are'} credited to{' '}
            {source.mod} as the source of record;{' '}
          </>
        )}
        rights in the underlying figures rest with their authors and publishers.{' '}
        {ontology?.mod && (
          <ExternalLink href={ontology.termUrl(term.curie)}>View this term at {ontology.mod}</ExternalLink>
        )}
        {ontology?.mod && '.'}
      </p>

      <p className="small text-muted">
        Sample data. Of the six member anatomy vocabularies only {source.mod} publishes figures against the term itself,
        so this section is absent from the others rather than empty, and absent from most {source.mod} terms too &mdash;
        figures reach the best-studied structures and stop. Retrieved {source.retrieved}.{' '}
        <Link to={`/ontology/${ontology.id}/${term.curie}`}>Browse the ontology</Link> for neighbouring structures.
      </p>
    </>
  );
};

AnatomyImages.propTypes = {
  term: PropTypes.object.isRequired,
  sample: PropTypes.object.isRequired,
  source: PropTypes.object.isRequired,
  ontology: PropTypes.object,
};

export default AnatomyImages;
