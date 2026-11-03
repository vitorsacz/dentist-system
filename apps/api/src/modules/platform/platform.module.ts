import { Module } from "@nestjs/common";
import { PlatformController } from "./platform.controller";
import { PlatformService } from "./platform.service";
import { PlatformStatsService } from "./platform-stats.service";
import { SessionsModule } from "../sessions/sessions.module";

@Module({
  imports: [SessionsModule],
  controllers: [PlatformController],
  providers: [PlatformService, PlatformStatsService],
})
export class PlatformModule {}
