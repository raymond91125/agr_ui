import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import popper from 'cytoscape-popper';
import tippy from 'tippy.js';
import 'tippy.js/themes/light-border.css';

cytoscape.use(popper);
cytoscape.use(dagre);

function linkFromNode(nodeId) {
  return '/disease/' + nodeId;
}

function linkFromEdge(nodeObjId) {
  return '/disease/' + nodeObjId;
}

export const defaultLegendData = [
  { data: { id: 'legend', name: 'Legend' } },
  {
    data: {
      id: 'a',
      parent: 'legend',
      name: 'Term with inferred annotation',
      annotationDirectness: 'inferred',
    },
  },
  {
    data: {
      id: 'b',
      parent: 'legend',
      name: 'Term with direct annotation',
      annotationDirectness: 'direct',
    },
  },
  {
    data: {
      id: 'ab',
      parent: 'legend',
      name: 'direction of inference',
      source: 'a',
      target: 'b',
    },
    classes: 'autorotate',
  },
];

export function setupCytoscape(
  containerElement,
  data = [],
  { legendData = defaultLegendData, onReady, isWeighted, isLocked } = {}
) {
  const layout = {
    name: 'dagre',
    padding: 10,
    nodeSep: 15,
    edgeSep: 1,
    rankSep: 5,
    nodeDimensionsIncludeLabels: false,
  };

  const cyOntologyGraph = cytoscape({
    container: containerElement,
    layout: layout,
    userZoomingEnabled: !isLocked,
    selectionType: 'single',
    style: cytoscape
      .stylesheet()
      .selector('node')
      .css({
        content: 'data(name)',
        'background-color': (node) =>
          node.data('backgroundColor') && node.data('backgroundColor') !== 'white' ? '#acd' : '#fff',
        'background-opacity': 0.5,
        shape: 'data(nodeShape)',
        'border-style': 'solid',
        'border-width': (node) =>
          node.data(isWeighted ? 'borderWidthWeighted' : 'borderWidthUnweighted'),
        width: (node) =>
          node.data(isWeighted ? 'diameter_weighted' : 'diameter_unweighted'),
        height: (node) =>
          node.data(isWeighted ? 'diameter_weighted' : 'diameter_unweighted'),
        'text-valign': 'center',
        'text-wrap': 'wrap',
        'border-opacity': 0.3,
        'font-size': (node) =>
          node.data(isWeighted ? 'fontSizeWeighted' : 'fontSizeUnweighted'),
      })
      .selector('node[annotationDirectness = "direct"]')
      .css({ 'border-style': 'solid', 'border-color': 'red' })
      .selector('node[annotationDirectness = "inferred"]')
      .css({ 'border-style': 'dashed', 'border-color': 'blue' })
      .selector('edge')
      .css({
        'curve-style': 'straight',
        'target-arrow-shape': 'none',
        'source-arrow-shape': 'triangle',
        width: 2,
        'line-color': '#ddd',
        'target-arrow-color': '#ddd',
        'source-arrow-color': '#ddd',
      })
      .selector('.highlighted')
      .css({
        'background-color': '#61bffc',
        'line-color': '#61bffc',
        'target-arrow-color': '#61bffc',
        'transition-property': 'background-color, line-color, target-arrow-color',
        'transition-duration': '0.5s',
      })
      .selector('.faded')
      .css({ opacity: 0.25, 'text-opacity': 0 })
      .selector('#legend')
      .css({
        'text-valign': 'top',
        'text-halign': 'center',
        'font-weight': '500',
        'background-color': '#fff',
        'border-width': 2,
      })
      .selector('node[parent="legend"]')
      .css({
        'font-size': '0.9em',
        'text-halign': 'left',
        'text-max-width': '8em',
        'border-width': 2,
      })
      .selector('edge[parent="legend"]')
      .css({
        label: 'data(name)',
        'font-size': '0.9em',
        'text-halign': 'left',
        'text-valign': 'top',
        'text-margin-x': '-3em',
      }),
    elements: data.length ? [...defaultLegendData, ...legendData, ...data] : [],
    wheelSensitivity: 0.2,
  });

  const tippies = [];

  const makeTippy = function(ele, text) {
    const newTippy = tippy(ele.popperRef(), {
      content: () => {
        const div = document.createElement('div');
        div.innerHTML = text;
        return div;
      },
      trigger: 'manual',
      interactive: true,
      theme: 'light-border',
      boundary: containerElement,
      arrow: true,
      placement: 'bottom',
      hideOnClick: false,
      multiple: true,
      sticky: true,
    });
    tippies.push(newTippy);
    newTippy.show();
  };

  function cleanupTippies() {
    tippies.forEach((t) => t.destroy());
  }

  cyOntologyGraph.ready(function() {
    cyOntologyGraph.on('unselect', () => {
      cleanupTippies();
    });

    cyOntologyGraph.on('select', 'edge[parent != "legend"]', function(e) {
      const edge = e.target;
      const nodeId = edge.data('target');
      const nodeObj = cyOntologyGraph.getElementById(nodeId);
      const nodeObjId = nodeObj.data('objId');
      const nodeName = nodeObj.data('name');
      const linkout = linkFromEdge(nodeObjId);
      const qtipContent = linkout
        ? `Explore <a target="_blank" href="${linkout}">${nodeName}</a> graph`
        : 'No information';
      makeTippy(edge, qtipContent);
    });

    cyOntologyGraph.on('select', 'node[parent != "legend"][id != "legend"]', function(e) {
      const node = e.target;
      const neighborhood = node.neighborhood().add(node);
      cyOntologyGraph.elements().addClass('faded');
      neighborhood.removeClass('faded');

      const objId = node.data('objId');
      const nodeName = node.data('name');
      const annotCounts = node.data('annotCounts');
      const linkout = linkFromNode(objId);
      const qtipContent =
        `Annotation Count:<br/>${annotCounts}<br/><a target="_blank" href="${linkout}">${objId} - ${nodeName}</a>`;
      makeTippy(node, qtipContent);
    });

    cyOntologyGraph.on('tap', function(e) {
      if (e.target === cyOntologyGraph) {
        cyOntologyGraph.elements().removeClass('faded');
      }
    });

    onReady && onReady();
  });

  function handleExport(options = {}) {
    return new Promise((resolve) => {
      resolve(cyOntologyGraph.png({ full: true, bg: 'white', output: 'blob-promise', ...options }));
    }).catch(() =>
      handleExport({ ...options, scale: options.scale ? options.scale - 1 : 1 })
    );
  }

  function handleLock(isLocked) {
    cyOntologyGraph.userZoomingEnabled(!isLocked);
  }

  function handleCleanup() {
    cleanupTippies();
    cyOntologyGraph.destroy();
  }

  return { handleExport, handleLock, handleCleanup };
}
