import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import Subsection from '../../components/subsection.jsx';
import NotFound from '../../components/notFound.jsx';
import NoData from '../../components/noData.jsx';
import HeadMetaTags from '../../components/headMetaTags.jsx';
import ExternalLink from '../../components/ExternalLink.jsx';
import { DataPage, PageNav, PageData, PageHeader } from '../../components/dataPage';
import PageNavEntity from '../../components/dataPage/PageNavEntity.jsx';
import PageCategoryLabel from '../../components/dataPage/PageCategoryLabel.jsx';
import YourInputWelcome from '../../components/YourInputWelcome.jsx';
import usePageLoadingQuery from '../../hooks/usePageLoadingQuery';
import { ANATOMY_CATEGORY } from '../../constants';
import { getOntologyForCurie } from '../ontologyBrowser/ontologies.js';
import AnatomyBasicInfo from './AnatomyBasicInfo.jsx';
import AnatomySpeciesTable from './AnatomySpeciesTable.jsx';
import AnatomyStageRange from './AnatomyStageRange.jsx';
import AnatomyRelations from './AnatomyRelations.jsx';
import AnatomyExpression from './AnatomyExpression.jsx';
import AnatomyPhenotypes from './AnatomyPhenotypes.jsx';
import AnatomyReagents from './AnatomyReagents.jsx';
import fetchAnatomyTerm from './fetchAnatomyTerm.js';
import fetchAcrossSpecies from './fetchAcrossSpecies.js';
import loadExpressionSample from './expressionSample.js';
import loadPhenotypeSample from './phenotypeSample.js';
import loadReagentSample from './reagentSample.js';

const SUMMARY = 'Summary';
const EXPRESSION = 'Genes Expressed Here';
const PHENOTYPES = 'Phenotypes';
const REAGENTS = 'Reagents and Tools';
const UBERON_MAPPING = 'UBERON Mapping';
const STAGES = 'Developmental Window';
const RELATIONS = 'Relationships';
const BROWSE_ONTOLOGY = 'Browse Ontology';

const AnatomyPage = () => {
  const { id: curie } = useParams();
  const ontology = getOntologyForCurie(curie);
  // This route serves anatomy vocabularies only. A curie from another ontology
  // the browser knows — a DOID, say — is as much a 404 here as an unknown one.
  const isAnatomy = ontology?.group === 'Anatomy';

  const { isLoading, isError, data } = usePageLoadingQuery(isAnatomy ? `anatomy:${ontology.id}:${curie}` : null, () =>
    fetchAnatomyTerm(ontology, curie)
  );

  // The mapping lives on the UBERON term, so this waits on the term fetch
  // rather than running beside it — a species page needs the term's own xrefs
  // before it can tell whether it has to consult the inverted table at all.
  // It is also the only part of the page that fans out to one request per
  // mapped species.
  // A fixture, so it is fetched once per session and shared by every anatomy
  // page. Most terms are not in it; see expressionSample.js for why there is a
  // fixture at all.
  const { data: expression } = useQuery({
    queryKey: ['anatomy-expression-sample'],
    queryFn: loadExpressionSample,
    staleTime: Infinity,
    retry: false,
  });

  const { data: phenotypes } = useQuery({
    queryKey: ['anatomy-phenotype-sample'],
    queryFn: loadPhenotypeSample,
    staleTime: Infinity,
    retry: false,
  });

  const { data: reagents } = useQuery({
    queryKey: ['anatomy-reagent-sample'],
    queryFn: loadReagentSample,
    staleTime: Infinity,
    retry: false,
  });

  const { isLoading: speciesLoading, data: species } = useQuery({
    queryKey: ['anatomy-species', curie],
    queryFn: () => fetchAcrossSpecies(ontology, data.term),
    enabled: Boolean(data?.term),
    staleTime: 5 * 60_000,
  });

  if (!isAnatomy || isError) {
    return <NotFound />;
  }

  if (isLoading || !data) {
    return null; // the main page loading bar is sufficient
  }

  const { term, relations, stages } = data;
  const title = term.name || term.curie;

  const expressionSample = expression?.terms?.[term.curie];
  const phenotypeSample = phenotypes?.terms?.[term.curie];
  const reagentSample = reagents?.terms?.[term.curie];

  const keywords = ['anatomy', term.curie, term.name, ontology.species, ontology.mod].filter(Boolean);
  if (term.synonyms?.length) {
    keywords.push(...term.synonyms);
  }

  const siteUrl = `https://www.alliancegenome.org/anatomy/${term.curie}`;

  const jsonLd = [
    {
      '@context': 'http://schema.org',
      '@type': 'Dataset',
      '@id': term.curie,
      name: term.name,
      description: term.definition,
      url: siteUrl,
      keywords: keywords.join(' '),
      includedInDataCatalog: 'https://www.alliancegenome.org',
      creator: {
        '@type': 'Organization',
        name: 'Alliance of Genome Resources',
      },
      version: '2.0',
      license: 'CC BY 4.0',
    },
    {
      '@context': 'http://schema.org',
      '@type': 'AnatomicalStructure',
      '@id': term.curie,
      identifier: term.curie,
      name: term.name,
      url: siteUrl,
      description: term.definition,
    },
  ];

  return (
    <DataPage>
      <HeadMetaTags jsonLd={jsonLd} title={title} />
      {/* Counts on the three sections that answer "how much is here", and on
          no others: Developmental Window and Relationships state what the
          ontology says about the term, and a number beside either would
          measure the vocabulary rather than the evidence.

          A count has to be a number we can stand behind, so it is omitted
          rather than zeroed whenever we do not know one. UBERON Mapping is the
          only section that can honestly show a zero — the mapping table is
          complete, so no row means no member maps this structure, which is the
          answer for WBbt:0006748 and worth seeing before the click. Expression
          and Phenotypes carry a count only for a term in the sample: the
          Alliance holds annotations for every other term and simply cannot be
          asked for them by anatomy term, and a grey `0` there would assert
          that none exist. Undefined renders no badge, which also covers the
          beat before the species fetch and the fixtures arrive. */}
      <PageNav
        sections={[
          { name: SUMMARY },
          ...(stages ? [{ name: STAGES }] : []),
          ...(relations ? [{ name: RELATIONS }] : []),
          { name: UBERON_MAPPING, count: species?.rows?.length },
          ...(ontology.crossSpecies
            ? []
            : [
                { name: EXPRESSION, count: expressionSample?.totalGenes },
                { name: PHENOTYPES, count: phenotypeSample?.totalGenes },
                ...(reagentSample ? [{ name: REAGENTS, count: reagentSample.totalReagents }] : []),
              ]),
          { name: BROWSE_ONTOLOGY, to: `/ontology/${ontology.id}/${term.curie}` },
        ]}
      >
        <PageNavEntity entityName={title}>
          <ExternalLink href={ontology.termUrl(term.curie)}>{term.curie}</ExternalLink>
        </PageNavEntity>
      </PageNav>
      <PageData>
        <PageCategoryLabel category={ANATOMY_CATEGORY} displayName="Anatomy" />
        <PageHeader>{title}</PageHeader>
        <YourInputWelcome type="Anatomy" name={title} allianceId={term.curie} />

        <Subsection hideTitle title={SUMMARY}>
          <AnatomyBasicInfo ontology={ontology} term={term} />
        </Subsection>

        {/* Hidden outright when the vocabulary has no stage axis: WBbt and FBbt
            put staging on the annotation rather than the term, and UBERON is
            stage-neutral. An empty block would imply the range is merely
            missing. */}
        {stages && (
          <Subsection title={STAGES}>
            <AnatomyStageRange stages={stages} ontology={ontology} />
          </Subsection>
        )}

        {/* The one section every member vocabulary can fill: WBbt and FBbt have
            no stage axis, but both assert relations the hierarchy cannot carry.
            Null only for a term the ontology says nothing else about, which in
            practice means a root. */}
        {relations && (
          <Subsection title={RELATIONS}>
            <AnatomyRelations relations={relations} term={term} />
          </Subsection>
        )}

        {/* On every anatomy page, not just UBERON's. The question — which
            animals have this structure, and what does each member call it — is
            the same from either end; only the direction of the lookup differs,
            and fetchAcrossSpecies hides that.

            Named for the mechanism rather than for the table's columns. The
            whole section exists because UBERON mapped these terms onto one
            another, and a reader cannot judge a row without knowing that.
            `Mapping` and not `group`: WBbt, ZFA, XAO and EMAPA `intestine`
            are four assertions about four animals, not four members of one
            thing. */}
        <Subsection title={UBERON_MAPPING}>
          <AnatomySpeciesTable rows={species?.rows} through={species?.through} isLoading={speciesLoading} />
        </Subsection>

        {/* Every Alliance expression annotation already carries its native
            member anatomy term, but the API can only be queried gene-first —
            /api/expression takes a required list of gene IDs — so there is no
            way to ask which genes are expressed in a term. Say so plainly
            instead of hiding the section: a reader who came here for expression
            should learn where it is, not think none exists. Not on the UBERON
            page, where expression would be a question about no species in
            particular. */}
        {!ontology.crossSpecies && (
          <Subsection title={EXPRESSION}>
            {expressionSample ? (
              <AnatomyExpression
                term={term}
                sample={expressionSample}
                sources={expression.sources}
                genesPerTerm={expression.genesPerTerm}
              />
            ) : (
              <NoData>
                Expression annotations cannot yet be searched by anatomy term at the Alliance.
                {ontology.mod && (
                  <>
                    {' '}
                    <ExternalLink href={ontology.termUrl(term.curie)}>
                      View expression for this term at {ontology.mod}
                    </ExternalLink>
                    .
                  </>
                )}
              </NoData>
            )}
          </Subsection>
        )}

        {/* Beside expression for the same reason and with the same limit, but
            a member's phenotype data reaches an anatomy term by one of two
            routes and the section has to say which. ZFIN and FlyBase curate
            against an anatomy term, so the annotation names the structure.
            WormBase and Xenbase annotate to a phenotype-ontology term, and the
            structure is only in that term's logical definition — a claim by
            the ontology rather than by the curator who scored the animal.
            MGI, RGD, SGD and HUMAN submit no annotation that reaches a member
            anatomy ontology; bin/build_anatomy_phenotype_sample.js records why
            for each, and why MGI is not the same case as the other three. */}
        {!ontology.crossSpecies && (
          <Subsection title={PHENOTYPES}>
            {phenotypeSample ? (
              <AnatomyPhenotypes
                term={term}
                sample={phenotypeSample}
                sources={phenotypes.sources}
                genesPerTerm={phenotypes.genesPerTerm}
              />
            ) : (
              <NoData>
                Phenotype annotations cannot yet be searched by anatomy term at the Alliance.
                {ontology.mod && (
                  <>
                    {' '}
                    <ExternalLink href={ontology.termUrl(term.curie)}>View this term at {ontology.mod}</ExternalLink>.
                  </>
                )}
              </NoData>
            )}
          </Subsection>
        )}

        {/* Hidden outright where there is nothing to resolve, rather than
            shown empty. Xenbase scores every phenotype annotation against a
            gene and the Alliance publishes no allele file for either Xenopus
            species, so the question has no answer there — Tier A, the same
            case as Developmental Window on a WBbt term. Where a member does
            keep reagents, the section appears only for a term in the sample
            for the usual reason, and the absence of a count in the index says
            which of the two a reader is looking at. */}
        {reagentSample && (
          <Subsection title={REAGENTS}>
            <AnatomyReagents
              term={term}
              sample={reagentSample}
              sources={reagents.sources}
              reagentsPerTerm={reagents.reagentsPerTerm}
            />
          </Subsection>
        )}
      </PageData>
    </DataPage>
  );
};

export default AnatomyPage;
