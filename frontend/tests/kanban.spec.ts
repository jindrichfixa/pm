import { expect, test } from "@playwright/test";
import { initialData } from "../src/lib/kanban";

const useBackendApi = Boolean(process.env.E2E_BASE_URL);

const cloneInitialData = () => JSON.parse(JSON.stringify(initialData));

const resetBoard = async (page: import("@playwright/test").Page) => {
  if (!useBackendApi) {
    return;
  }

  // Login first to get a token for API calls
  const loginResp = await page.request.post("/api/auth/login", {
    data: { username: "user", password: "password" },
  });
  if (loginResp.ok()) {
    const { token } = await loginResp.json();
    const boards = await page.request.get("/api/boards", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const boardList = await boards.json();
    if (boardList.length > 0) {
      const response = await page.request.put(`/api/boards/${boardList[0].id}`, {
        data: cloneInitialData(),
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.ok()).toBeTruthy();
    }
  }
};

const dragCard = async (
  page: import("@playwright/test").Page,
  source: import("@playwright/test").Locator,
  target: import("@playwright/test").Locator
) => {
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
  await page.waitForTimeout(150);
  await page.mouse.up();
};

const login = async (page: import("@playwright/test").Page) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
  // After login, we should see the dashboard
  await expect(page.getByText(/your boards/i)).toBeVisible();
};

const loginAndOpenBoard = async (page: import("@playwright/test").Page) => {
  await login(page);
  // Click the first board to open it
  const boardCard = page.locator('[data-testid^="board-card-"]').first();
  await boardCard.click();
  // Wait for board columns to load
  await expect(page.locator('[data-testid^="column-"]').first()).toBeVisible();
};

test("loads the board dashboard after login", async ({ page }) => {
  await resetBoard(page);
  await login(page);
  await expect(page.getByText(/your boards/i)).toBeVisible();
});

test("opens a board from dashboard", async ({ page }) => {
  await resetBoard(page);
  await loginAndOpenBoard(page);
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  await resetBoard(page);
  await loginAndOpenBoard(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("moves a card between columns", async ({ page }) => {
  await resetBoard(page);
  await loginAndOpenBoard(page);
  const card = page.getByTestId("card-card-1");
  const dropTarget = page.getByTestId("column-col-review").getByTestId("card-card-6");

  await expect(card).toBeVisible();
  await expect(dropTarget).toBeVisible();

  await dragCard(page, card, dropTarget);

  const targetColumn = page.getByTestId("column-col-review");
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
});

test("rejects invalid login", async ({ page }) => {
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

test("navigates back from board to dashboard", async ({ page }) => {
  await resetBoard(page);
  await loginAndOpenBoard(page);
  await page.getByLabel(/back to boards/i).click();
  await expect(page.getByText(/your boards/i)).toBeVisible();
});

test("persists board changes after refresh", async ({ page }) => {
  await resetBoard(page);
  await loginAndOpenBoard(page);

  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Persistent card");
  await firstColumn.getByPlaceholder("Details").fill("Should survive refresh");

  if (useBackendApi) {
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/boards/") &&
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
    // After reload, need to re-open board from dashboard
    await expect(page.getByText(/your boards/i)).toBeVisible();
    const boardCard = page.locator('[data-testid^="board-card-"]').first();
    await boardCard.click();
    await expect(page.getByText("Persistent card")).toBeVisible();
  }
});

test("sends AI chat message and reflects board update", async ({ page }) => {
  await resetBoard(page);
  await loginAndOpenBoard(page);

  await page.route("**/api/boards/*/chat", async (route) => {
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

test("adds and removes a custom column", async ({ page }) => {
  await resetBoard(page);
  await loginAndOpenBoard(page);

  const initialColumns = await page.locator('[data-testid^="column-"]').count();
  expect(initialColumns).toBe(5);

  await page.getByLabel(/add column/i).click();
  expect(await page.locator('[data-testid^="column-"]').count()).toBe(6);

  // Delete the newly added column (last one)
  const deleteButtons = page.getByLabel(/delete column/i);
  const lastDelete = deleteButtons.last();
  await lastDelete.click();

  expect(await page.locator('[data-testid^="column-"]').count()).toBe(5);
});

test("moves a card to an empty column", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1200 });
  await resetBoard(page);
  await loginAndOpenBoard(page);

  const firstColumn = page.getByTestId("column-col-backlog");
  const secondColumn = page.getByTestId("column-col-discovery");

  await secondColumn.getByTestId("card-card-3").getByRole("button", { name: /delete/i }).click();
  await expect(secondColumn.getByTestId("empty-drop-col-discovery")).toBeVisible();

  await dragCard(
    page,
    firstColumn.getByTestId("card-card-1"),
    secondColumn
  );
  await expect(secondColumn.getByTestId("card-card-1")).toBeVisible();
});
