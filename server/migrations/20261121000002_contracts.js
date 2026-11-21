export async function up(db) {
  await db.schema.createTable('api_contracts', t => {
    t.increments('version'); t.string('projectId').notNullable(); t.string('routeKey',64).notNullable();
    t.text('definition').notNullable(); t.index(['projectId','routeKey','version']);
  });
  await db.schema.alterTable('runs',t=>t.text('aiAnalysis').nullable());
}
export async function down(db) {
  await db.schema.alterTable('runs',t=>t.dropColumn('aiAnalysis'));
  await db.schema.dropTable('api_contracts');
}
