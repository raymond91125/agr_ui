import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import CommaSeparatedList from '../../components/commaSeparatedList.jsx';
import ExternalLink from '../../components/ExternalLink.jsx';
import MemberText from './MemberText.jsx';

// What an experiment showed this structure is FOR.
//
// A third claim, distinct from the two sections above it. Expression says a
// gene is transcribed here. A phenotype annotation says a gene matters
// somewhere. This says the gene acts *here* — shown by mosaic analysis or
// tissue-specific rescue — or that the structure itself matters, shown by
// removing it and watching what followed. It is the only one of the three
// that answers "what does this part of the animal do".
//
// Two tables, not one ranked list, because a structure appears in an
// annotation in one of two opposite roles and the difference is the whole
// point. Involved: the gene acts here, or this structure is needed. Not
// involved: it was tested and shown not to be. Mixed into one table a reader
// skimming would take the second for the first, and the second is the harder
// result to come by.
//
// WormBase only. No other member curates this, and the Alliance publishes no
// file for it yet, so the data comes from WormBase's own ACEDB through a
// converter; bin/build_anatomy_function_sample.js has the route and the
// reason. That also means this is the one section on the page not built from
// an Alliance release, which the footnote has to say.
//
// Exact term only, matching the marker section. An annotation on a single
// neuron of a class is not rolled up to the class.

// PubMed rather than /reference/{curie}, for the reason given in
// AnatomyMarkers.jsx: the Alliance literature endpoint answers a PMID with
// 400, so an internal link would be a dead page.
const pubmed = (publication) => `https://pubmed.ncbi.nlm.nih.gov/${publication.replace(/^PMID:/, '')}`;

const ROLES = {
  involved: {
    title: 'Involved',
    what:
      'The gene was shown to act in this structure, or the structure itself was shown to matter — removing or ' +
      'silencing it changed the phenotype.',
  },
  notInvolved: {
    title: 'Not involved',
    what:
      'Tested and shown not to matter: expression here did not rescue, or ablating this structure changed ' +
      'nothing. A negative result, and a harder one to come by than its opposite.',
  },
};

// Names a structure, linking it to its own anatomy page.
//
// Unlinked when the file could not name it, since a link would lead to a 404
// that looks like our mistake rather than a gap in the vocabulary. One
// structure in WS298 is in that state — WBbt:0004220, in neither ACEDB nor
// OLS, the annotation having outlived the term — though it happens to be
// named by no row that renders. The guard is for the next release, where the
// same thing on a structure shared with a term that does have a page would
// otherwise ship a dead link.
const Structure = ({ curie, name }) =>
  name === curie ? <span className="text-monospace">{curie}</span> : <Link to={`/anatomy/${curie}`}>{name}</Link>;

Structure.propTypes = {
  curie: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
};

const StructureList = ({ curies, anatomy }) => (
  <CommaSeparatedList>
    {curies.map((curie) => (
      <Structure key={curie} curie={curie} name={anatomy[curie] || curie} />
    ))}
  </CommaSeparatedList>
);

StructureList.propTypes = {
  curies: PropTypes.array.isRequired,
  anatomy: PropTypes.object.isRequired,
};

// Necessity and sufficiency describe the structures in one role only, the one
// `qualifies` names, because ACEDB records them per structure and the Alliance
// model records them per annotation. Printed on a row only when that role is
// the table's own. Drop this test and a row in Not involved can read
// "necessary" beside a structure an experiment showed was not needed — the
// exact opposite of the result. In WS298 one annotation, WBbtf0070, has both
// roles and so is the one row this silences.
const Result = ({ annotation, role }) => {
  const qualified = annotation.qualifies === role ? [annotation.necessity, annotation.sufficiency] : [];
  const words = qualified.filter(Boolean);

  if (!words.length && !annotation.cellAutonomy) {
    return <span className="text-muted">—</span>;
  }

  return (
    <>
      {words.join(', ')}
      {annotation.cellAutonomy && (
        // A property of the gene's action rather than of either structure
        // list, so it is shown on a gene row whichever table the row is in.
        <span className="text-muted">
          {words.length > 0 && <br />}
          {annotation.cellAutonomy}
        </span>
      )}
    </>
  );
};

Result.propTypes = {
  annotation: PropTypes.object.isRequired,
  role: PropTypes.string.isRequired,
};

const FunctionTable = ({ ids, role, term, annotations, anatomy }) => (
  <table className="table">
    <thead className="text-capitalize">
      <tr>
        <th>Gene</th>
        <th>Phenotype</th>
        <th>Result</th>
        <th>With</th>
        <th>Assay</th>
        <th>Reference</th>
        <th>Record</th>
      </tr>
    </thead>
    <tbody>
      {ids.map((id) => {
        const annotation = annotations[id];
        // The rest of the structures the annotation named in this same role.
        // Without them a row reads as a claim about this structure alone when
        // the experiment could not separate it from its neighbours.
        const alongside = annotation[role].filter((curie) => curie !== term.curie);
        // On a not-involved row, where the experiment did find somewhere. The
        // contrast is usually the point of the annotation: not here, there.
        const instead = role === 'notInvolved' ? annotation.involved : [];

        return (
          <tr key={id}>
            <td>
              {annotation.gene ? (
                <Link to={`/gene/${annotation.gene.curie}`}>
                  <MemberText>{annotation.gene.symbol}</MemberText>
                </Link>
              ) : (
                // No gene because the experiment was about the structure, not
                // about a gene: something was ablated and a phenotype
                // followed. Said in words rather than left as a dash, which
                // would read as missing data.
                <span className="text-muted">the structure itself</span>
              )}
            </td>
            <td>{annotation.phenotype.name}</td>
            <td>
              <Result annotation={annotation} role={role} />
            </td>
            <td>
              {alongside.length > 0 && <StructureList curies={alongside} anatomy={anatomy} />}
              {instead.length > 0 && (
                <div className="text-muted">
                  required in <StructureList curies={instead} anatomy={anatomy} /> instead
                </div>
              )}
              {alongside.length === 0 && instead.length === 0 && <span className="text-muted">—</span>}
            </td>
            <td>{annotation.assay || <span className="text-muted">not recorded</span>}</td>
            <td>
              <ExternalLink href={pubmed(annotation.publication)} title={annotation.citation}>
                {annotation.publication}
              </ExternalLink>
            </td>
            {/* Not a link. `db/get?name=WBbtf0001;class=Anatomy_function`
                lands on a site search that finds nothing and the REST field
                answers 500: WormBase publishes no page for one of these, and
                its own anatomy term widget prints the ID as bare text for the
                same reason. Kept because it is the handle a curator cites the
                annotation by. */}
            <td className="text-monospace text-muted">{id}</td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

FunctionTable.propTypes = {
  ids: PropTypes.array.isRequired,
  role: PropTypes.string.isRequired,
  term: PropTypes.object.isRequired,
  annotations: PropTypes.object.isRequired,
  anatomy: PropTypes.object.isRequired,
};

const AnatomyFunction = ({ term, sample, annotations, anatomy, source, coverage }) => (
  <>
    <div className="text-muted mb-3">
      <b>
        {sample.totalAnnotations} {sample.totalAnnotations === 1 ? 'experiment' : 'experiments'}
      </b>{' '}
      asked what {term.name} does — where a gene acts, or what happens when this structure is taken away. A different
      claim from the genes expressed here, and from a phenotype scored on the whole animal.
    </div>

    {['involved', 'notInvolved'].map((role) =>
      sample[role].length > 0 ? (
        <section key={role}>
          <h5>
            {ROLES[role].title} <span className="text-muted font-weight-normal">{sample[role].length}</span>
          </h5>
          <p className="small text-muted">{ROLES[role].what}</p>
          <FunctionTable ids={sample[role]} role={role} term={term} annotations={annotations} anatomy={anatomy} />
        </section>
      ) : null
    )}

    <div className="small text-muted mb-3">
      Every anatomy function annotation WormBase has for this term, not a sample. Unlike the rest of this page it is not
      from an Alliance release: the Alliance publishes no anatomy function file, so this is {source.origin}, at{' '}
      {source.release}. WormBase has since become an archive, with curation continuing at the Alliance, so{' '}
      {source.release} is where this data stops.{' '}
      <ExternalLink href={`https://www.wormbase.org/db/get?name=${term.curie};class=Anatomy`}>
        Check this term at WormBase
      </ExternalLink>{' '}
      for the evidence behind each row.
    </div>

    <div className="small text-muted mb-3">
      {coverage.terms.toLocaleString()} of the {coverage.ontologyTerms.toLocaleString()} terms in WormBase&apos;s
      anatomy ontology carry an annotation like these, so most anatomy pages have no such section — the state of the
      curation rather than a limit of these tables.
      {coverage.unplaced > 0 && (
        <>
          {' '}
          A further {coverage.unplaced} annotations name no structure at all: mosaic experiments that showed a gene acts
          non-cell-autonomously without resolving where. They are on their gene&apos;s page at WormBase and can appear
          on no anatomy page, here or anywhere.
        </>
      )}
    </div>
  </>
);

AnatomyFunction.propTypes = {
  term: PropTypes.object.isRequired,
  sample: PropTypes.object.isRequired,
  annotations: PropTypes.object.isRequired,
  anatomy: PropTypes.object.isRequired,
  source: PropTypes.object.isRequired,
  coverage: PropTypes.object.isRequired,
};

export default AnatomyFunction;
