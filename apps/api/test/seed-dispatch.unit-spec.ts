import { chooseSeed } from "../prisma/seed-dispatch";

describe("chooseSeed", () => {
  it("APP_ENV=prod → bootstrap (nunca bloqueia seed legítimo)", () => {
    expect(chooseSeed("prod")).toBe("bootstrap");
  });

  it("APP_ENV=dev → bootstrap", () => {
    expect(chooseSeed("dev")).toBe("bootstrap");
  });

  it("APP_ENV=hml → hml (personas fictícias)", () => {
    expect(chooseSeed("hml")).toBe("hml");
  });
});
