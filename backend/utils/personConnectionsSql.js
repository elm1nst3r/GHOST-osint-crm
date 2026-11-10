// The SQL that gives a person row its connections (#83, #112), shared by the
// people routes and Advanced Search so both show the same thing.
//
// `connections`: the ones this person made (relationships rows sourced at
// them). `incoming_connections`: the ones other people made to them, with
// those people's names, limited to people the viewer may see: admins
// everyone, others the people in their projects. `viewerParam` is the $n
// holding the viewer's user id, or null for an admin.
const connectionsSql = (alias) => `
  (SELECT COALESCE(
     jsonb_agg(jsonb_build_object('person_id', r.target_id, 'type', r.relationship_type, 'note', r.note) ORDER BY r.id),
     '[]'::jsonb
   ) FROM relationships r WHERE r.source_type = 'person' AND r.source_id = ${alias}.id AND r.target_type = 'person') AS connections`;

const incomingConnectionsSql = (alias, viewerParam) => `
  (SELECT COALESCE(
     jsonb_agg(jsonb_build_object(
       'person_id', r.source_id, 'type', r.relationship_type, 'note', r.note,
       'first_name', src.first_name, 'patronymic', src.patronymic, 'last_name', src.last_name,
       'project_id', src.project_id) ORDER BY r.id),
     '[]'::jsonb)
   FROM relationships r JOIN people src ON src.id = r.source_id
   WHERE r.source_type = 'person' AND r.target_type = 'person' AND r.target_id = ${alias}.id
     ${viewerParam ? `AND src.project_id IN (SELECT project_id FROM project_members WHERE user_id = ${viewerParam})` : ''}
  ) AS incoming_connections`;

const isAdmin = (req) => req.session?.userRole === 'admin';

module.exports = { connectionsSql, incomingConnectionsSql, isAdmin };
