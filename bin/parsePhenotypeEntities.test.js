import assert from 'assert';

import parsePhenotypeEntities from './parsePhenotypeEntities.js';

// Cut down from xpo-base.owl, keeping the shapes that decide whether the
// committed table is right: the nested anonymous class inside an equivalence,
// a term with no definition at all, and a definition that names no anatomy.
const OWL = `<?xml version="1.0"?>
<rdf:RDF>
    <owl:Ontology rdf:about="http://purl.obolibrary.org/obo/xpo/xpo-base.owl">
        <owl:versionIRI rdf:resource="http://purl.obolibrary.org/obo/xpo/releases/2025-07-25/xpo-base.owl"/>
    </owl:Ontology>
    <owl:Class rdf:about="http://purl.obolibrary.org/obo/XPO_0100976">
        <owl:equivalentClass>
            <owl:Restriction>
                <owl:onProperty rdf:resource="http://purl.obolibrary.org/obo/BFO_0000051"/>
                <owl:someValuesFrom>
                    <owl:Class>
                        <owl:intersectionOf rdf:parseType="Collection">
                            <rdf:Description rdf:about="http://purl.obolibrary.org/obo/PATO_0000001"/>
                            <owl:Restriction>
                                <owl:onProperty rdf:resource="http://purl.obolibrary.org/obo/RO_0002314"/>
                                <owl:someValuesFrom rdf:resource="http://purl.obolibrary.org/obo/XAO_0000179"/>
                            </owl:Restriction>
                        </owl:intersectionOf>
                    </owl:Class>
                </owl:someValuesFrom>
            </owl:Restriction>
        </owl:equivalentClass>
        <rdfs:subClassOf rdf:resource="http://purl.obolibrary.org/obo/XPO_0100715"/>
        <oboInOwl:hasDbXref rdf:resource="http://purl.obolibrary.org/obo/XAO_9999999"/>
    </owl:Class>
    <owl:Class rdf:about="http://purl.obolibrary.org/obo/XPO_0000111">
        <rdfs:subClassOf rdf:resource="http://purl.obolibrary.org/obo/XPO_0000001"/>
    </owl:Class>
    <owl:Class rdf:about="http://purl.obolibrary.org/obo/XPO_0000222">
        <owl:equivalentClass>
            <owl:Restriction>
                <owl:onProperty rdf:resource="http://purl.obolibrary.org/obo/RO_0002314"/>
                <owl:someValuesFrom rdf:resource="http://purl.obolibrary.org/obo/GO_0016028"/>
            </owl:Restriction>
        </owl:equivalentClass>
    </owl:Class>
    <owl:Class rdf:about="http://purl.obolibrary.org/obo/XAO_0000179"/>
</rdf:RDF>
`;

describe('parsePhenotypeEntities', () => {
  const { versionIri, map } = parsePhenotypeEntities(OWL, { phenotypePrefix: 'XPO', entityPrefix: 'XAO' });

  it('reads the release the table was built from', () => {
    assert.equal(versionIri, 'http://purl.obolibrary.org/obo/xpo/releases/2025-07-25/xpo-base.owl');
  });

  it('reads an entity out past a nested anonymous class', () => {
    // The entity sits inside an `<owl:Class>` of its own, four elements deep.
    // Matching the stanza to the first `</owl:Class>` ends the body before it
    // and loses the mapping without failing — which is why the parser counts
    // depth rather than matching lazily.
    assert.deepEqual(map['XPO:0100976'], ['XAO:0000179']);
  });

  it('ignores identifiers outside the equivalence', () => {
    // The same term carries an XAO cross-reference as a sibling of the
    // definition. A cross-reference is a different claim and would put rows on
    // the wrong anatomy page.
    assert.ok(!map['XPO:0100976'].includes('XAO:9999999'));
  });

  it('leaves out a term with no definition', () => {
    assert.equal(map['XPO:0000111'], undefined);
  });

  it('leaves out a definition that names no anatomy', () => {
    assert.equal(map['XPO:0000222'], undefined);
  });

  it('does not mistake an entity class for a phenotype class', () => {
    assert.ok(Object.keys(map).every((curie) => curie.startsWith('XPO:')));
  });
});
