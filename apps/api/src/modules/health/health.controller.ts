import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "../../common/decorators/public.decorator";

@Controller("health")
export class HealthController {
  // Health check do Render (e keep-alive) não pode tomar 429 — o Render
  // trataria como serviço fora do ar.
  @SkipThrottle()
  @Public()
  @Get()
  check() {
    return { status: "ok" };
  }
}
