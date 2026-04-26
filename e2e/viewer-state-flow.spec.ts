import { test, expect } from "../playwright-fixture";

/**
 * End-to-end viewer state flow.
 *
 * Drives the operator UI through Polling Slate → Go Live → End Poll and
 * asserts that the audience-facing /vote/:slug page transitions accordingly.
 *
 * Requires: an authenticated operator session in the preview (the user must
 * already be logged in — these tests share the preview's Supabase session)
 * and a project with at least one poll that has 2+ answers loaded in the
 * workspace.
 *
 * The slug used here is `goals` to match the project's conventional test
 * poll. Override with VIEWER_SLUG env var if needed.
 */

const VIEWER_SLUG = process.env.VIEWER_SLUG ?? "goals";
const VIEWER_PATH = `/vote/${VIEWER_SLUG}`;
const OPERATOR_PATH = "/polls/new?mode=output";

test.describe("Viewer state machine", () => {
  test("transitions through slate → voting → branding as operator presses buttons", async ({
    browser,
  }) => {
    // Two contexts: operator (authenticated) + viewer (anonymous audience).
    const operatorContext = await browser.newContext();
    const viewerContext = await browser.newContext();

    const operator = await operatorContext.newPage();
    const viewer = await viewerContext.newPage();

    // ---- Open the viewer first so we can watch transitions live. ----
    await viewer.goto(VIEWER_PATH);
    await expect(viewer).toHaveURL(new RegExp(VIEWER_PATH));

    // Default state should be MakoVote branding.
    await expect(viewer.getByText(/MakoVote|Mako/i).first()).toBeVisible({
      timeout: 10_000,
    });

    // ---- Open the operator workspace. ----
    await operator.goto(OPERATOR_PATH);
    // Wait for the operator output mode controls to render.
    await expect(operator.getByRole("button", { name: /Go Live/i })).toBeVisible({
      timeout: 15_000,
    });

    // ---- 1. Press Polling Slate ----
    await operator.getByRole("button", { name: /^Polling Slate$/i }).click();

    // Viewer should show the slate text within a couple of poll cycles.
    await expect(viewer.getByText(/Polling will open soon/i)).toBeVisible({
      timeout: 8_000,
    });

    // ---- 2. Press Go Live ----
    await operator.getByRole("button", { name: /^Go Live$/i }).click();

    // A confirmation dialog may appear — confirm if present.
    const confirm = operator.getByRole("button", { name: /^(Go Live|Confirm|Yes)/i }).last();
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click();
    }

    // Viewer should now show answer buttons. Look for at least one button
    // inside the voting card (we don't know exact answer text so we assert
    // that the slate copy is gone and tappable answer buttons exist).
    await expect(viewer.getByText(/Polling will open soon/i)).toBeHidden({
      timeout: 8_000,
    });
    const answerButtons = viewer.locator("button").filter({ hasNotText: /refresh/i });
    await expect(answerButtons.first()).toBeVisible({ timeout: 8_000 });
    expect(await answerButtons.count()).toBeGreaterThanOrEqual(2);

    // ---- 3. Press End Poll ----
    await operator.getByRole("button", { name: /^End Poll$/i }).click();
    const endConfirm = operator.getByRole("button", { name: /^(End Poll|Confirm|Yes)/i }).last();
    if (await endConfirm.isVisible().catch(() => false)) {
      await endConfirm.click();
    }

    // Viewer returns to MakoVote branding.
    await expect(viewer.getByText(/MakoVote|Mako/i).first()).toBeVisible({
      timeout: 10_000,
    });

    await operatorContext.close();
    await viewerContext.close();
  });
});