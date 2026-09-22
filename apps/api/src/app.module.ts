import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { validateEnv } from "./config/env.validation";
import { PrismaModule } from "./prisma/prisma.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { DecimalInterceptor } from "./common/interceptors/decimal.interceptor";
import { TenantContextInterceptor } from "./common/interceptors/tenant-context.interceptor";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { OrganizationModule } from "./modules/organization/organization.module";
import { PlatformModule } from "./modules/platform/platform.module";
import { PatientsModule } from "./modules/patients/patients.module";
import { AnamnesisModule } from "./modules/anamnesis/anamnesis.module";
import { ClinicalRecordsModule } from "./modules/clinical-records/clinical-records.module";
import { ClinicsModule } from "./modules/clinics/clinics.module";
import { ClinicFinancialTermsModule } from "./modules/clinic-financial-terms/clinic-financial-terms.module";
import { ProceduresModule } from "./modules/procedures/procedures.module";
import { BudgetsModule } from "./modules/budgets/budgets.module";
import { AppointmentsModule } from "./modules/appointments/appointments.module";
import { AttendancesModule } from "./modules/attendances/attendances.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { MaterialsModule } from "./modules/materials/materials.module";
import { OdontogramModule } from "./modules/odontogram/odontogram.module";
import { RecallsModule } from "./modules/recalls/recalls.module";
import { HealthController } from "./modules/health/health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    OrganizationModule,
    PlatformModule,
    PatientsModule,
    AnamnesisModule,
    ClinicalRecordsModule,
    ClinicsModule,
    ClinicFinancialTermsModule,
    ProceduresModule,
    BudgetsModule,
    AppointmentsModule,
    AttendancesModule,
    ReportsModule,
    MaterialsModule,
    OdontogramModule,
    RecallsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: DecimalInterceptor,
    },
  ],
})
export class AppModule {}
