import { Module } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { AuditController } from "./audit.controller";
import { AuditAccessGuard } from "./audit-access.guard";

@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditAccessGuard],
  exports: [AuditService],
})
export class AuditModule {}
