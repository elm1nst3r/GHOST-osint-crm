// Cytoscape with the extensions the graph uses, registered once (graph plan).
// Imported only by the graph components, so all of it sits in their lazy chunk.
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import dagre from 'cytoscape-dagre';
import edgehandles from 'cytoscape-edgehandles';

cytoscape.use(fcose);
cytoscape.use(dagre);
cytoscape.use(edgehandles);

export default cytoscape;
