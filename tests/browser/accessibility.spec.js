import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("critical landing page has no serious accessibility violations", async ({
  page,
}) => {
  for (const theme of ["light", "dark"]) {
    await page.evaluate((nextTheme) => {
      document.documentElement.dataset.theme = nextTheme;
    }, theme);
    const results = await new AxeBuilder({ page })
      .disableRules(["region"])
      .analyze();
    expect(
      results.violations.filter(({ impact }) =>
        ["serious", "critical"].includes(impact),
      ),
    ).toEqual([]);
  }
});

test("responsive layouts do not overflow horizontally", async ({ page }) => {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(page.locator("article[data-open]").first()).toBeVisible();
});

test("inline submissions preserve the current scroll position", async ({ page }) => {
  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: /Network/ }).click();
  await expect(page.getByRole("heading", { name: /Find people/ })).toBeVisible();
  const form = page.locator('form[data-form="network-search"]');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(100);
  await form.evaluate((element) => element.requestSubmit());
  await expect(form).toBeVisible();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.scrollY);
  expect(after).toBeGreaterThan(before - 80);
});

test("color theme can be changed and persists across reloads", async ({ page }) => {
  await page.getByRole("button", { name: /Switch color theme|Switch to dark mode/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Switch to light mode" })).toBeVisible();
});

test("PWA shell registers and reloads while offline", async ({ page, context }) => {
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "manifest.webmanifest");
  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) throw new Error("Service workers are unavailable");
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(".hero-visual img")).toBeVisible();
  await context.setOffline(false);
});

test("posting dialog is labeled, traps focus, and restores focus", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: "Post work" });
  await trigger.focus();
  await trigger.press("Enter");
  const dialog = page.getByRole("dialog", {
    name: "What outcome do you need?",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Title")).toBeFocused();
  await dialog.getByLabel("Type").selectOption("Repair");
  await expect(dialog).toBeVisible();
  for (let index = 0; index < 25; index += 1) await page.keyboard.press("Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("safety dialog is private, categorized, and gives emergency guidance", async ({
  page,
}) => {
  await page.locator("article[data-open]").first().click();
  await page.getByRole("button", { name: "Report concern" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Tell moderators what happened.",
  });
  await expect(dialog).toContainText("local emergency services");
  await expect(dialog.getByLabel("Concern")).toHaveValue("unsafe_work");
  await expect(dialog.getByLabel("Details")).toHaveAttribute("minlength", "10");
});

test("visible interactive controls have accessible names and usable targets", async ({
  page,
}) => {
  const findings = await page.evaluate(() => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden";
    };
    const controls = [
      ...document.querySelectorAll("button,a[href],input,select,textarea"),
    ].filter(visible);
    return {
      unnamed: controls
        .filter((element) => {
          if (element.matches("input,select,textarea"))
            return !(
              element.labels?.length ||
              element.getAttribute("aria-label") ||
              element.getAttribute("aria-labelledby")
            );
          return !(
            element.textContent.trim() ||
            element.getAttribute("aria-label") ||
            element.getAttribute("title")
          );
        })
        .map((element) => element.outerHTML),
      undersized: controls
        .filter((element) => !element.classList.contains("skip"))
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width < 40 || rect.height < 40;
        })
        .map((element) => element.getAttribute("aria-label") || element.textContent.trim()),
    };
  });
  expect(findings.unnamed).toEqual([]);
  expect(findings.undersized).toEqual([]);
});

test("primary demo journeys remain operable without duplicate submission", async ({
  page,
}) => {
  for (const name of ["My work", "Network", "Open profile", "Discover"]) {
    await page.getByRole("button", { name }).click();
    await expect(page.locator("main")).not.toBeEmpty();
  }
  const initialCards = await page.locator("article[data-open]").count();
  await page.getByRole("button", { name: "Post work" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill("Accessible duplicate guard test");
  await dialog
    .getByLabel("Desired outcome")
    .fill("Create exactly one request when submission is repeated.");
  await dialog.getByLabel("Skills, comma separated").fill("Testing");
  await dialog.getByLabel("What can you offer?").fill("Accessibility review");
  await dialog.locator("form").evaluate((form) => {
    form.requestSubmit(form.querySelector('button[value="publish"]'));
    form.requestSubmit(form.querySelector('button[value="publish"]'));
  });
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Accessible duplicate guard test" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Discover" }).click();
  await expect(page.locator("article[data-open]")).toHaveCount(initialCards + 1);
});
