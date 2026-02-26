import { expect, test } from "@playwright/test";
import { initialData } from "../src/lib/kanban";

const useBackendApi = Boolean(process.env.E2E_BASE_URL);

// Note: E2E tests use a local clone rather than the shared test helper
// because Playwright tests don't use vitest's path aliasing.
const cloneInitialData = () => JSON.parse(JSON.stringify(initialData));

const resetBoard = async (page: import("@playwright/test").Page) => {
  if (!useBackendApi) {
    return;
  }

  const response = await page.request.put("/api/board", {
    data: cloneInitialData(),
  });
  expect(response.ok()).toBeTruthy();
};

const dragCard = async (
  page: import("@playwright/test").Page,
  source: import("@playwright/test").Locator,
  target: import("@playwright/test").Locator
) => {
  // Scroll source into view so mouse coordinates are within the viewport
  await source.scrollIntoViewIfNeeded();
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 20 }
  );
  // Brief pause lets dnd-kit process collision detection before drop
  await page.waitForTimeout(150);
  await page.mouse.up();
};

const login = async (page: import("@playwright/test").Page) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
};

test("loads the kanban board", async ({ page }) => {
  await resetBoard(page);
  await login(page);
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  await resetBoard(page);
  await login(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("moves a card between columns", async ({ page }) => {
  await resetBoard(page);
  await login(page);
  const card = page.getByTestId("card-card-1");
  const dropTarget = page.getByTestId("column-col-review").getByTestId("card-card-6");

  await expect(card).toBeVisible();
  await expect(dropTarget).toBeVisible();

  await dragCard(page, card, dropTarget);

  const targetColumn = page.getByTestId("column-col-review");
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
});

test("rejects invalid login", async ({ page }) => {
  await resetBoard(page);
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page.getByText(/invalid credentials/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
});

test("logs out back to login", async ({ page }) => {
  await resetBoard(page);
  await login(page);
  await page.getByRole("button", { name: /log out/i }).click();
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
});

test("persists board changes after refresh", async ({ page }) => {
  await resetBoard(page);
  await login(page);

  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Persistent card");
  await firstColumn.getByPlaceholder("Details").fill("Should survive refresh");
  if (useBackendApi) {
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/board") &&
          response.request().method() === "PUT" &&
          response.status() === 200
      ),
      firstColumn.getByRole("button", { name: /add card/i }).click(),
    ]);
  } else {
    await firstColumn.getByRole("button", { name: /add card/i }).click();
  }

  await expect(firstColumn.getByText("Persistent card")).toBeVisible();

  if (useBackendApi) {
    await page.reload();
    await expect(page.getByRole("heading", { name: /kanban studio/i })).toBeVisible();
    await expect(page.getByText("Persistent card")).toBeVisible();
  }
});

test("sends AI chat message and reflects board update", async ({ page }) => {
  await resetBoard(page);
  await login(page);

  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        assistant_message: "Moved one card to review",
        board_update: {
          columns: [
            { id: "col-backlog", title: "Backlog", cardIds: ["card-2"] },
            { id: "col-discovery", title: "Discovery", cardIds: ["card-3"] },
            { id: "col-progress", title: "In Progress", cardIds: ["card-4", "card-5"] },
            { id: "col-review", title: "Review", cardIds: ["card-6", "card-1"] },
            { id: "col-done", title: "Done", cardIds: ["card-7", "card-8"] },
          ],
          cards: cloneInitialData().cards,
        },
      }),
    });
  });

  await page.getByLabel("AI message").fill("Move one card to review");
  await page.getByRole("button", { name: /^send$/i }).click();

  await expect(page.getByText("Moved one card to review")).toBeVisible();
  await expect(page.getByTestId("column-col-review").getByTestId("card-card-1")).toBeVisible();
});

test("moves a card to an empty column", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1200 });
  await resetBoard(page);
  await login(page);

  const firstColumn = page.getByTestId("column-col-backlog");
  const secondColumn = page.getByTestId("column-col-discovery");

  // Remove the only card in Discovery to make it empty
  await secondColumn.getByTestId("card-card-3").getByRole("button", { name: /delete/i }).click();
  await expect(secondColumn.getByTestId("empty-drop-col-discovery")).toBeVisible();

  // Drop a card into the now-empty column by targeting the column section
  await dragCard(
    page,
    firstColumn.getByTestId("card-card-1"),
    secondColumn
  );
  await expect(secondColumn.getByTestId("card-card-1")).toBeVisible();
});
