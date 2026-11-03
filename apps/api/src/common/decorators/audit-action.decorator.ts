import { SetMetadata } from "@nestjs/common";

export const AUDIT_ACTION_KEY = "audit:action";

export interface AuditActionMeta {
  action: string;
  entity?: string;
}

// Marca um endpoint para registro automático via AuditInterceptor.
// Só loga ações bem-sucedidas (status < 400). Não captura before/after —
// para isso o serviço deve chamar AuditService.log() diretamente.
export const AuditAction = (action: string, entity?: string) =>
  SetMetadata<string, AuditActionMeta>(AUDIT_ACTION_KEY, { action, entity });
