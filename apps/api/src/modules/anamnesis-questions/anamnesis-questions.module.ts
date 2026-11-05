import { Module } from "@nestjs/common";
import { AnamnesisQuestionsController } from "./anamnesis-questions.controller";
import { AnamnesisQuestionsService } from "./anamnesis-questions.service";

@Module({
  controllers: [AnamnesisQuestionsController],
  providers: [AnamnesisQuestionsService],
})
export class AnamnesisQuestionsModule {}
