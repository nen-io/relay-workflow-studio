import { expect, test } from "@playwright/test";
import { seed } from "../../src/domain/fixtures";
import fs from "node:fs/promises";
const imported = (source: string) => ({
  name: "workflow.json",
  mimeType: "application/json",
  buffer: Buffer.from(source),
});
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.clock.install();
});
async function run(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Run workflow", exact: true }).click();
  await page.clock.runFor(2500);
}
test("edits threshold and input, executes both branches and inspects immutable payloads", async ({
  page,
}) => {
  await page.getByLabel("Compare value", { exact: true }).fill("400");
  await page.getByLabel("Compare value", { exact: true }).press("Tab");
  await run(page);
  await expect(page.getByTestId("run-status")).toHaveText("completed");
  await expect(
    page.getByRole("button", { name: "Inspect step Standard queue" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Inspect Priority queue", exact: true }),
  ).toContainText("skipped");
  await page
    .getByLabel("Input JSON")
    .fill('{"customer":"Morgan","amount":500}');
  await run(page);
  await expect(
    page.getByRole("button", { name: "Inspect step Priority queue" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Inspect step Normalize customer" })
    .click();
  await expect(page.getByTestId("step-input")).toContainText("Morgan");
  await expect(page.getByTestId("step-output")).toContainText("MORGAN");
});
test("cancel, reset and immediate rerun cannot reveal stale steps; reset restores input selector", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Run workflow", exact: true }).click();
  await page.clock.runFor(450);
  await page.getByRole("button", { name: "Cancel run" }).click();
  await page.clock.runFor(5000);
  await expect(page.getByTestId("run-status")).toHaveText("cancelled");
  await expect(page.locator(".trace li")).toHaveCount(1);
  await page.getByLabel("Example input").selectOption("standard");
  await page.getByRole("button", { name: "Reset example" }).click();
  await expect(page.getByLabel("Example input")).toHaveValue("priority");
  await expect(page.getByLabel("Input JSON")).toContainText("320");
  await page.getByLabel("Example input").selectOption("standard");
  await run(page);
  await expect(
    page.getByRole("button", { name: "Inspect step Standard queue" }),
  ).toBeVisible();
  await expect(page.locator(".trace li")).toHaveCount(4);
});
test("keyboard connection controls edit the actual graph and invalid execution preserves last result", async ({
  page,
}) => {
  await run(page);
  await page.getByRole("button", { name: "List view" }).click();
  await page.getByLabel("When true", { exact: true }).focus();
  await page.getByLabel("When true", { exact: true }).press("s");
  await page.getByLabel("When true", { exact: true }).press("Tab");
  await expect(page.getByLabel("When true", { exact: true })).toHaveValue(
    "standard",
  );
  await page.getByRole("button", { name: "Run workflow", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("reachable");
  await expect(
    page.getByRole("button", { name: "Inspect step Priority queue" }),
  ).toBeVisible();
  await page.getByLabel("When true", { exact: true }).selectOption("priority");
  await page.getByLabel("When false", { exact: true }).selectOption("standard");
  await run(page);
  await expect(page.getByTestId("run-status")).toHaveText("completed");
});
test("export round trip, malformed and oversized import preserve existing state", async ({
  page,
}) => {
  await run(page);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const download = await downloadEvent;
  const source = await fs.readFile((await download.path())!, "utf8");
  expect(JSON.parse(source)).toEqual(seed);
  await page.getByLabel("Import workflow JSON").setInputFiles(imported("{bad"));
  await expect(page.getByRole("alert")).toContainText("not valid JSON");
  await expect(page.getByTestId("run-status")).toHaveText("completed");
  await page
    .getByLabel("Import workflow JSON")
    .setInputFiles(imported("a".repeat(131073)));
  await expect(page.getByRole("alert")).toContainText("128 KiB");
  await expect(page.getByLabel("Workflow name")).toHaveValue("Order routing");
  const next = { ...JSON.parse(source), name: "Imported routing" };
  await page
    .getByLabel("Import workflow JSON")
    .setInputFiles(imported(JSON.stringify(next)));
  await expect(page.getByLabel("Workflow name")).toHaveValue(
    "Imported routing",
  );
  await expect(page.getByTestId("run-status")).toHaveText("Ready to run");
});
test("failure example reports the correct node and escaped HTML is plain text", async ({
  page,
}) => {
  await page.getByLabel("Example input").selectOption("failure");
  await run(page);
  await expect(page.getByTestId("run-status")).toHaveText("failed");
  await page
    .getByRole("button", { name: "Inspect step Normalize customer" })
    .click();
  await expect(page.getByRole("alert")).toContainText("must be a string");
  await page.getByLabel("Node name").fill("<img src=x onerror=alert(1)>");
  await expect(
    page.locator(".node").filter({ hasText: "<img src=x onerror=alert(1)>" }),
  ).toBeVisible();
  expect(await page.locator(".node img").count()).toBe(0);
});
test("incremental scalar typing preserves values and finite position edits keep graph stable", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Inspect Normalize customer", exact: true })
    .click();
  await page.getByLabel("Operation", { exact: true }).selectOption("assign");
  await page.getByLabel("Assignment value").fill("");
  await page.getByLabel("Assignment value").pressSequentially("hello");
  await page.getByLabel("Assignment value").press("Tab");
  await expect(page.getByLabel("Assignment value")).toHaveValue('"hello"');
  await run(page);
  await expect(page.getByTestId("step-output")).toContainText(
    '"customer": "hello"',
  );
  await page.getByText("Canvas position", { exact: true }).click();
  await page.getByLabel("X position").fill("");
  await page.getByLabel("X position").press("Tab");
  await expect(page.getByRole("alert")).toContainText("0 to 3000");
  expect(await page.locator(".canvas").getAttribute("style")).not.toContain(
    "NaN",
  );
  await page.getByLabel("X position").fill("150");
  await page.getByLabel("X position").press("Tab");
  await expect(page.getByLabel("X position")).toHaveValue("150");
  await page
    .getByRole("button", { name: "Inspect High-value order?", exact: true })
    .click();
  await page.getByLabel("Comparison", { exact: true }).selectOption("equals");
  await page.getByLabel("Compare value", { exact: true }).fill('"320"');
  await page.getByLabel("Compare value", { exact: true }).press("Tab");
  await run(page);
  await expect(
    page.getByRole("button", { name: "Inspect step Standard queue" }),
  ).toBeVisible();
});
test("corrupt and denied local storage recover visibly", async ({ page }) => {
  await page.evaluate(() =>
    localStorage.setItem("relay.workflow.v1", "corrupt"),
  );
  await page.reload();
  await expect(page.locator(".banner.warning")).toContainText(
    "could not be restored",
  );
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("denied");
      },
    });
  });
  await page.reload();
  await expect(page.locator(".banner.warning")).toContainText("unavailable");
  await page.getByLabel("Workflow name").fill("Still editable");
  await expect(page.getByLabel("Workflow name")).toHaveValue("Still editable");
});
test("add and delete nodes are real graph edits with incident-edge cleanup", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Add output", exact: true }).click();
  await page.getByLabel("Node name").fill("New destination");
  await expect(page.locator(".node")).toHaveCount(6);
  await page
    .getByRole("button", { name: "Inspect High-value order?", exact: true })
    .click();
  await page
    .getByLabel("When true", { exact: true })
    .selectOption({ label: "New destination" });
  await page
    .getByRole("button", { name: "Inspect Priority queue", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete node" }).click();
  await run(page);
  await expect(
    page.getByRole("button", { name: "Inspect step New destination" }),
  ).toBeVisible();
});
test("desktop and mobile screenshots show populated results without overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await run(page);
  await page
    .getByRole("button", { name: "Inspect High-value order?", exact: true })
    .click();
  await page.screenshot({
    path: "docs/screenshots/desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Inspect Priority queue", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Compare value", { exact: true }).fill("500");
  await page.getByLabel("Compare value", { exact: true }).press("Tab");
  await run(page);
  await expect(
    page.getByRole("button", { name: "Inspect step Standard queue" }),
  ).toBeVisible();
});
test("200 percent text size remains operable and reduced motion completes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 720, height: 900 });
  await page.evaluate(() => {
    const elements = [
      ...document.querySelectorAll<HTMLElement>(
        "button,input,select,textarea,p,label,h1,h2,h3,strong,small",
      ),
    ];
    const sizes = elements.map((element) =>
      parseFloat(getComputedStyle(element).fontSize),
    );
    elements.forEach((element, index) => {
      element.style.fontSize = `${sizes[index] * 2}px`;
    });
  });
  await run(page);
  await expect(page.getByTestId("run-status")).toHaveText("completed");
  await expect(
    page.getByRole("button", { name: "Inspect step Priority queue" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("a pending file read cannot overwrite a newer reset", async ({ page }) => {
  await page.evaluate(() => {
    File.prototype.text = function () {
      return new Promise((resolve) => {
        (
          window as unknown as { finishImport: (value: string) => void }
        ).finishImport = resolve;
      });
    };
  });
  await page
    .getByLabel("Import workflow JSON")
    .setInputFiles(imported(JSON.stringify({ ...seed, name: "Stale import" })));
  await page.getByRole("button", { name: "Reset example" }).click();
  await page.evaluate(
    (source) =>
      (
        window as unknown as { finishImport: (value: string) => void }
      ).finishImport(source),
    JSON.stringify({ ...seed, name: "Stale import" }),
  );
  await expect(page.getByLabel("Workflow name")).toHaveValue("Order routing");
  await expect(page.getByTestId("run-status")).toHaveText("Ready to run");
});
test("invalid input preserves the last completed result and reports the field", async ({
  page,
}) => {
  await run(page);
  await page
    .getByLabel("Input JSON")
    .fill('{"amount":{},"customer":"Example"}');
  await page.getByRole("button", { name: "Run workflow", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "amount must be a finite scalar",
  );
  await expect(page.getByTestId("run-status")).toHaveText("completed");
  await expect(
    page.getByRole("button", { name: "Inspect step Priority queue" }),
  ).toBeVisible();
});
