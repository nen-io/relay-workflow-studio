import { expect, test } from "@playwright/test";
import { seed } from "../../src/domain/fixtures";

test("a pointer gesture is one undoable edit; redo restores it and typing is grouped", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  const undo = page.getByRole("button", {
    name: "Undo graph edit",
    exact: true,
  });
  const redo = page.getByRole("button", {
    name: "Redo graph edit",
    exact: true,
  });
  await expect(undo).toBeDisabled();
  const node = page.getByRole("button", {
    name: "Inspect High-value order?",
    exact: true,
  });
  await node.scrollIntoViewIfNeeded();
  const box = (await node.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 80, { steps: 15 });
  await page.mouse.up();
  await expect(node).toHaveCSS("left", "365px");
  await undo.click();
  await expect(node).toHaveCSS("left", "275px");
  await expect(undo).toBeDisabled();
  await redo.click();
  await expect(node).toHaveCSS("left", "365px");
  const name = page.getByLabel("Workflow name");
  await name.fill("");
  await name.pressSequentially("My routing");
  await name.press("Tab");
  await undo.click();
  await expect(name).toHaveValue(seed.name);
  await redo.click();
  await expect(name).toHaveValue("My routing");
  await page.reload();
  await expect(name).toHaveValue("My routing");
  await expect(undo).toBeDisabled();
});

test("undo restores deleted connections and keeps captured runs immutable", async ({
  page,
}) => {
  await page.goto("/");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Run workflow", exact: true }).click();
  await expect(page.getByTestId("run-status")).toHaveText("completed");
  const trace = await page.locator(".trace").innerText();
  await page.getByRole("button", { name: "Delete node", exact: true }).click();
  await expect(page.locator(".node")).toHaveCount(4);
  await page
    .getByRole("button", { name: "Undo graph edit", exact: true })
    .click();
  await expect(page.locator(".node")).toHaveCount(5);
  await expect(page.locator(".edge")).toHaveCount(4);
  await expect(page.getByLabel("Node name")).toHaveValue("Order received");
  expect(await page.locator(".trace").innerText()).toBe(trace);
  await expect(
    page.getByText("Edited since this captured run. Run again to update."),
  ).toBeVisible();
  await page.getByLabel("Workflow name").fill("new");
  await page.getByLabel("Workflow name").press("Tab");
  await expect(
    page.getByRole("button", { name: "Redo graph edit", exact: true }),
  ).toBeDisabled();
});

test("keyboard undo is scoped away from text and history fences late imports", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add output", exact: true }).click();
  await page
    .getByRole("button", { name: "Inspect New output", exact: true })
    .focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.locator(".node")).toHaveCount(5);
  await page
    .getByRole("button", { name: "Redo graph edit", exact: true })
    .focus();
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(page.locator(".node")).toHaveCount(6);
  const name = page.getByLabel("Workflow name");
  await name.focus();
  await name.press("ControlOrMeta+z");
  await expect(page.locator(".node")).toHaveCount(6);
  await page.evaluate(() => {
    File.prototype.text = function () {
      return new Promise((resolve) => {
        (window as unknown as { finish: (s: string) => void }).finish = resolve;
      });
    };
  });
  await page.getByLabel("Import workflow JSON").setInputFiles({
    name: "late.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await page
    .getByRole("button", { name: "Undo graph edit", exact: true })
    .click();
  await page.evaluate(
    (s) => (window as unknown as { finish: (s: string) => void }).finish(s),
    JSON.stringify({ ...seed, name: "Stale" }),
  );
  await expect(name).toHaveValue(seed.name);
  await expect(page.locator(".node")).toHaveCount(5);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
