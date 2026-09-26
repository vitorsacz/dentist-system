import { Module } from "@nestjs/common";
import { RefreshSessionsService } from "./refresh-sessions.service";

// Compartilhado entre auth (login/refresh/logout) e users (desativar usuário
// revoga as sessões dele).
@Module({
  providers: [RefreshSessionsService],
  exports: [RefreshSessionsService],
})
export class SessionsModule {}
