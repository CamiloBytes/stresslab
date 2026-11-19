export async function up(knex) {
  const hasProjects = await knex.schema.hasTable("projects");
  if (!hasProjects) {
    await knex.schema.createTable("projects", (table) => {
      table.string("id").primary();
      table.string("name").notNullable();
      table.string("environment").notNullable().defaultTo("staging");
      table.text("scope").nullable();
      table.string("createdAt").notNullable();
      table.string("updatedAt").notNullable();
    });
  }

  const hasScenarios = await knex.schema.hasTable("scenarios");
  if (hasScenarios) {
    const columns = await knex.schema.hasColumn("scenarios", "projectId");
    if (!columns) {
      await knex.schema.alterTable("scenarios", (table) => {
        table.string("projectId").nullable();
        table.index(["projectId"]);
      });
    }
  }

  const hasRuns = await knex.schema.hasTable("runs");
  if (hasRuns) {
    const columns = await knex.schema.hasColumn("runs", "projectId");
    if (!columns) {
      await knex.schema.alterTable("runs", (table) => {
        table.string("projectId").nullable();
        table.index(["projectId"]);
      });
    }
  }

  const hasAssessments = await knex.schema.hasTable("security_assessments");
  if (!hasAssessments) {
    await knex.schema.createTable("security_assessments", (table) => {
      table.string("id").primary();
      table.string("projectId").notNullable();
      table.string("name").notNullable();
      table.string("source").notNullable();
      table.string("targetUrl").notNullable();
      table.string("environment").notNullable();
      table.string("scopeKey").notNullable();
      table.string("reportFingerprint").notNullable();
      table.string("status").notNullable().defaultTo("imported");
      table.integer("findingCount").notNullable().defaultTo(0);
      table.text("severitySummary").nullable();
      table.string("aiError").nullable();
      table.string("createdAt").notNullable();
      table.string("analyzedAt").nullable();
      table.index(["projectId"]);
      table.index(["scopeKey"]);
      table.unique(["projectId", "reportFingerprint"]);
    });
  }

  const hasFindings = await knex.schema.hasTable("security_findings");
  if (!hasFindings) {
    await knex.schema.createTable("security_findings", (table) => {
      table.string("id").primary();
      table.string("assessmentId").notNullable();
      table.string("fingerprint").notNullable();
      table.string("ruleId").notNullable();
      table.string("title").notNullable();
      table.string("severity").notNullable();
      table.float("scannerConfidence").nullable();
      table.string("method").nullable();
      table.string("url").nullable();
      table.string("parameter").nullable();
      table.text("evidence").nullable();
      table.text("scannerSolution").nullable();
      table.text("reference").nullable();
      table.string("status").notNullable().defaultTo("pending");
      table.text("reviewNote").nullable();
      table.text("aiAnalysis").nullable();
      table.string("createdAt").notNullable();
      table.index(["assessmentId"]);
      table.index(["fingerprint"]);
    });
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("security_findings");
  await knex.schema.dropTableIfExists("security_assessments");
  await knex.schema.alterTable("runs", (table) => {
    table.dropColumnIfExists("projectId");
  });
  await knex.schema.alterTable("scenarios", (table) => {
    table.dropColumnIfExists("projectId");
  });
  await knex.schema.dropTableIfExists("projects");
}
