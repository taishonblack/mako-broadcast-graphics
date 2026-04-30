import { test, expect, type Page } from "../playwright-fixture";

/**
 * Vote pipeline regression — asserts that votes belong to the active POLL
 * (project_live_state.active_poll_id), not to the currently-loaded scene,
 * and that all three downstream surfaces stay in lockstep:
 *
 *   1. Output Inspector → "Live Vote Tally" (operator workspace, output mode)
 *   2. Program Preview  → result bars
 *   3. Statistics page  → per-poll analytics
 *
 * This spec drives the public viewer to cast a real vote and then asserts
 * the tally surfaces increment in lockstep. It also asserts that switching
 * the workspace's selected scene does NOT change which poll the tally is
 * reading from (the regression that motivated this test).
 *
 * Requires: an authenticated operator session in the preview, a project
 * loaded with at least one poll that has 2+ answers, and a viewer slug
 * for that poll. Override defaults with VIEWER_SLUG / OPERATOR_PATH env.
 */

const VIEWER_SLUG = process.env.VIEWER_SLUG ?? "goals";
const VIEWER_PATH = `/vote/${VIEWER_SLUG}`;
const OPERATOR_PATH = process.env.OPERATOR_PATH ?? "/polls/new?mode=output";

/** Read the integer that follows in the "Live Vote Tally" pill. */
async function readOutputInspectorTotal(page: Page): Promise<number> {
  const tile = page.getByText(/Live Vote Tally/i).first();
  await expect(tile).toBeVisible({ timeout: 10_000 });
  // The total renders as "<n> vote" or "<n> votes" right next to the label.
  const totalNode = tile.locator("..").getByText(/\b\d[\d,]*\s+votes?\b/i).first();
  const txt = (await totalNode.textContent()) ?? "0";
  const m = txt.replace(/,/g, "").match(/\d+/);
  return m ? Number(m[0]) : 0;
}

/** Sum the per-bar vote counts visible in the Program Preview overlay. */
async function readProgramPreviewTotal(page: Page): Promise<number> {
  // Bars render their per-answer counts as "<n> · <p>%" inside the inspector
  // bar list. Sum every "<n> · <p>%" occurrence on the page.
  const matches = await page.locator("text=/\\b\\d[\\d,]*\\s+·\\s+\\d+%/").allTextContents();
  return matches.reduce((sum, t) => {
    const m = t.replace(/,/g, "").match(/(\d+)\s+·/);
    return sum + (m ? Number(m[1]) : 0);
  }, 0);
}

test.describe("Vote pipeline — active_poll_id consistency", () => {
  test("votes flow to Output Inspector, Program Preview, and Statistics for the same poll_id", async ({
    browser,
  }) => {
    const operatorContext = await browser.newContext();
    const viewerContext = await browser.newContext();

    const operator = await operatorContext.newPage();
    const viewer = await viewerContext.newPage();

    // Capture the diagnostic logs the fix added so failures point straight
    // at which stage of the pipeline went stale.
    const opLogs: string[] = [];
    operator.on("console", (msg) => {
      const t = msg.text();
      if (/\[(active poll|tally fetched|statistics fetched|vote submitted)\]/.test(t)) {
        opLogs.push(t);
      }
    });

    // ── 1. Operator opens the workspace in Output mode ────────────────
    await operator.goto(OPERATOR_PATH);
    await expect(
      operator.getByRole("button", { name: /Go Live/i }),
    ).toBeVisible({ timeout: 15_000 });

    // ── 2. Polling Slate → Go Live → Open Voting ──────────────────────
    await operator.getByRole("button", { name: /^Polling Slate$/i }).click();
    await operator.getByRole("button", { name: /^Go Live$/i }).click();
    const goConfirm = operator
      .getByRole("button", { name: /^(Go Live|Confirm|Yes)/i })
      .last();
    if (await goConfirm.isVisible().catch(() => false)) {
      await goConfirm.click();
    }

    // Open Voting if a separate control exists; otherwise Go Live opens it.
    const openVoting = operator.getByRole("button", { name: /^Open Voting$/i });
    if (await openVoting.isVisible().catch(() => false)) {
      await openVoting.click();
    }

    // Wait for the diagnostic that confirms a non-null active_poll_id.
    await expect
      .poll(
        () =>
          opLogs.find((l) =>
            /\[active poll\].*active_poll_id":"[0-9a-f-]{36}/.test(l),
          ) ?? null,
        { timeout: 10_000 },
      )
      .not.toBeNull();

    const activePollLog = opLogs
      .reverse()
      .find((l) => /\[active poll\]/.test(l))!;
    const activePollId = activePollLog.match(
      /active_poll_id":"([0-9a-f-]{36})/,
    )?.[1];
    expect(activePollId, "operator should publish a real active_poll_id").toBeTruthy();

    // ── 3. Read baseline tally ────────────────────────────────────────
    const baselineInspector = await readOutputInspectorTotal(operator);
    const baselineProgram = await readProgramPreviewTotal(operator);

    // ── 4. Viewer casts a vote ────────────────────────────────────────
    await viewer.goto(VIEWER_PATH);
    const answerButtons = viewer.locator("button").filter({ hasNotText: /refresh|reload/i });
    await expect(answerButtons.first()).toBeVisible({ timeout: 10_000 });
    await answerButtons.first().click();

    // ── 5. Output Inspector + Program Preview both increment ──────────
    await expect
      .poll(async () => readOutputInspectorTotal(operator), { timeout: 12_000 })
      .toBeGreaterThan(baselineInspector);

    await expect
      .poll(async () => readProgramPreviewTotal(operator), { timeout: 12_000 })
      .toBeGreaterThan(baselineProgram);

    // ── 6. Switching scenes must NOT change the bound poll ────────────
    // Find any scene tab that's not the active one and click it. The
    // active_poll_id binding should stay identical.
    const sceneTabs = operator.getByRole("tab");
    const tabCount = await sceneTabs.count().catch(() => 0);
    if (tabCount > 1) {
      await sceneTabs.nth(1).click().catch(() => undefined);
      // Allow the binding hook to re-emit if it was going to.
      await operator.waitForTimeout(800);
      const lastActive = [...opLogs]
        .reverse()
        .find((l) => /\[active poll\]/.test(l));
      const stillActive = lastActive?.match(
        /active_poll_id":"([0-9a-f-]{36})/,
      )?.[1];
      expect(
        stillActive,
        "scene switch must not change active_poll_id",
      ).toBe(activePollId);
    }

    // ── 7. Statistics page reads the same poll_id ─────────────────────
    const stats = await operatorContext.newPage();
    const statsLogs: string[] = [];
    stats.on("console", (msg) => {
      const t = msg.text();
      if (/\[statistics fetched\]/.test(t)) statsLogs.push(t);
    });
    await stats.goto("/statistics");

    await expect
      .poll(
        () =>
          statsLogs.find((l) =>
            new RegExp(`poll_id":"${activePollId}`).test(l),
          ) ?? null,
        { timeout: 12_000 },
      )
      .not.toBeNull();

    // ── 8. Re-scan Polls leaves totals consistent ─────────────────────
    const rescan = operator.getByRole("button", { name: /Re-scan Polls/i });
    if (await rescan.isVisible().catch(() => false)) {
      const beforeRescan = await readOutputInspectorTotal(operator);
      await rescan.click();
      // Toast copy is contractual — surfaces the active poll explicitly.
      await expect(
        operator.getByText(/Votes re-scanned/i).first(),
      ).toBeVisible({ timeout: 6_000 });
      // Total must not regress after a recount (votes table is source of truth).
      const afterRescan = await readOutputInspectorTotal(operator);
      expect(afterRescan).toBeGreaterThanOrEqual(beforeRescan);
    }

    // ── 9. End Live tears down cleanly ────────────────────────────────
    const endLive = operator.getByRole("button", { name: /^End Live$/i });
    if (await endLive.isVisible().catch(() => false)) {
      await endLive.click();
      const endConfirm = operator
        .getByRole("button", { name: /^(End Live|Confirm|Yes)/i })
        .last();
      if (await endConfirm.isVisible().catch(() => false)) {
        await endConfirm.click();
      }
    }

    await operatorContext.close();
    await viewerContext.close();
  });
});