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

  await expect(page.getByText("Saved on this device", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open shows", exact: true }).click();

  const projects = page.getByRole("dialog", { name: "Open shows" });
  await expect(projects.getByRole("textbox", { name: "Search saved shows" })).toBeVisible();
  await expect(projects.getByText("Device copies stay in this browser. Cloud autosave keeps account shows available on your other devices.")).toBeVisible();
  await projects.getByRole("button", { name: "Close saved shows" }).click();

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


test("navigation switches cleanly between moving the view and placing tables", async ({ page }) => {
  await openEditor(page);
  const navigation = page.getByRole("toolbar", { name: "Canvas navigation" });
  await expect(navigation).toBeVisible();
  await navigation.getByRole("button", { name: "Hand", exact: true }).click();
  await expect(navigation.getByRole("button", { name: "Hand", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^Add table/ }).click();
  await expect(navigation.getByRole("button", { name: "Hand", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("Click the floor to add a table. Esc when finished.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(navigation.getByRole("button", { name: "Select", exact: true })).toHaveAttribute("aria-pressed", "true");
  const initialZoom = await page.getByTestId("canvas-zoom").textContent();
  await navigation.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.getByTestId("canvas-zoom")).not.toHaveText(initialZoom!);
  await navigation.getByRole("button", { name: "Fit room", exact: true }).click();
  await page.keyboard.press("h");
  await expect(navigation.getByRole("button", { name: "Hand", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(navigation.getByRole("button", { name: "Hand", exact: true })).toHaveAttribute("aria-pressed", "false");
});


test("vertical rows place the requested count and measurements survive reload", async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: /^Add row/ }).click();
  await page.getByRole('spinbutton', { name: 'Tables', exact: true }).fill('10');
  await page.getByRole('combobox', { name: 'Orientation', exact: true }).selectOption('vertical');
  const canvas = page.locator('.konvajs-content');
  await canvas.click({ position: { x: 400, y: 200 } });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: /Download backup/ }).click();
  const download = await downloadPromise;
  const { readFile } = await import('node:fs/promises');
  const payload = JSON.parse(await readFile((await download.path())!, 'utf8'));
  const tables = Object.values(payload.data.tables) as Array<{ x: number; y: number; displayId: string }>;
  expect(tables).toHaveLength(10);
  expect(new Set(tables.map(table => table.x)).size).toBe(1);
  expect(new Set(tables.map(table => table.y)).size).toBe(10);
  expect(tables.every(table => /^\d+$/.test(table.displayId))).toBe(true);
  await page.getByRole('button', { name: /^Measure/ }).click();
  await page.getByRole('spinbutton', { name: /Exact distance/ }).fill('20');
  await canvas.click({ position: { x: 200, y: 250 } });
  await canvas.click({ position: { x: 200, y: 450 } });
  await expect(page.getByText('Mark 1: 20′', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByText('Mark 1: 20′', { exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByText('Mark 1: 20′', { exact: true })).toBeVisible();
  // Wait for the debounced local save before navigating.
  await expect(page.getByText('Saving...', { exact: true })).toBeHidden();
  await page.reload();
  const start = page.getByRole('button', { name: 'Start Editing' });
  await start.click();
  await page.getByRole('button', { name: /^Measure/ }).click();
  await expect(page.getByText('Mark 1: 20′', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fit room', exact: true }).click();
  await page.screenshot({ path: 'test-results/floorplanner-measurements.png' });
  await page.getByRole('button', { name: 'Print & share', exact: true }).click();
  const imageDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PNG' }).click();
  await (await imageDownload).saveAs('test-results/floorplanner-measurements-export.png');
  await page.getByRole('button', { name: 'Close print and share' }).click();
  await page.getByRole('button', { name: 'Remove measurement 1' }).click();
  await expect(page.getByText('Mark 1: 20′', { exact: true })).toBeHidden();
});


test('a vertical row near the bottom wall shifts to fit without losing tables', async ({ page }) => {
  const { DEFAULT_SETTINGS } = await import('../apps/web/floorplanner/lib/defaults');
  await page.addInitScript((settings) => {
    localStorage.setItem('floorplanner:e2e-floorplanner:layout', JSON.stringify({ version: 1, savedAt: new Date().toISOString(), data: {
      tables: {}, rows: {}, sections: {}, vendors: {}, vendorAssignments: {}, doors: {}, backgroundImages: {},
      settings, room: { segments: [{ id: 'hall', x: 0, y: 0, width: 1200, height: 1200 }], circles: [], freehandVertices: null },
    } }));
  }, DEFAULT_SETTINGS);
  await openEditor(page);
  await page.getByRole('button', { name: /^Add row/ }).click();
  await page.getByRole('spinbutton', { name: 'Tables', exact: true }).fill('10');
  await page.getByRole('combobox', { name: 'Orientation', exact: true }).selectOption('vertical');
  await page.locator('.konvajs-content').click({ position: { x: 400, y: 450 } });
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: /Download backup/ }).click();
  const { readFile } = await import('node:fs/promises');
  const payload = JSON.parse(await readFile((await (await downloaded).path())!, 'utf8'));
  const tables = Object.values(payload.data.tables) as Array<{ y: number; height: number }>;
  expect(tables).toHaveLength(10);
  expect(Math.min(...tables.map(table => table.y))).toBeGreaterThanOrEqual(39);
  expect(Math.max(...tables.map(table => table.y + table.height))).toBeLessThanOrEqual(1161);
});


test('Save updates one show and New show preserves the previous plan', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('textbox', { name: 'Floor plan title' }).fill('Saturday Show');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Open shows', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Open shows' });
  await expect(dialog.getByText('Saturday Show', { exact: true })).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Close saved shows' }).click();
  await page.getByRole('button', { name: /^Add table/ }).click();
  await page.locator('.konvajs-content').click({ position: { x: 400, y: 250 } });
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: /^New show/ }).click();
  await expect(page.getByRole('textbox', { name: 'Floor plan title' })).toHaveValue('Untitled show');
  await page.getByRole('textbox', { name: 'Floor plan title' }).fill('Sunday Show');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Open shows', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Search saved shows' }).fill('Saturday');
  await expect(dialog.getByText(/1 table/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Open Saturday Show from device' }).click();
  await expect(page.getByRole('textbox', { name: 'Floor plan title' })).toHaveValue('Saturday Show');
  await page.getByRole('button', { name: 'Open shows', exact: true }).click();
  await expect(dialog.getByText('Sunday Show', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/saved-shows.png' });
});

test('account saves keep their destination after reload and repeated Save updates that show', async ({ page }) => {
  const requests: Array<{ id: string | null; expectedRevision: number | null; data: unknown }> = [];
  let revision = 0;
  let holdSave = false;
  let finishSave: (() => void) | undefined;
  await page.route('**/api/floorplanner/cloud-session', route => route.fulfill({ json: { available: true, authenticated: true } }));
  await page.route('**/api/floorplanner/cloud-layouts', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { layouts: [] } });
    const body = route.request().postDataJSON();
    requests.push(body);
    if (holdSave) await new Promise<void>(resolve => { finishSave = resolve; });
    return route.fulfill({ json: { layout: { id: 'saved-account-show', name: body.name, revision: ++revision, savedAt: new Date().toISOString(), tableCount: 0, vendorCount: 0 } } });
  });
  await openEditor(page);
  await page.getByRole('textbox', { name: 'Floor plan title' }).fill('Account Show');
  await page.getByRole('button', { name: 'Open shows', exact: true }).click();
  await page.getByRole('button', { name: 'Copy current show to account' }).click();
  await expect(page.getByRole('dialog', { name: 'Open shows' }).getByRole('status')).toContainText('Saved to your account');
  await page.getByRole('button', { name: 'Close saved shows' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Start Editing' }).click();
  await page.clock.install({ time: new Date('2026-09-08T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-08T12:00:01Z'));
  await page.getByRole('textbox', { name: 'Floor plan title' }).fill('Account Show Updated');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[0].id).toBeNull();
  expect(requests[1].id).toBe('saved-account-show');
  expect(requests[1].expectedRevision).toBe(1);
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
  holdSave = true;
  await page.getByRole('textbox', { name: 'Floor plan title' }).fill('Sent version');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => requests.length).toBe(3);
  await page.getByRole('textbox', { name: 'Floor plan title' }).fill('Newer unsaved version');
  finishSave!();
  await expect(page.getByText('Cloud autosave pending', { exact: true })).toBeVisible();
});


test('cloud autosave creates once and saves newer edits after an in-flight request', async ({ page }) => {
  const requests: Array<{ id: string | null; name: string; expectedRevision: number | null }> = [];
  let release: (() => void) | undefined;
  let hold = false;
  await page.route('**/api/floorplanner/cloud-session', route => route.fulfill({ json: { available: true, authenticated: true } }));
  await page.route('**/api/floorplanner/cloud-layouts', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { layouts: [] } });
    const body = route.request().postDataJSON();
    requests.push(body);
    if (hold) await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: { layout: { id: 'auto-show', name: body.name, revision: requests.length, savedAt: new Date().toISOString(), tableCount: 0, vendorCount: 0 } } });
  });
  await openEditor(page);
  await page.clock.install();
  await page.getByRole('textbox', { name: 'Floor plan title' }).fill('Autosaved Show');
  await page.clock.fastForward(4000);
  await expect.poll(() => requests.length).toBe(1);
  await expect(page.getByText('Saved to your account', { exact: true })).toBeVisible();
  expect(requests[0].id).toBeNull();
  hold = true;
  await page.getByRole('textbox', { name: 'Floor plan title' }).fill('Second version');
  await page.clock.fastForward(6000);
  await expect.poll(() => requests.length).toBe(2);
  await page.getByRole('textbox', { name: 'Floor plan title' }).fill('Third version');
  hold = false;
  release!();
  await expect(page.getByText('Cloud autosave pending', { exact: true })).toBeVisible();
  await page.clock.fastForward(6000);
  await expect.poll(() => requests.length).toBe(3);
  expect(requests[1].id).toBe('auto-show');
  expect(requests[2].id).toBe('auto-show');
  expect(requests[2].name).toBe('Third version');
  expect(requests[2].expectedRevision).toBe(2);
});

test('cloud autosave pauses on revision conflict without overwriting or looping', async ({ page }) => {
  let saves = 0;
  await page.route('**/api/floorplanner/cloud-session', route => route.fulfill({ json: { available: true, authenticated: true } }));
  await page.route('**/api/floorplanner/cloud-layouts', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { layouts: [] } });
    saves++;
    if (saves > 1) return route.fulfill({ status: 409, json: { code: 'revision-conflict', error: 'Changed on another device', currentLayout: null } });
    return route.fulfill({ json: { layout: { id: 'conflict-show', name: 'First version', revision: 1, savedAt: new Date().toISOString(), tableCount: 0, vendorCount: 0 } } });
  });
  await openEditor(page);
  await page.clock.install();
  await page.getByRole('textbox', { name: 'Floor plan title' }).fill('First version');
  await page.clock.fastForward(4000);
  await expect.poll(() => saves).toBe(1);
  await expect(page.getByText('Saved to your account', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Floor plan title' }).fill('My edits');
  await page.clock.fastForward(6000);
  await expect(page.getByRole('alert').filter({ hasText: 'Cloud autosave paused' })).toContainText('changed on another device');
  await page.clock.fastForward(60000);
  expect(saves).toBe(2);
  await expect(page.getByRole('textbox', { name: 'Floor plan title' })).toHaveValue('My edits');
});

test('vendor sharing downloads real PDFs and images and prints one page per vendor', async ({ page, context }) => {
  await openEditor(page);
  await page.getByRole('textbox', { name: 'Floor plan title' }).fill('River City Show');
  await page.getByRole('button', { name: /^Add row/ }).click();
  await page.getByRole('spinbutton', { name: 'Tables', exact: true }).fill('5');
  await page.locator('.konvajs-content').click({ position: { x: 400, y: 250 } });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Vendors', exact: true }).click();
  for (const name of ['Alpha Cards', 'Beta Collectibles']) {
    await page.getByRole('textbox', { name: 'Vendor name' }).fill(name);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
  }
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Auto-assign open booths' }).click();
  await page.getByRole('button', { name: 'Print & share', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Print & share' });
  await expect(dialog.getByRole('combobox', { name: 'What to print or share' })).toHaveValue('floor');
  await dialog.getByRole('combobox', { name: 'What to print or share' }).selectOption('vendor');
  await dialog.getByRole('combobox', { name: 'Vendor to share' }).selectOption({ label: 'Alpha Cards (1 tables)' });
  await expect(dialog.getByRole('textbox', { name: 'Message for email or Facebook' })).toHaveValue(/Alpha Cards.*River City Show/s);
  const previewSvg = decodeURIComponent((await dialog.getByAltText('Assignment map preview').getAttribute('src'))!.split(',').slice(1).join(','));
  expect(previewSvg).toContain('Alpha Cards');
  expect(previewSvg).not.toContain('Beta Collectibles');
  expect(previewSvg).toContain('Your tables');
  expect(previewSvg).toContain('fill="#2563eb"');
  await page.screenshot({ path: 'test-results/print-share-preview.png' });
  const { readFile } = await import('node:fs/promises');
  const pdfDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download PDF', exact: true }).click();
  const pdf = await pdfDownload;
  await pdf.saveAs('test-results/vendor-assignment.pdf');
  const bytes = await readFile((await pdf.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  expect(bytes.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(1);
  const imageDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download PNG', exact: true }).click();
  const image = await imageDownload;
  await image.saveAs('test-results/vendor-assignment.png');
  expect((await readFile((await image.path())!)).subarray(1, 4).toString()).toBe('PNG');
  expect(image.suggestedFilename()).toMatch(/\.png$/);
  const jpgDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download JPG', exact: true }).click();
  const jpg = await jpgDownload;
  expect(jpg.suggestedFilename()).toMatch(/\.jpg$/);
  expect((await readFile((await jpg.path())!)).subarray(0, 3).toString('hex')).toBe('ffd8ff');
  await dialog.getByRole('combobox', { name: 'What to print or share' }).selectOption('all');
  const batchDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download PDF', exact: true }).click();
  const batch = await batchDownload;
  expect((await readFile((await batch.path())!)).toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(2);
  const popupPromise = page.waitForEvent('popup');
  await dialog.getByRole('button', { name: 'Print', exact: true }).click();
  const popup = await popupPromise;
  await expect(popup.locator('section')).toHaveCount(2);
  await expect(popup.locator('section').first()).toContainText('Alpha Cards');
  await expect(popup.locator('section').first()).not.toContainText('Beta Collectibles');
  await expect(popup.locator('section').last()).toContainText('Beta Collectibles');
  const printed = await popup.pdf({ preferCSSPageSize: true });
  expect(printed.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(2);
  await popup.evaluate(() => { (window as any).printCalls = 0; window.print = () => { (window as any).printCalls++ }; });
  await popup.getByRole('button', { name: 'Print / Save PDF' }).click();
  expect(await popup.evaluate(() => (window as any).printCalls)).toBe(1);
  await popup.close();
  await dialog.getByRole('combobox', { name: 'What to print or share' }).selectOption('map');
  const fullSvg = decodeURIComponent((await dialog.getByAltText('Assignment map preview').getAttribute('src'))!.split(',').slice(1).join(','));
  expect(fullSvg).toContain('Vendor directory');
  expect(fullSvg).toContain('Alpha Cards');
  expect(fullSvg).toContain('Beta Collectibles');
  const fullImage = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download PNG' }).click();
  await (await fullImage).saveAs('test-results/full-map-directory.png');
  const fullPdf = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download PDF' }).click();
  const fullDownload = await fullPdf;
  expect((await readFile((await fullDownload.path())!)).toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(1);

});

test('show preparation offers separate JPEGs, table signs, social graphics, and case rentals', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('textbox', { name: 'Floor plan title' }).fill('River City Card Show');
  await page.getByRole('button', { name: /^Add row/ }).click();
  await page.getByRole('spinbutton', { name: 'Tables', exact: true }).fill('3');
  await page.locator('.konvajs-content').click({ position: { x: 400, y: 250 } });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Next: assign vendors' }).click();
  await page.getByRole('textbox', { name: 'Vendor name' }).fill('River City Cards');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Auto-assign open booths' }).click();
  await page.getByRole('button', { name: 'Next: case rentals' }).click();
  await page.getByRole('spinbutton', { name: 'Cases for River City Cards' }).fill('3');
  await expect(page.getByText('3 cases reserved')).toBeVisible();
  await page.getByRole('button', { name: 'Next: print & share' }).click();
  const dialog = page.getByRole('dialog', { name: 'Print & share' });
  const choice = dialog.getByRole('combobox', { name: 'What to print or share' });
  const { readFile } = await import('node:fs/promises');
  for (const mode of ['floor', 'directory', 'social']) {
    await choice.selectOption(mode);
    if (mode === 'social') await dialog.getByRole('textbox', { name: 'Headline' }).fill('Meet us at River City');
    const downloaded = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Download JPG', exact: true }).click();
    const file = await downloaded;
    expect((await readFile((await file.path())!)).subarray(0, 3).toString('hex')).toBe('ffd8ff');
    await file.saveAs(`test-results/show-kit-${mode}.jpg`);
  }
  await page.screenshot({ path: 'test-results/show-kit-social-preview.png' });
  await choice.selectOption('flyers');
  await expect(dialog.getByRole('button', { name: 'Print classic vendor flyers' })).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download PDF', exact: true }).click();
  expect((await readFile((await (await downloaded).path())!)).toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(1);
  await dialog.getByRole('button', { name: 'Close print and share' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Cases for River City Cards' })).toHaveValue('3');
});
