import { expect, test } from "@playwright/test";

async function openEditor(page: import("@playwright/test").Page) {
  await page.goto("/floorplanner/test-workspace");
  const essentialCookies = page.getByRole("button", { name: "Essential only" });
  const startButton = page.getByRole("button", { name: "Start Editing" });
  const projectButton = page.getByRole("button", { name: "Project" });
  await expect.poll(async () => (
    await essentialCookies.isVisible() || await startButton.isVisible() || await projectButton.isVisible()
  ), {
    timeout: 15_000,
  }).toBe(true);
  if (await essentialCookies.isVisible()) await essentialCookies.click();
  await expect.poll(async () => await startButton.isVisible() || await projectButton.isVisible(), {
    timeout: 15_000,
  }).toBe(true);
  if (await startButton.isVisible()) await startButton.click();
  await expect(projectButton).toBeVisible();
}

test("floor planner project and vendor workflows stay understandable", async ({ page }) => {
  await openEditor(page);

  await expect(page.getByText("Autosaved locally")).toBeVisible();
  await page.getByRole("button", { name: "Project" }).click();
  await page.getByRole("menuitem", { name: /^Browser saves/ }).click();

  const projects = page.getByRole("dialog", { name: "Projects" });
  await expect(projects.getByText("Your work saves in this browser automatically.")).toBeVisible();
  await expect(projects.getByRole("button", { name: "This device" })).toBeVisible();
  await expect(projects.getByRole("button", { name: "Cloud sync" })).toBeVisible();
  await projects.getByRole("button", { name: "Close projects" }).click();

  await page.getByRole("button", { name: "Vendors" }).click();
  await page.getByRole("textbox", { name: "Vendor name" }).fill("River City Cards");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByText("River City Cards", { exact: true }).click();

  await expect(page.getByText("Assigning: River City Cards")).toBeVisible();
  await expect(page.getByRole("button", { name: "Assign to 0 selected" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Auto-assign open booths" })).toBeVisible();
});

test("floor planner tools become a dismissible drawer on narrow screens", async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await openEditor(page);

  const toolsButton = page.getByRole("button", { name: "Open floor planner tools" });
  await expect(toolsButton).toBeVisible();
  await expect(page.getByRole("complementary")).toBeHidden();

  await toolsButton.click();
  await expect(page.getByRole("complementary")).toBeVisible();
  await expect(page.getByText("Editor tools")).toBeVisible();

  await page.getByRole("button", { name: "Close editor tools" }).last().click();
  await expect(page.getByRole("complementary")).toBeHidden();
});
