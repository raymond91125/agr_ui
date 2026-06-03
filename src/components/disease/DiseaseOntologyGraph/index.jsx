import React from 'react';
import PropTypes from 'prop-types';
import useOntologyGraph from './useOntologyGraph';
import LoadingSpinner from '../../loadingSpinner.jsx';
import styles from './DiseaseOntologyGraph.module.scss';

const DiseaseOntologyGraph = ({ focusTermId }) => {
  const [state, dispatch, containerElement] = useOntologyGraph({ focusTermId });

  const { loading, error, data, meta, depthRestriction, isWeighted, isLocked, save, et } = state;

  const maxDepth = Math.max(depthRestriction, meta.fullDepth || 0);

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <button
          className={`btn btn-sm ${isLocked ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => dispatch({ type: 'set_lock_toggle' })}
          title="If unlocked, mouse scroll wheel allows zooming in on the graph."
        >
          {isLocked ? '🔒' : '🔓'} Scroll wheel zoom
        </button>
        <button
          className="btn btn-sm btn-outline-secondary"
          onClick={() => dispatch({ type: 'reset' })}
        >
          ↺ Reset
        </button>
        <div className={styles.spacer} />
        <button
          className="btn btn-sm btn-outline-secondary"
          disabled={save === 'pending'}
          onClick={() =>
            dispatch({ type: 'save_image_requested', payload: `Disease_soba_${focusTermId}.png` })
          }
        >
          {save === 'pending' ? <LoadingSpinner size="xs" /> : '⬇'} Save image
        </button>
      </div>

      <div className={styles.main}>
        <div className={`${styles.graphContainer} ${loading ? styles.graphContainerLoading : ''}`}>
          {error ? (
            <div className="alert alert-warning">Failed to load disease graph.</div>
          ) : (
            <div ref={containerElement} className={styles.cytoscapeElement} />
          )}
          {loading && (
            <div className={styles.loadingOverlay}>
              <LoadingSpinner />
            </div>
          )}
        </div>

        <div className={styles.sidebar}>
          <div className="mb-3">
            <div className="fw-bold mb-1">Node size</div>
            <div className="form-check">
              <input
                className="form-check-input"
                type="radio"
                id="weighted"
                checked={isWeighted}
                onChange={() => dispatch({ type: 'set_weighted', payload: true })}
              />
              <label className="form-check-label" htmlFor="weighted">Weighted</label>
            </div>
            <div className="form-check">
              <input
                className="form-check-input"
                type="radio"
                id="unweighted"
                checked={!isWeighted}
                onChange={() => dispatch({ type: 'set_weighted', payload: false })}
              />
              <label className="form-check-label" htmlFor="unweighted">Uniform</label>
            </div>
            <small className="text-muted">
              "Weighted" sets node size proportional to annotation count.
            </small>
          </div>

          {data.length > 0 && (
            <div className="mb-3">
              <label className="fw-bold mb-1" htmlFor="depthSelect">Graph depth</label>
              <select
                className="form-select form-select-sm"
                id="depthSelect"
                value={depthRestriction}
                onChange={(e) =>
                  dispatch({ type: 'set_max_depth', payload: Number(e.target.value) })
                }
              >
                {Array(maxDepth + 1)
                  .fill(0)
                  .map((_, i) => (
                    <option key={i} value={i} disabled={i > (meta.fullDepth || 0)}>
                      {i === 0 ? 'Maximum depth' : i}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="mb-3">
            <div className="fw-bold mb-1">Evidence type</div>
            <div className="form-check">
              <input
                className="form-check-input"
                type="radio"
                id="etAll"
                checked={et === 'all'}
                onChange={() => dispatch({ type: 'set_evidence_filter', payload: 'all' })}
              />
              <label className="form-check-label" htmlFor="etAll">Any evidence type</label>
            </div>
            <div className="form-check">
              <input
                className="form-check-input"
                type="radio"
                id="etExcludeIea"
                checked={et === 'excludeiea'}
                onChange={() => dispatch({ type: 'set_evidence_filter', payload: 'excludeiea' })}
              />
              <label className="form-check-label" htmlFor="etExcludeIea">Exclude IEA</label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

DiseaseOntologyGraph.propTypes = {
  focusTermId: PropTypes.string.isRequired,
};

export default DiseaseOntologyGraph;
