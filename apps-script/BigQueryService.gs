function fetchBigQueryAgents_(context,payload){
  requireRole_(context,['ADMIN']);
  var project=requiredProperty_('BIGQUERY_PROJECT_ID');
  var table=requiredProperty_('BIGQUERY_AGENT_TABLE');
  if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/.test(table))throw new Error('BIGQUERY_AGENT_TABLE must be project.dataset.table.');
  var limit=Math.max(1,Math.min(5000,Number(payload.limit)||500));
  var updatedAfter=String(payload.updatedAfter||'');
  var where=updatedAfter?' WHERE updated_at > @updatedAfter':'';
  var sql='SELECT CAST(employee_id AS STRING) employeeId, executive_name name, email, CAST(doj AS STRING) doj, manager, source, status, CAST(updated_at AS STRING) updatedAt FROM `'+table+'`'+where+' ORDER BY updated_at LIMIT '+limit;
  var request={query:sql,useLegacySql:false,location:String(PropertiesService.getScriptProperties().getProperty('BIGQUERY_LOCATION')||'US')};
  if(updatedAfter)request.queryParameters=[{name:'updatedAfter',parameterType:{type:'TIMESTAMP'},parameterValue:{value:updatedAfter}}];
  var started=now_();var jobId=id_();var jobRepo=new SheetRepository_('bigQueryJobs');
  try{
    var result=BigQuery.Jobs.query(request,project);
    while(!result.jobComplete){Utilities.sleep(500);result=BigQuery.Jobs.getQueryResults(project,result.jobReference.jobId,{location:request.location});}
    var fields=(result.schema&&result.schema.fields)||[];
    var rows=(result.rows||[]).map(function(row){var item={};fields.forEach(function(field,index){item[field.name]=row.f[index].v;});return item;});
    jobRepo.insertMany([{id:jobId,jobType:'AGENT_FETCH',queryHash:Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,sql)).slice(0,24),status:'SUCCESS',rowCount:rows.length,error:'',startedAt:started,completedAt:now_(),createdBy:context.email}]);
    if(payload.persist!==false&&rows.length){var fetchedAt=now_();new SheetRepository_('bigQueryAgentDump').insertMany(rows.map(function(row){return{id:id_(),syncId:jobId,employeeId:row.employeeId,name:row.name,email:row.email,doj:row.doj,manager:row.manager,source:row.source,status:row.status,updatedAt:row.updatedAt,fetchedAt:fetchedAt};}));}
    audit_(context,'bigQueryAgentDump','BigQuery','FETCH','',null,{jobId:jobId,rowCount:rows.length},'BigQuery agent fetch and raw dump',1);
    return{rows:rows,count:rows.length,syncId:jobId};
  }catch(error){
    jobRepo.insertMany([{id:jobId,jobType:'AGENT_FETCH',queryHash:'',status:'FAILED',rowCount:0,error:String(error.message||error),startedAt:started,completedAt:now_(),createdBy:context.email}]);
    audit_(context,'bigQueryJobs','BigQuery','FETCH_FAILED',jobId,null,{error:String(error.message||error)},'BigQuery agent fetch failed',1);
    throw error;
  }
}
function importBigQueryAgents_(context,payload){
  var request=Object.assign({},payload,{persist:false});var fetched=fetchBigQueryAgents_(context,request);
  return withWriteLock_(function(){var repo=new SheetRepository_('executives');var rows=repo.all();var byEmployee={};rows.forEach(function(row,index){byEmployee[String(row.employeeId).toUpperCase()]=index;});var stamp=now_();fetched.rows.forEach(function(input){validateAgent_(input);var key=String(input.employeeId).toUpperCase();var existing=byEmployee[key]>=0?rows[byEmployee[key]]:null;var record={id:existing?existing.id:id_(),employeeId:String(input.employeeId),name:String(input.name),email:normalizeEmail_(input.email),doj:String(input.doj).slice(0,10),status:String(input.status||'ACTIVE').toUpperCase(),manager:String(input.manager),source:String(input.source),tenurity:calculateTenurity_(input.doj),active:String(input.status||'ACTIVE').toUpperCase()==='ACTIVE',createdAt:existing?existing.createdAt:stamp,updatedAt:stamp};if(existing)rows[byEmployee[key]]=record;else{byEmployee[key]=rows.length;rows.push(record);}});repo.replaceAll(rows);audit_(context,'executives','BigQuery','BULK_UPSERT','',null,{rowCount:fetched.rows.length},'BigQuery agent synchronization',1);return{imported:fetched.rows.length,total:rows.length};});
}
