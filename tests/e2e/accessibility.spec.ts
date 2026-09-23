import { test, expect } from "@playwright/test";

test("keyboard users can skip to the workflow, edit a node and return without losing focus", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to workflow editor" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("region", { name: "Workflow editor" }),
  ).toBeFocused();
  const node = page.getByRole("button", {
    name: "Inspect High-value order?",
    exact: true,
  });
  await node.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Node name", { exact: true })).toBeFocused();
  await expect(node).toHaveAccessibleDescription(/condition.*ready/);
  await page
    .getByRole("button", { name: "Back to workflow", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(node).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Delete node", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Node name", { exact: true })).toBeFocused();
  await expect(page.getByLabel("Node name", { exact: true })).toHaveValue(
    "Order received",
  );
});

test("invalid scalar and payload values have stable names, associated explanations and recoverable focus", async ({
  page,
}) => {
  await page.goto("/");
  const compare = page.getByLabel("Compare value", { exact: true });
  await compare.fill("{}");
  await compare.press("Enter");
  await expect(compare).toHaveAttribute("aria-invalid", "true");
  await expect(compare).toBeFocused();
  await expect(compare).toHaveAccessibleDescription(/finite scalar/);
  await compare.fill("250");
  await compare.press("Enter");
  await expect(compare).toHaveAttribute("aria-invalid", "false");
  await expect(compare).toBeFocused();
  await page.getByText("Canvas position", { exact: true }).click();
  const position = page.getByLabel("X position", { exact: true });
  await position.fill("4000");
  await position.press("Enter");
  await expect(position).toBeFocused();
  await expect(position).toHaveAccessibleDescription(/0 to 3000/);
  await position.fill("200");
  await position.press("Enter");
  await expect(position).toHaveAttribute("aria-invalid", "false");
  const input = page.getByLabel("Input JSON", { exact: true });
  await input.fill("{broken");
  await page.getByRole("button", { name: "Run workflow", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(input).toHaveAccessibleDescription(/JSON/);
  await input.fill('{"customer":"Alex","amount":320}');
  await page.getByRole("button", { name: "Run workflow", exact: true }).click();
  await expect(page.getByTestId("run-status")).toHaveText("completed");
});

test("narrow enlarged text and forced colors keep navigation and non-drag editing usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Edit selected node", exact: true })
    .click();
  await expect(page.getByLabel("Node name", { exact: true })).toBeFocused();
  await page.getByText("Canvas position", { exact: true }).click();
  await page.getByLabel("X position", { exact: true }).fill("200");
  await page.getByLabel("X position", { exact: true }).press("Tab");
  await page.evaluate(() => {
    for (const e of document.querySelectorAll<HTMLElement>(
      "button,p,label,input,select,textarea,summary",
    )) {
      const size = parseFloat(getComputedStyle(e).fontSize);
      e.style.fontSize = `${size * 2}px`;
    }
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Back to workflow", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", {
      name: "Inspect High-value order?",
      exact: true,
    }),
  ).toBeFocused();
});

test("opening the inspector during a run focuses its region instead of a disabled field", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await page.getByRole("button", { name: "Run workflow", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit selected node", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Node inspector" }),
  ).toBeFocused();
  await expect(page.getByLabel("Node name", { exact: true })).toBeDisabled();
  await page.clock.runFor(3000);
  await page
    .getByRole("button", { name: "Edit selected node", exact: true })
    .click();
  await expect(page.getByLabel("Node name", { exact: true })).toBeFocused();
});
