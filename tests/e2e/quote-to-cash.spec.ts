import { expect, test } from "@playwright/test";

test.describe("quote-to-cash controls", () => {
  test("protects sales, finance, and receivables behind login", async ({ page }) => {
    await page.goto("/sales");
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/finance");
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/receipts");
    await expect(page).toHaveURL(/\/login/);
  });

  test("health endpoint proves database availability for commercial workflows", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.database).toBe("reachable");
  });
});
