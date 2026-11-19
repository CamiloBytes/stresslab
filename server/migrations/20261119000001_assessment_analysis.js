export async function up(knex) {
  if (!(await knex.schema.hasColumn("security_assessments", "aiAnalysis"))) {
    await knex.schema.alterTable("security_assessments", t => t.text("aiAnalysis").nullable());
  }
}

export async function down(knex) {
  await knex.schema.alterTable("security_assessments", t => t.dropColumn("aiAnalysis"));
}
