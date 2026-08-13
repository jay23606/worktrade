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

test("account onboarding explains invite-only pilot access", async ({ page }) => {
  await page.getByRole("button", { name: "Open profile" }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Use a secure email link." })).toBeVisible();
  await expect(page.getByLabel(/Pilot invite code/)).toBeVisible();
  await expect(page.getByText(/new pilot members also need an invite code/i)).toBeVisible();
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
  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: /Community/ }).click();
  await expect(page.getByRole("heading", { name: /Useful work starts/ })).toBeVisible();
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

test("community experience centers practical local coordination", async ({ page }) => {
  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Community" }).click();
  await expect(page.getByRole("heading", { name: /Useful work starts with people/ })).toBeVisible();
  await expect(page.getByText("Nearby & transport")).toBeVisible();
  await expect(page.getByText("Tools & equipment")).toBeVisible();
  const actionSpacing = await page.locator(".person-card-actions").first().evaluate((actions) => {
    const probe = document.createElement("button");
    probe.className = "text-btn";
    probe.textContent = "Follow";
    actions.append(probe);
    const style = getComputedStyle(actions);
    return { display: style.display, gap: parseFloat(style.columnGap) };
  });
  expect(actionSpacing.display).toBe("flex");
  expect(actionSpacing.gap).toBeGreaterThanOrEqual(12);
  await expect(page.getByText(/neighborhood, maker space, nonprofit/)).toBeVisible();
  await page.locator('[data-nav="profile"]').last().click();
  await page.getByRole("button", { name: "Improve my matches" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel(/Comfortable travel radius/)).toBeVisible();
  await expect(dialog.getByLabel(/Transport, tools, equipment/)).toBeVisible();
});

test("color theme can be changed and persists across reloads", async ({ page }) => {
  await page.getByRole("button", { name: /Switch color theme|Switch to dark mode/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Switch to light mode" })).toBeVisible();
});

test("project follow feedback remains readable in dark mode", async ({ page }) => {
  await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
  await page.getByRole("heading", { name: "Build a backyard greenhouse" }).click();
  await page.getByRole("button", { name: "Follow project" }).click();
  const toast = page.locator("#toast");
  await expect(toast).toContainText("Project follow updated");
  await expect(toast).toBeVisible();
  await page.waitForTimeout(250);
  const colors = await toast.evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, text: style.color };
  });
  expect(colors.background).toBe("rgb(237, 242, 234)");
  expect(colors.text).toBe("rgb(16, 23, 19)");
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

test("PWA install and connectivity controls explain their state", async ({ page, context }) => {
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt");
    Object.defineProperties(event, {
      prompt: { value: async () => {} },
      userChoice: { value: Promise.resolve({ outcome: "accepted" }) },
    });
    dispatchEvent(event);
  });
  const install = page.locator("#install-app");
  await expect(install).toBeVisible();
  await install.click();
  await expect(install).toBeHidden();
  await context.setOffline(true);
  await page.evaluate(() => dispatchEvent(new Event("offline")));
  await expect(page.getByText(/You’re offline/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await context.setOffline(false);
  await page.evaluate(() => dispatchEvent(new Event("online")));
  await expect(page.getByRole("status").last()).toContainText("Connection restored");
});

test("guided match setup saves preferences and produces first matches", async ({ page }) => {
  await page.locator('[data-nav="profile"]').last().click();
  await page.getByRole("button", { name: "Improve my matches" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: /What would make WorkTrade useful/ })).toBeVisible();
  await dialog.getByLabel(/What can you offer/).fill("Carpentry, design, bicycle repair");
  await dialog.getByLabel(/What do you need/).fill("Greenhouse help, bookkeeping");
  await dialog.getByLabel("Availability").fill("Saturday mornings");
  await dialog.getByRole("button", { name: "Save and show my matches" }).click();
  await expect(page.getByRole("heading", { name: "Useful overlap, explained." })).toBeVisible();
  await expect(page.getByText("Your carpentry, design may help", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Adjust matching profile" })).toBeVisible();
  const firstMatch = page.locator(".match-shell").first();
  await firstMatch.getByRole("button", { name: "Useful" }).click();
  await expect(firstMatch.getByRole("button", { name: "Useful" })).toHaveClass(/selected/);
  await firstMatch.getByRole("button", { name: "Hide" }).click();
  await expect(page.getByRole("button", { name: "Restore hidden matches" })).toBeVisible();
  await page.getByRole("button", { name: "Restore hidden matches" }).click();
  await expect(page.locator(".match-shell").first()).toBeVisible();
  await page.locator(".match-shell").first().getByRole("button", { name: "Not relevant" }).click();
  const feedbackDialog = page.getByRole("dialog", { name: "Why isn’t this relevant?" });
  await feedbackDialog.getByLabel("Too far away").check();
  await feedbackDialog.getByRole("button", { name: "Save feedback" }).click();
  await expect(feedbackDialog).toBeHidden();
});

test("workspace presents one guided next action and links to its project", async ({ page }) => {
  await page.getByRole("navigation", { name: "Primary" }).locator('[data-nav="workspace"]').click();
  await expect(page.getByRole("heading", { name: "Latest terms, one response at a time." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Needs your response" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Waiting on someone else" })).toBeVisible();
  const guide = page.locator(".journey-panel").first();
  await expect(guide.getByText("Your next action")).toBeVisible();
  await expect(guide.getByRole("heading", { name: /Resolve dependency/ })).toBeVisible();
  await guide.getByRole("button", { name: "Open dependency" }).click();
  await expect(page.getByRole("heading", { name: "Restore and reseal storefront deck", exact: true })).toBeVisible();
  const path = page.locator(".project-path");
  await expect(path.getByText(/Weather:/)).toBeVisible();
  await expect(path.getByText("Agreement", { exact: true })).toBeVisible();
  await expect(path.getByText("Complete", { exact: true })).toBeVisible();
  await expect(page.getByText(/Next action: Conditions/)).toBeVisible();
  const openProjectSection = (name) => page.getByRole("navigation", { name: "Project sections" }).getByRole("button", { name }).click();
  await openProjectSection("Activity");
  await expect(page.getByRole("heading", { name: "Updates, messages, and decisions" })).toBeVisible();
  await expect(page.getByPlaceholder("Message the other participant")).toBeVisible();
  await expect(page.locator(".activity-feed")).toContainText("Aug 12");
  await expect(page.locator(".activity-feed")).not.toContainText("2001");
  await openProjectSection("Exchange");
  await expect(page.getByRole("heading", { name: "What each side is contributing" })).toBeVisible();
  await openProjectSection("Files");
  await expect(page.getByRole("heading", { name: "Conditions, progress, and results" })).toBeVisible();
});

test("inbox groups events and routes messages to project activity", async ({ page }) => {
  await page.getByRole("button", { name: "Open notifications" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Needs your action" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Messages" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Updates" })).toBeVisible();
  await dialog.getByText("New project message", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Restore and reseal storefront deck", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Updates, messages, and decisions" })).toBeVisible();
  await page.getByRole("button", { name: "Open notifications" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Mute project" }).first().click();
  await expect(page.getByText(/required actions remain in your inbox/)).toBeVisible();
});

test("first-use activation explains the path to a credible exchange", async ({ page }) => {
  await page.getByRole("navigation", { name: "Primary" }).locator('[data-nav="workspace"]').click();
  const activation = page.locator(".activation-panel");
  await expect(activation.getByRole("heading", { name: /steps complete/ })).toBeVisible();
  await expect(activation.getByText("Complete your work profile", { exact: true })).toBeVisible();
  await expect(activation.getByText("Post or propose real work", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Discover" }).click();
  await expect(page.getByText("These are removable examples.")).toBeVisible();
  await page.getByRole("heading", { name: "Build a backyard greenhouse" }).click();
  await page.getByRole("button", { name: "Propose a trade" }).click();
  const dialog = page.getByRole("dialog");
  const context = dialog.getByRole("complementary", { name: "Work and exchange you are proposing for" });
  await expect(context.getByRole("heading", { name: "Build a backyard greenhouse" })).toBeVisible();
  await expect(context.getByText("They are offering")).toBeVisible();
  await expect(context.getByText(/Exchange options/)).toBeVisible();
  await expect(dialog.getByText("1 · Value", { exact: true })).toBeVisible();
  await expect(dialog.getByText("2 · Scope", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/Mutual confirmation protects both people/)).toBeVisible();
});

test("local discovery exposes privacy-safe filters and saved alerts", async ({ page }) => {
  await page.getByRole("navigation", { name: "Primary" }).locator('[data-nav="network"]').click();
  const form = page.locator('form[data-form="network-search"]');
  await expect(form.getByLabel("Where")).toBeVisible();
  await form.getByLabel("Where").selectOption("nearby");
  await expect(form.getByRole("button", { name: "Carpentry" })).toBeVisible();
  await form.locator('select[name="availability"]').selectOption("weekend");
  await form.locator('select[name="sort"]').selectOption("distance");
  await form.getByRole("button", { name: "Find people" }).click();
  await expect(page.getByText(/does not collect coordinates or reveal exact addresses/)).toBeVisible();
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

test("major screens remain coherent in both color themes", async ({ page }) => {
  test.setTimeout(60_000);
  for (const theme of ["light", "dark"]) {
    await page.evaluate((nextTheme) => localStorage.setItem("worktrade:theme", nextTheme), theme);
    await page.reload();
    for (const destination of ["discover", "matches", "workspace", "network", "profile"]) {
      const scope = destination === "profile" ? page : page.getByRole("navigation", { name: "Primary" });
      await scope.locator(`[data-nav="${destination}"]`).last().click();
      await expect(page.locator("main h1").first()).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }));
      expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
      const results = await new AxeBuilder({ page }).disableRules(["region"]).analyze();
      expect(results.violations.filter(({ impact }) => ["serious", "critical"].includes(impact))).toEqual([]);
    }
  }
});

test("invalid forms stay open and successful creation focuses its result", async ({ page }) => {
  await page.getByRole("button", { name: "Post work" }).click();
  const dialog = page.getByRole("dialog", { name: "What outcome do you need?" });
  await dialog.locator("form").evaluate((form) => form.requestSubmit());
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Title")).toBeFocused();
  await dialog.getByLabel("Title").fill("Repair the community tool bench");
  await dialog.getByLabel("Desired outcome").fill("Restore a stable shared bench for neighborhood repair work.");
  await dialog.getByLabel("Skills, comma separated").fill("Carpentry");
  await dialog.getByLabel("What can you offer?").fill("Garden help");
  await dialog.getByRole("button", { name: "Publish request" }).click();
  const result = page.getByRole("heading", { name: "Repair the community tool bench" });
  await expect(result).toBeVisible();
  await expect(result).toBeFocused();
  await expect(page.getByRole("status")).toContainText("published");
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
  for (const destination of ["workspace", "matches", "network", "profile", "discover"]) {
    const scope = destination === "profile" ? page : page.getByRole("navigation", { name: "Primary" });
    await scope.locator(`[data-nav="${destination}"]`).last().click();
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
