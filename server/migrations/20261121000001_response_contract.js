export async function up(knex) {
  await knex.schema.alterTable('security_assessments', table => table.text('responseContract').nullable());
}
export async function down(knex) {
  await knex.schema.alterTable('security_assessments', table => table.dropColumn('responseContract'));
}
