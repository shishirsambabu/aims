import { expect, test } from "@playwright/test";

test.describe("receive-to-dispatch controls", () => {
  test("protects warehouse and cold-chain operations behind login", async ({ page }) => {
    await page.goto("/warehouse");
    await expect(page).toHaveURL(/\/login/);
  });

  test("cron reservation release rejects unauthorised browser access", async ({ request }) => {
    const response = await request.get("/api/sales-orders/release-expired");
    expect(response.status()).toBe(401);
  });
});
