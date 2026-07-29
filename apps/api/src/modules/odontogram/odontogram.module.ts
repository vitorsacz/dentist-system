import { Module } from "@nestjs/common";
import { OdontogramController } from "./odontogram.controller";
import { OdontogramService } from "./odontogram.service";

@Module({
  controllers: [OdontogramController],
  providers: [OdontogramService],
})
export class OdontogramModule {}
