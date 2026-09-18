import { Global, Injectable, Module, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PRISMA_SERVICE, PRISMA_UNSCOPED_SERVICE, prismaBaseClient, prismaTenantScopedClient } from "./prisma.service";

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
  providers: [
    PrismaLifecycle,
    { provide: PRISMA_SERVICE, useValue: prismaTenantScopedClient },
    { provide: PRISMA_UNSCOPED_SERVICE, useValue: prismaBaseClient },
  ],
  exports: [PRISMA_SERVICE, PRISMA_UNSCOPED_SERVICE],
})
export class PrismaModule {}
