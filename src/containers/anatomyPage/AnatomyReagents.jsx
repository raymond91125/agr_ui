import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import CommaSeparatedList from '../../components/commaSeparatedList.jsx';
import ExternalLink from '../../components/ExternalLink.jsx';
import MemberText from './MemberText.jsx';

// Alleles, transgenes and reporter lines whose phenotype reaches this
// structure.
//
// These are the objects the phenotype annotations were made against. The
// Phenotypes section resolves each one back to a gene and shows the gene; this
// one stops a step earlier and shows the thing itself, because a reader who
// wants to work on a structure wants something they can order.
//
// Split by kind rather than ranked in one list, which is how every member
// presents it — FlyBase separates Alleles, Insertions and Constructs, ZFIN
// separates Thisse probes from antibody labelling. A flat table sorted by
// annotation count answers "which reagent is best studied" when the question
// a reader arrives with is "what is there". It also hides whole kinds: the
// 3,179 mutations on wing would fill any top-25 and bury its 80 transgenes.
const KINDS = {
  mutation: {
    title: 'Mutations',
    what: 'A lesion in the gene — the member records the reagent as an allele of it.',
  },
  transgene: {
    title: 'Transgenes and reporters',
    what:
      'Carries a construct rather than damaging a gene. Where the construct expresses a gene of this ' +
      'species, that gene is named; where it expresses a fluorophore, only the promoter it was driven ' +
      'from is, which is what makes it a reporter for this structure rather than a lesion in it.',
  },
  other: {
    title: 'Unclassified',
    what: 'The member names neither a gene nor a construct for these.',
  },
};

const ReagentTable = ({ group, showModels }) => (
  <table className="table">
    <thead className="text-capitalize">
      <tr>
        <th>Reagent</th>
        <th>{group.kind === 'transgene' ? 'Construct' : 'Gene'}</th>
        {group.kind === 'transgene' && <th>Gene or driver</th>}
        <th>Annotations</th>
        {showModels && <th>Through a genotype</th>}
      </tr>
    </thead>
    <tbody>
      {group.reagents.map((reagent) => (
        <tr key={reagent.curie}>
          <td>
            <Link to={`/allele/${reagent.curie}`}>
              <MemberText>{reagent.symbol}</MemberText>
            </Link>
          </td>
          {group.kind === 'transgene' && (
            <td className="text-muted">{reagent.construct ? <MemberText>{reagent.construct}</MemberText> : '—'}</td>
          )}
          <td>
            {reagent.gene ? (
              <Link to={`/gene/${reagent.gene.curie}`}>
                <MemberText>{reagent.gene.symbol}</MemberText>
              </Link>
            ) : reagent.driver ? (
              // Named as a driver, not linked as a gene: the construct is
              // regulated by this promoter and expresses something else, so
              // the phenotype is not evidence about it.
              <span className="text-muted">
                driven by <MemberText>{reagent.driver}</MemberText>
              </span>
            ) : (
              <span className="text-muted">—</span>
            )}
          </td>
          <td>{reagent.annotations.toLocaleString()}</td>
          {showModels && <td className="text-muted">{reagent.throughModels.toLocaleString()}</td>}
        </tr>
      ))}
    </tbody>
  </table>
);

ReagentTable.propTypes = {
  group: PropTypes.object.isRequired,
  showModels: PropTypes.bool,
};

const AnatomyReagents = ({ term, sample, sources, reagentsPerTerm }) => {
  const files = sample.sources.map((mod) => sources[mod]).filter(Boolean);
  const showModels = sample.kinds.some((group) => group.reagents.some((reagent) => reagent.throughModels > 0));

  return (
    <>
      <p className="text-muted">
        <b>{sample.totalReagents.toLocaleString()}</b> reagents have a phenotype annotated to {term.name} —{' '}
        <CommaSeparatedList>
          {sample.kinds.map((group) => (
            <span key={group.kind}>
              {group.total.toLocaleString()} {KINDS[group.kind].title.toLowerCase()}
            </span>
          ))}
        </CommaSeparatedList>
        .
        {sample.toGene > 0 && (
          <>
            {' '}
            A further {sample.toGene.toLocaleString()} annotations name a gene directly, with no reagent, and appear
            under Phenotypes instead.
          </>
        )}
      </p>

      {sample.route === 'definition' && (
        <p className="text-muted">
          Reached through the {sample.via}, which defines each phenotype term as a quality of a named structure. These
          reagents are annotated to those terms, not to {term.name} itself.
        </p>
      )}

      {sample.kinds.map((group) => (
        <section key={group.kind}>
          <h5>
            {KINDS[group.kind].title}{' '}
            <span className="text-muted font-weight-normal">
              {group.total.toLocaleString()}
              {group.total > group.reagents.length && <> — the {reagentsPerTerm} most annotated are shown</>}
            </span>
          </h5>
          <p className="small text-muted">{KINDS[group.kind].what}</p>
          <ReagentTable group={group} showModels={showModels} />
        </section>
      ))}

      {sample.models > 0 && (
        <p className="text-muted">
          {sample.models.toLocaleString()} genotypes carry these reagents.{' '}
          {sample.modelsEmpty > 0 && (
            <>
              A further {sample.modelsEmpty.toLocaleString()} are a genetic background and a set of conditions with no
              allele of their own, so nothing in them can be shown here.
            </>
          )}
        </p>
      )}

      <p className="small text-muted">
        Sample data, and only part of the answer. These are the reagents the Alliance publishes beside its phenotype
        annotations; antibodies and probes are curated by the members but are in no Alliance download, so a member's own
        term page will show more. Rows are unmodified from the Alliance phenotype, allele and construct{' '}
        {files.length > 1 ? 'files' : 'file'}{' '}
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

AnatomyReagents.propTypes = {
  term: PropTypes.object.isRequired,
  sample: PropTypes.object.isRequired,
  sources: PropTypes.object.isRequired,
  reagentsPerTerm: PropTypes.number,
};

export default AnatomyReagents;
