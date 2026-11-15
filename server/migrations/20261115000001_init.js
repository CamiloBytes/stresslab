export async function up(knex) {
  const hasScenarios = await knex.schema.hasTable("scenarios");
  if (!hasScenarios) {
    await knex.schema.createTable("scenarios", (table) => {
      table.string("id").primary();
      table.string("name").notNullable();
      table.string("type").notNullable();
      table.string("url").notNullable();
      table.string("method").notNullable();
      table.text("headers").notNullable();
      table.text("body").nullable();
      table.string("loadMode").notNullable();
      table.text("stages").notNullable();
      table.integer("arrivalRate").nullable();
      table.string("duration").nullable();
      table.integer("preAllocatedVUs").notNullable();
      table.integer("maxVUs").notNullable();
      table.float("thinkTime").notNullable();
      table.boolean("followRedirects").notNullable();
      table.boolean("insecureTls").notNullable();
      table.integer("expectedStatus").notNullable();
      table.text("thresholds").notNullable();
      table.string("createdAt").notNullable();
      table.string("updatedAt").notNullable();
    });
  }

  const hasRuns = await knex.schema.hasTable("runs");
  if (!hasRuns) {
    await knex.schema.createTable("runs", (table) => {
      table.string("id").primary();
      table.string("scenarioId").notNullable();
      table.string("scenarioName").notNullable();
      table.string("status").notNullable();
      table.string("startedAt").notNullable();
      table.string("endedAt").nullable();
      table.text("summary").nullable();
      table.text("error").nullable();
      table.index(["scenarioId"]);
      table.index(["startedAt"]);
    });
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("runs");
  await knex.schema.dropTableIfExists("scenarios");
}
