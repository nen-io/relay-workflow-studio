import { expect, test } from "@playwright/test";
import { seed } from "../../src/domain/fixtures";

test("dragging follows the pointer, updates edges, commits once and survives reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  const node = page.getByRole("button", {
    name: "Inspect High-value order?",
    exact: true,
  });
  await node.scrollIntoViewIfNeeded();
  const before = (await node.boundingBox())!;
  const edge = page.locator(".connections .edge path").nth(1);
  const previousPath = await edge.getAttribute("d");
  const stored = await page.evaluate(() =>
    localStorage.getItem("relay.workflow.v1"),
  );
  await page.mouse.move(before.x + 55, before.y + 35);
  await page.mouse.down();
  await page.mouse.move(before.x + 155, before.y + 90, { steps: 12 });
  const during = (await node.boundingBox())!;
  expect(during.x - before.x).toBeCloseTo(100, 0);
  expect(during.y - before.y).toBeCloseTo(55, 0);
  await expect(edge).not.toHaveAttribute("d", previousPath!);
  expect(
    await page.evaluate(() => localStorage.getItem("relay.workflow.v1")),
  ).toBe(stored);
  await page.mouse.up();
  const saved = await node.getAttribute("style");
  await page.reload();
  await expect(node).toHaveAttribute("style", saved!);
});

test("Escape and browser cancellation discard moves; clicks do not persist layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const node = page.getByRole("button", {
    name: "Inspect Normalize customer",
    exact: true,
  });
  await node.scrollIntoViewIfNeeded();
  const before = (await node.boundingBox())!;
  const stored = await page.evaluate(() =>
    localStorage.getItem("relay.workflow.v1"),
  );
  await node.click();
  expect(
    await page.evaluate(() => localStorage.getItem("relay.workflow.v1")),
  ).toBe(stored);
  for (const cancel of ["escape", "pointercancel"] as const) {
    await page.mouse.move(before.x + 50, before.y + 30);
    await page.mouse.down();
    await page.mouse.move(before.x + 180, before.y + 70, { steps: 8 });
    if (cancel === "escape") await page.keyboard.press("Escape");
    else await node.dispatchEvent("pointercancel", { pointerId: 1 });
    await page.mouse.up();
    await expect(node).not.toHaveClass(/dragging/);
    expect(await node.boundingBox()).toEqual(before);
    expect(
      await page.evaluate(() => localStorage.getItem("relay.workflow.v1")),
    ).toBe(stored);
  }
});

test("pointer capture, canvas scrolling and keyboard controls preserve exact coordinates", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 1000 });
  await page.goto("/");
  const node = page.getByRole("button", {
    name: "Inspect High-value order?",
    exact: true,
  });
  await node.scrollIntoViewIfNeeded();
  const before = (await node.boundingBox())!;
  await page.mouse.move(before.x + 30, before.y + 30);
  await page.mouse.down();
  await page.mouse.move(before.x + 350, before.y + 70, { steps: 12 });
  await page.mouse.up();
  await expect(node).toHaveCSS("left", "595px");
  const canvas = page.getByRole("region", { name: "Workflow canvas" });
  await canvas.evaluate((element) => {
    element.scrollLeft = 140;
  });
  await node.scrollIntoViewIfNeeded();
  const scrolled = (await node.boundingBox())!;
  await page.mouse.move(scrolled.x + 30, scrolled.y + 30);
  await page.mouse.down();
  await page.mouse.move(scrolled.x - 20, scrolled.y + 50, { steps: 8 });
  await page.mouse.up();
  await expect(node).toHaveCSS("left", "545px");
  await node.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Shift+ArrowDown");
  await expect(node).toHaveCSS("left", "544px");
  await expect(node).toHaveCSS("top", "402px");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("library drag/drop adds at the drop location; untrusted drop types are ignored", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  const canvas = page.locator(".canvas");
  await page
    .getByRole("button", { name: "Add output", exact: true })
    .dragTo(canvas, { targetPosition: { x: 580, y: 240 } });
  await expect(page.locator(".node")).toHaveCount(6);
  const added = page.getByRole("button", {
    name: "Inspect New output",
    exact: true,
  });
  await expect(added).toHaveCSS("left", "470px");
  await expect(added).toHaveCSS("top", "195px");
  await expect(page.getByLabel("Node name")).toHaveValue("New output");
  const data = await page.evaluateHandle(() => {
    const d = new DataTransfer();
    d.setData("application/x-relay-block", "__proto__");
    return d;
  });
  await canvas.dispatchEvent("drop", {
    dataTransfer: data,
    clientX: 500,
    clientY: 500,
  });
  await expect(page.locator(".node")).toHaveCount(6);
});

test("running blocks position edits while list/mobile keep scrolling and numeric controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  await page.clock.install();
  const node = page.getByRole("button", {
    name: "Inspect High-value order?",
    exact: true,
  });
  await page.getByRole("button", { name: "Run workflow", exact: true }).click();
  await node.scrollIntoViewIfNeeded();
  const before = (await node.boundingBox())!;
  await page.mouse.move(before.x + 30, before.y + 30);
  await page.mouse.down();
  await page.mouse.move(before.x + 120, before.y + 80, { steps: 8 });
  await page.mouse.up();
  await node.focus();
  await page.keyboard.press("ArrowRight");
  await expect(node).toHaveCSS("left", "275px");
  await page.getByRole("button", { name: "Cancel run" }).click();
  await page.getByRole("button", { name: "List view" }).click();
  await expect(node).toHaveCSS("touch-action", "auto");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByText("Canvas position", { exact: true }).click();
  await page.getByLabel("X position").fill("200");
  await page.getByLabel("X position").press("Tab");
  await expect(page.getByLabel("X position")).toHaveValue("200");
});

test("tablet touch dragging commits while touch cancellation restores the saved node", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1100, height: 1000 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/");
  const node = page.getByRole("button", {
    name: "Inspect High-value order?",
    exact: true,
  });
  await node.scrollIntoViewIfNeeded();
  const session = await context.newCDPSession(page);
  for (const cancel of [false, true]) {
    const box = (await node.boundingBox())!;
    const x = box.x + 30,
      y = box.y + 30;
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + 80, y: y + 25 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: cancel ? "touchCancel" : "touchEnd",
      touchPoints: [],
    });
    await expect(node).toHaveCSS("left", "355px");
    await expect(node).toHaveCSS("top", "357px");
  }
  await context.close();
});

test("resize cancels a gesture and a newer drag fences delayed import authority", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  await page.evaluate(() => {
    File.prototype.text = function () {
      return new Promise((resolve) => {
        (window as unknown as { finish: (value: string) => void }).finish =
          resolve;
      });
    };
  });
  await page.getByLabel("Import workflow JSON").setInputFiles({
    name: "late.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  const node = page.getByRole("button", {
    name: "Inspect High-value order?",
    exact: true,
  });
  await node.scrollIntoViewIfNeeded();
  const box = (await node.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 60, { steps: 8 });
  await page.setViewportSize({ width: 1300, height: 1100 });
  await page.mouse.up();
  await expect(node).toHaveCSS("left", "275px");
  await page.evaluate(() => {
    (window as unknown as { finish: (value: string) => void }).finish("{bad");
  });
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByLabel("Workflow name")).toHaveValue("Order routing");
});

for (const id of ["__proto__", "constructor", "toString"]) {
  test(`imported node ID ${id} retains finite edge geometry`, async ({
    page,
  }) => {
    await page.goto("/");
    const imported = structuredClone(seed);
    imported.nodes[0].id = id;
    imported.edges[0].source = id;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.getByLabel("Import workflow JSON").setInputFiles({
      name: "ids.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(imported)),
    });
    await expect(page.locator(".canvas")).toHaveCSS("min-height", /[0-9]+px/);
    await expect(
      page.locator(".connections .edge path").first(),
    ).toHaveAttribute("d", /^M 385 [0-9]+ C 385 [0-9]+, 385 146, 385 180$/);
    expect(errors).toEqual([]);
  });
}
