import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import SpeciesName from '../../components/SpeciesName.jsx';
import CommaSeparatedList from '../../components/commaSeparatedList.jsx';
import ExternalLink from '../../components/ExternalLink.jsx';
import MemberText from './MemberText.jsx';
import SampleTable from './SampleTable.jsx';

// Genes whose perturbation gives a phenotype in this structure.
//
// The same notice as Genes Expressed Here, and for the same reason: these are
// real Alliance annotations, which makes the table more misleading than mock
// data would be, not less. Nothing in a list of real rows says it covers eight
// terms, or that it is the top slice of several thousand genes.
//
// The second notice is particular to phenotype. Only ZFIN and FlyBase curate a
// phenotype against an anatomy term; WormBase and Xenbase annotate to a
// phenotype-ontology term whose *definition* names the structure, so those
// rows reached this page through an ontology's reasoning rather than through a
// curator's statement about this structure. A reader cannot weigh a row
// without being told which of the two it is.
const AnatomyPhenotypes = ({ term, sample, sources, ontology }) => {
  const species = [...new Set(sample.genes.map((gene) => gene.species))];
  const files = sample.sources.map((mod) => sources[mod]).filter(Boolean);
  const truncated = sample.totalGenes > sample.genes.length;

  return (
    <>
      <p className="text-muted">
        <b>{sample.totalGenes.toLocaleString()} genes</b> have a phenotype annotated to {term.name}, across{' '}
        {sample.totalAnnotations.toLocaleString()} annotations
        {truncated && <> — more than any one table should hold</>}.
      </p>

      {sample.route === 'definition' && (
        <p className="text-muted">
          Reached through the {sample.via}, which defines each phenotype term as a quality of a named structure. These
          phenotypes are annotated to those terms, not to {term.name} itself.
        </p>
      )}

      <SampleTable total={sample.totalGenes} shown={sample.genes.length} noun="genes" ontology={ontology} term={term}>
        <table className="table">
          <thead className="text-capitalize">
            <tr>
              <th>Gene</th>
              {species.length > 1 && <th>Species</th>}
              <th>Annotations</th>
              <th>Phenotype</th>
            </tr>
          </thead>
          <tbody>
            {sample.genes.map((gene) => (
              <tr key={gene.curie}>
                <td>
                  <Link to={`/gene/${gene.curie}`}>{gene.symbol}</Link>
                </td>
                {species.length > 1 && (
                  <td>
                    <SpeciesName>{gene.species}</SpeciesName>
                  </td>
                )}
                <td>{gene.annotations.toLocaleString()}</td>
                {/* As the member wrote it. The members differ in what a
                  phenotype statement is: ZFIN composes a quality with the
                  structure, so a row reads `notochord undulate, abnormal`,
                  while FlyBase records only the structure a phenotype is
                  manifest in and a row reads `wing`. Normalizing the two would
                  invent a quality FlyBase never curated. */}
                <td className="text-muted">
                  {gene.phenotypes.map((statement, index) => (
                    <React.Fragment key={statement}>
                      {index > 0 && '; '}
                      <MemberText>{statement}</MemberText>
                    </React.Fragment>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SampleTable>

      {sample.unattributed > 0 && (
        <p className="text-muted">
          A further {sample.unattributed.toLocaleString()} annotations reach no gene, being scored either against a
          genotype that carries no allele of its own — a genetic background and a set of conditions — or against a
          transgenic insertion the member records against no gene. The reagents themselves are under Reagents and Tools.
        </p>
      )}
      {sample.shared > 0 && (
        <p className="text-muted">
          {sample.shared.toLocaleString()} of the {sample.totalAnnotations.toLocaleString()} were scored against a
          genotype carrying alleles of more than one gene, and are counted under each of them, so the Annotations column
          sums past that total.
        </p>
      )}

      <p className="small text-muted">
        Sample data. The Alliance holds these annotations but cannot yet be asked for them by anatomy term, so this
        table is built ahead of time for a handful of terms and most anatomy pages have no table at all. Rows are
        unmodified from the Alliance phenotype {files.length > 1 ? 'files' : 'file'}{' '}
        <CommaSeparatedList>
          {files.map((file) => (
            <ExternalLink key={file.url} href={file.url}>
              {file.species} {file.release}
            </ExternalLink>
          ))}
        </CommaSeparatedList>
        .
      </p>
    </>
  );
};

AnatomyPhenotypes.propTypes = {
  term: PropTypes.object.isRequired,
  sample: PropTypes.object.isRequired,
  sources: PropTypes.object.isRequired,
  ontology: PropTypes.object,
};

export default AnatomyPhenotypes;
