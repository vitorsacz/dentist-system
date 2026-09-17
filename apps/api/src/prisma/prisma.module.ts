import { Global, Injectable, Module, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PRISMA_SERVICE, prismaBaseClient, prismaTenantScopedClient } from "./prisma.service";

@Injectable()
class PrismaLifecycle implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await prismaBaseClient.$connect();
  }

  async onModuleDestroy() {
    await prismaBaseClient.$disconnect();
  }
}

@Global()
@Module({
  providers: [PrismaLifecycle, { provide: PRISMA_SERVICE, useValue: prismaTenantScopedClient }],
  exports: [PRISMA_SERVICE],
})
export class PrismaModule {}
