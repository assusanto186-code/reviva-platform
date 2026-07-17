import type { TenantContext } from "@reviva/domain";
import type { Sql } from "postgres";
import { InvalidTenantContextError } from "./errors.js";
import { PostgresAuditRepository,PostgresKnowledgeRepository,PostgresTenantRepository,type SessionState } from "./repositories.js";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validate(c:TenantContext) {
  if(!uuid.test(c.tenantId)||!uuid.test(c.actorId)||!uuid.test(c.requestId)) throw new InvalidTenantContextError("Tenant, actor, and request IDs must be UUIDs.");
  if(!["owner","admin","manager","agent","viewer"].includes(c.actorRole)) throw new InvalidTenantContextError("Actor role is invalid.");
}
export type PostgresTransactionSession={tenants:PostgresTenantRepository;knowledge:PostgresKnowledgeRepository;audit:PostgresAuditRepository};
export class PostgresTransactionCoordinator {
  constructor(private readonly client:Sql,private readonly options:{assumeRuntimeRole?:boolean}={}){}
  async run<T>(context:TenantContext,work:(session:PostgresTransactionSession)=>Promise<T>):Promise<T>{
    validate(context);
    return await this.client.begin(async tx=>{
      if(this.options.assumeRuntimeRole) await tx`set local role reviva_app`;
      try { await tx`select reviva_private.set_tenant_context(${context.tenantId}::uuid,${context.actorId}::uuid,${context.actorRole}::text,${context.requestId}::uuid)`; }
      catch(error){ throw new InvalidTenantContextError(error instanceof Error?error.message:undefined); }
      const state:SessionState={active:true};
      const session={tenants:new PostgresTenantRepository(tx,context,state),knowledge:new PostgresKnowledgeRepository(tx,context,state),audit:new PostgresAuditRepository(tx,context,state)};
      try{return await work(session);}finally{state.active=false;}
    }) as T;
  }
}
