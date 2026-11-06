import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import ExternalLink from '../../components/ExternalLink.jsx';
import CommaSeparatedList from '../../components/commaSeparatedList.jsx';
import SampleTable from './SampleTable.jsx';

// The papers behind what this page shows about the structure.
//
// Last of the annotation sections, and derived from all of them: every row
// above cites the paper it was read out of, so counting those citations
// answers a question none of the individual sections ask — which literature
// is this structure's.
//
// Not a curated reference list, and the difference matters enough to say in
// the footnote. No member keeps one of those for an anatomy term. WormBase
// has a references widget and it renders "There are no known or curated
// references annotations for vulva" on every term checked; Xenbase prints
// its own count as "Anatomy Item Literature (0)"; the field labelled
// References on a ZFIN summary holds a Teleost Anatomy Ontology
// cross-reference rather than a publication. A reader who takes this table
// for a curated bibliography would be taking it for something no resource
// has. What it is instead is the annotations turned around.
//
// Links go to /reference/{curie} rather than out to PubMed, which is the
// opposite of what the marker and function sections do, and for a reason
// that is about the data rather than the destination: those two carry a bare
// PMID, and the Alliance literature endpoint answers a PMID with 400. Here
// the generator has already resolved each paper to its AGRKB curie through
// the Alliance's own literature index, and an AGRKB curie is exactly what
// src/components/dataTable/referenceList.jsx requires before it will link a
// citation. PubMed is the fallback for a paper that did not resolve — none
// in the current file, but a member can cite a paper the index has not
// reached yet.

// In page order, so the columns read down the page the reader just scrolled.
const KINDS = {
  expression: 'Expression',
  marker: 'Markers',
  phenotype: 'Phenotypes',
  function: 'Function',
};

// What each column counts, which is not the same unit in all four: a marker
// is one curated gene, a function row one experiment, and the other two one
// annotation each.
const COUNTED = {
  expression: 'expression annotations',
  marker: 'markers',
  phenotype: 'phenotype annotations',
  function: 'function experiments',
};

const pubmed = (id) => `https://pubmed.ncbi.nlm.nih.gov/${id.replace(/^PMID:/, '')}`;

const Citation = ({ id, publication }) => {
  if (!publication) {
    // Unresolved: the literature index had no record cross-referencing this
    // identifier. A PMID can still go somewhere useful; a member paper id
    // has no page of ours to reach and is left as text.
    return id.startsWith('PMID:') ? (
      <ExternalLink href={pubmed(id)}>{id}</ExternalLink>
    ) : (
      <span className="text-monospace">{id}</span>
    );
  }
  return <Link to={`/reference/${publication.curie}`}>{publication.citation}</Link>;
};

Citation.propTypes = {
  id: PropTypes.string.isRequired,
  publication: PropTypes.object,
};

const AnatomyReferences = ({ term, sample, publications, coverage, ontology }) => {
  // Only the columns this term has. A WBbt term outside the expression and
  // phenotype samples has two of the four, and three empty columns would
  // read as three absences rather than as a question not asked here.
  const kinds = sample.kinds;
  // Whether this term's list covers everything the page shows, or only the
  // two complete WormBase sets. The footnote turns on it.
  const whole = kinds.some((kind) => kind === 'expression' || kind === 'phenotype');

  return (
    <>
      {/* A div rather than a p, here and in both footnotes below:
          CommaSeparatedList renders a ul, which a browser moves out of a p
          and leaves the sentence broken in half around it. */}
      <div className="text-muted mb-3">
        <b>
          {sample.totalPublications.toLocaleString()} {sample.totalPublications === 1 ? 'publication' : 'publications'}
        </b>{' '}
        {sample.totalPublications === 1 ? 'is' : 'are'} cited by what this page shows about {term.name} —{' '}
        {sample.totalAnnotations.toLocaleString()} {sample.totalAnnotations === 1 ? 'row' : 'rows'} in the{' '}
        <CommaSeparatedList>{kinds.map((kind) => KINDS[kind])}</CommaSeparatedList>{' '}
        {kinds.length === 1 ? 'section' : 'sections'} above, counted by paper instead of by gene.
      </div>

      <SampleTable
        total={sample.totalPublications}
        shown={sample.publications.length}
        noun="publications"
        ranked="cited"
        ontology={ontology}
        term={term}
      >
        <table className="table">
          <thead className="text-capitalize">
            <tr>
              <th>Reference</th>
              {kinds.map((kind) => (
                <th key={kind} title={`Rows this paper supplied to ${KINDS[kind]}`}>
                  {KINDS[kind]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sample.publications.map((row) => (
              <tr key={row.id}>
                <td>
                  <Citation id={row.id} publication={publications[row.id]} />
                </td>
                {kinds.map((kind) => (
                  <td key={kind}>
                    {/* A paper cited by one section and not another is the
                        normal case, and the dash says the paper is silent
                        there rather than that the count is unknown. */}
                    {row[kind] ? row[kind].toLocaleString() : <span className="text-muted">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </SampleTable>

      <div className="small text-muted mb-3">
        Not a curated reading list. No member keeps one against an anatomy term — WormBase&apos;s references widget is
        empty on every anatomy term checked, and Xenbase states its own count as zero — so this is built the only way
        the question can be answered: every annotation above names the paper it was read out of, and these are those
        papers, ranked by how much of this page each one accounts for. A paper that described the structure without an
        annotation being curated from it is not here.
        {/* Only where it can happen. Every non-article record in the file is
            ZFIN's, and on a worm page the sentence would be a warning about
            something that cannot appear. */}
        {sample.sources.includes('ZFIN') && (
          <>
            {' '}
            Nor is every row a journal article: ZFIN cites its own direct submissions the same way, and here they are
            usually the largest contributors — the Thisse in situ screens among them.
          </>
        )}
      </div>

      <div className="small text-muted mb-3">
        {whole ? (
          <>
            Complete for this term over the sections it draws on, counting {sample.totalAnnotations.toLocaleString()}{' '}
            rows: <CommaSeparatedList>{kinds.map((kind) => COUNTED[kind])}</CommaSeparatedList>.
          </>
        ) : (
          <>
            {/* At most two things here, both WormBase's, so they are joined
                in the sentence rather than set as a list. */}
            Counted from WormBase&apos;s complete sets and nothing else — the{' '}
            {kinds.map((kind) => COUNTED[kind]).join(' and ')} above, and no expression or phenotype at all. Those two
            cannot be searched by anatomy term at the Alliance, so the papers behind them are missing from this list
            rather than absent from the literature, which is the same limit the two sections state for themselves.{' '}
            {coverage.sampled} of the {coverage.terms.toLocaleString()} terms with references here are counted over all
            four.
          </>
        )}{' '}
        {sample.totalPublications > sample.publications.length && (
          <>
            Of those, {sample.publications.length} are shown, taken section by section rather than overall so that a
            section with three papers behind it is not hidden by one with a thousand.{' '}
          </>
        )}
        Citations and their links come from the Alliance&apos;s own literature index; {coverage.shown.toLocaleString()}{' '}
        papers across {coverage.terms.toLocaleString()} terms were resolved through it to build this file.
      </div>
    </>
  );
};

AnatomyReferences.propTypes = {
  term: PropTypes.object.isRequired,
  sample: PropTypes.object.isRequired,
  publications: PropTypes.object.isRequired,
  coverage: PropTypes.object.isRequired,
  ontology: PropTypes.object,
};

export default AnatomyReferences;
