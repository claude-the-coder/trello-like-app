import { test, expect, type Page } from "@playwright/test";

// Unique suffix to avoid collisions between test runs
const suffix = Date.now().toString(36);

/**
 * Perform a drag-and-drop using pointer events compatible with @dnd-kit's PointerSensor.
 * The sensor has a 5px activation distance, so we move slowly past it.
 */
async function dndKitDrag(page: Page, sourceLocator: ReturnType<Page["locator"]>, targetLocator: ReturnType<Page["locator"]>) {
  const sourceBox = await sourceLocator.boundingBox();
  const targetBox = await targetLocator.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("Missing bounding box");

  const sx = sourceBox.x + sourceBox.width / 2;
  const sy = sourceBox.y + sourceBox.height / 2;
  const tx = targetBox.x + targetBox.width / 2;
  const ty = targetBox.y + targetBox.height / 2;

  // Hover over source
  await page.mouse.move(sx, sy);
  await page.waitForTimeout(100);

  // Press down
  await page.mouse.down();
  await page.waitForTimeout(100);

  // Slowly move past the 5px activation threshold
  for (let i = 1; i <= 5; i++) {
    await page.mouse.move(sx + i * 2, sy, { steps: 1 });
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(200);

  // Move to target in gradual steps
  const steps = 15;
  for (let i = 1; i <= steps; i++) {
    const cx = sx + 10 + ((tx - sx - 10) * i) / steps;
    const cy = sy + ((ty - sy) * i) / steps;
    await page.mouse.move(cx, cy, { steps: 1 });
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(200);

  // Release
  await page.mouse.up();
  await page.waitForTimeout(300);
}

test("full happy path: create project, board, task, drag to another lane, verify persistence", async ({
  page,
}) => {
  const projectName = `E2E Project ${suffix}`;
  const boardName = `E2E Board ${suffix}`;
  const taskTitle = `E2E Task ${suffix}`;

  // 1. Navigate to home page
  await page.goto("/");
  await expect(page.locator(".page-title")).toContainText("Projects");

  // 2. Create a new project
  await page.getByRole("button", { name: "+ New Project" }).click();
  await page.getByPlaceholder("Project name").fill(projectName);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText(projectName)).toBeVisible();

  // 3. Create a board inside the project
  const projectCard = page.locator(".glass-card", { hasText: projectName });
  await projectCard.getByRole("button", { name: "+ New Board" }).click();
  await projectCard.getByPlaceholder("Board name").fill(boardName);
  await projectCard.getByRole("button", { name: "Add" }).click();
  await expect(projectCard.getByText(boardName)).toBeVisible();

  // 4. Navigate to the board
  await projectCard.getByRole("button", { name: new RegExp(boardName) }).click();
  await expect(page.locator(".page-title")).toContainText(boardName);

  // Verify default lanes exist
  await expect(page.getByText("TODO", { exact: false })).toBeVisible();
  await expect(page.getByText("DEVELOPING", { exact: false })).toBeVisible();

  // 5. Create a task in the "Todo" lane
  const lanes = page.locator(".lane");
  const todoLane = lanes.first();
  await todoLane.getByRole("button", { name: "+ Add task" }).click();
  await todoLane.getByPlaceholder("Task title").fill(taskTitle);
  await todoLane.getByRole("button", { name: "Add Task" }).click();

  // Wait for task card to appear in Todo lane
  await expect(todoLane.getByText(taskTitle)).toBeVisible();

  // 6. Drag the task to the "Developing" lane (3rd lane, index 2)
  const taskCard = todoLane.locator(".glass-card.glass-card--interactive", {
    hasText: taskTitle,
  });
  const developingLane = lanes.nth(2);
  const dropTarget = developingLane.locator(".lane-content");

  // Wait for the move API call to complete after the drag
  const movePromise = page.waitForResponse(
    (resp) => resp.url().includes("/move") && resp.request().method() === "PATCH",
    { timeout: 10000 }
  );

  await dndKitDrag(page, taskCard, dropTarget);

  // Verify the task appeared in the Developing lane (optimistic update)
  await expect(
    developingLane.locator(".glass-card--interactive", { hasText: taskTitle })
  ).toBeVisible({ timeout: 5000 });

  // Wait for the move API to complete
  const moveResp = await movePromise;
  expect(moveResp.status()).toBeLessThan(400);

  // 7. Reload the page
  await page.reload();

  // 8. Verify the task is still in the "Developing" lane
  const developingLaneAfterReload = page.locator(".lane").nth(2);
  await expect(
    developingLaneAfterReload.locator(".glass-card--interactive", {
      hasText: taskTitle,
    })
  ).toBeVisible({ timeout: 10000 });

  // Verify it's NOT in the Todo lane anymore
  const todoLaneAfterReload = page.locator(".lane").first();
  await expect(
    todoLaneAfterReload.locator(".glass-card--interactive", {
      hasText: taskTitle,
    })
  ).not.toBeVisible();
});
