export async function up(db){
  await db.schema.alterTable('api_contracts',t=>{t.string('stressResult',12).nullable();t.string('securityResult',12).nullable();});
}
export async function down(db){await db.schema.alterTable('api_contracts',t=>{t.dropColumns('stressResult','securityResult');});}
