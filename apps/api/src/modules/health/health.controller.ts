import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { ConfigService } from "@nestjs/config";
import { Public } from "../../common/decorators/public.decorator";
import type { Env } from "../../config/env.validation";

@Controller("health")
export class HealthController {
  constructor(private readonly config: ConfigService<Env, true>) {}

  // Health check do Render (e keep-alive) não pode tomar 429 — o Render
  // trataria como serviço fora do ar.
  @SkipThrottle()
  @Public()
  @Get()
  check() {
    return {
      status: "ok",
      appEnv: this.config.get("APP_ENV", { infer: true }),
      version: this.config.get("COMMIT_SHA", { infer: true }),
    };
  }
}
