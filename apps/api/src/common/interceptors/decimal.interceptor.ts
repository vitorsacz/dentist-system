import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { map, type Observable } from "rxjs";

// Prisma serializa campos Decimal como string no JSON (Decimal.toJSON() retorna string).
// Sem isso, todo valor monetário chega como string no front e quebra qualquer .toFixed()/conta.
function toPlain(value: unknown): unknown {
  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }
  if (Array.isArray(value)) {
    return value.map(toPlain);
  }
  if (value instanceof Date) {
    return value;
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = toPlain(val);
    }
    return result;
  }
  return value;
}

@Injectable()
export class DecimalInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => toPlain(data)));
  }
}
