// File: backend/migrations/20261115000001_graph_layouts.js
//
// Saved graph layouts (graph plan, phase 3): where someone placed the
// entities of a graph, per user (Roy's decision), project and view. A view is
// "project" (the whole project) or "focus:<type>:<id>" (the graph around one
// entity). Positions are { "<node id>": { x, y } }; nodes not in the saved
// layout (added since) are placed next to a neighbour.
//
// Goes with its user and its project (ON DELETE CASCADE).

exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS graph_layouts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      view VARCHAR(100) NOT NULL,
      positions JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT graph_layouts_unique UNIQUE (user_id, project_id, view)
    );
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS graph_layouts');
};
