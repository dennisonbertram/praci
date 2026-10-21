import { readFile } from "node:fs/promises";
import type { Locator } from "@playwright/test";
import { expect, test } from "@playwright/test";
import type { MemoryDocument } from "@rakazo/contracts";
import {
  activeBotId,
  captureScreenshot,
  completeOnboarding,
  openUserSettings,
  rpc,
  signup,
} from "./helpers";

test("memory and skills are readable and editable in the app", async ({ page }, testInfo) => {
  const stamp = Date.now();
  const userName = `Knowledge ${stamp}`;
  await signup(page, `knowledge-${stamp}@rakazo.test`, "password12", userName);
  await completeOnboarding(page);
  await page.goto("/app");
  await page.waitForURL(/\/app\/[^/]+$/);

  // Space-wide documents live in Settings → Memory. Open that before bot
  // settings so the Knowledge Memory tab cannot steal this click.
  await openUserSettings(page, "memory");
  await expect(page.getByLabel("Close memory settings")).toBeVisible();
  const spaceDocs = page.getByTestId("space-memory-documents");
  await expect(spaceDocs.getByText("Shared by all bots")).toBeVisible();
  const sharedGroup = spaceDocs.getByTestId("memory-group-shared");
  // A row shows what is remembered, with the file name only as its title, so find it by that.
  const memoryFile = (scope: Locator) => scope.locator('button:has([title="MEMORY.md"])');
  const memoryRow = memoryFile(sharedGroup);
  await expect(memoryRow).toBeVisible();
  // The bot's own document (seeded MEMORY.md) is browsable here too, under its name.
  const botGroup = spaceDocs.getByTestId(`memory-group-${activeBotId(page)}`);
  await expect(botGroup.getByText("Chief", { exact: true })).toBeVisible();
  await expect(memoryFile(botGroup)).toBeVisible();
  await captureScreenshot(page, testInfo, "86-memory-browser");
  await memoryRow.click();
  const docEditor = sharedGroup.locator("textarea");
  const marker = `Edited in e2e ${stamp}`;
  await docEditor.fill(`# Memory\n\n${marker}\n`);
  await captureScreenshot(page, testInfo, "83-space-memory-editor");
  let releaseSave!: () => void;
  const saveGate = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  await page.route(
    "**/rpc/memory/update",
    async (route) => {
      await saveGate;
      await route.continue();
    },
    { times: 1 },
  );
  await spaceDocs.getByRole("button", { name: "Save", exact: true }).click();
  try {
    await expect(docEditor).toBeDisabled();
    await expect(memoryRow).toBeDisabled();
    await expect(spaceDocs.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
  } finally {
    releaseSave();
  }
  // The editor closes once the save lands.
  await expect(docEditor).toHaveCount(0);

  // Filtering by text only the saved shared document contains hides the bot group.
  const filterInput = spaceDocs.getByLabel("Filter memory");
  await filterInput.fill(marker);
  await expect(sharedGroup).toBeVisible();
  await expect(botGroup).toBeHidden();
  await filterInput.fill("zzz-no-such-doc");
  await expect(spaceDocs.getByText("No matches")).toBeVisible();
  await filterInput.fill("");
  await expect(botGroup).toBeVisible();

  // The save persisted: reopen the document and find the marker.
  await memoryRow.click();
  await expect(docEditor).toHaveValue(new RegExp(marker));
  await captureScreenshot(page, testInfo, "84-space-memory-saved");
  const sharedDocuments = await rpc<MemoryDocument[]>(page, "memory/list", { scope: "user" });
  expect(sharedDocuments).toContainEqual(
    expect.objectContaining({ content: `# Memory\n\n${marker}\n`, revision: 2 }),
  );
  // Export must fetch fresh content and exclude the bot's private document.
  const sharedDocument = sharedDocuments.find((doc) => doc.path === "MEMORY.md")!;
  const latestMarker = `Latest shared memory ${stamp}`;
  await rpc(page, "memory/update", { documentId: sharedDocument.id, content: latestMarker });
  const downloadPromise = page.waitForEvent("download");
  await spaceDocs.getByRole("button", { name: "Download as markdown" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("space-memory.md");
  const exported = await readFile((await download.path())!, "utf8");
  expect(exported).toContain(latestMarker);
  expect(exported).not.toContain(marker);
  expect(exported).not.toContain("# Chief");
  await page.getByLabel("Close memory settings").click();
  await expect(page.getByLabel("Close memory settings")).toHaveCount(0);

  // The bot's Knowledge section lives under Advanced in its settings panel.
  await page
    .locator("main")
    .getByRole("button", { name: /^Chief/ })
    .click();
  const settings = page.getByTestId("bot-settings");
  await expect(settings.getByText("Advanced", { exact: true })).toBeVisible();
  await settings.getByText("Advanced", { exact: true }).click();
  const knowledge = settings.getByTestId("bot-knowledge");
  await expect(knowledge).toBeVisible();

  // Bot creation seeds MEMORY.md (`# Chief`); edit it and assert the revision bumps.
  const botMemory = knowledge.getByTestId("bot-knowledge-memory");
  const botMemoryRow = memoryFile(botMemory);
  await expect(botMemoryRow).toBeVisible();
  await botMemoryRow.click();
  const botDocEditor = botMemory.locator("textarea");
  await expect(botDocEditor).toHaveValue(/# Chief/);
  const botMarker = `Bot memory e2e ${stamp}`;
  await botDocEditor.fill(`# Chief\n\n${botMarker}\n`);
  await botMemory.getByRole("button", { name: "Save", exact: true }).scrollIntoViewIfNeeded();
  await captureScreenshot(page, testInfo, "80-knowledge-bot-memory");
  await botMemory.getByRole("button", { name: "Save", exact: true }).click();
  await expect(botDocEditor).toHaveCount(0);
  expect(
    await rpc<MemoryDocument[]>(page, "memory/list", {
      botId: activeBotId(page),
      scope: "bot",
    }),
  ).toContainEqual(expect.objectContaining({ content: `# Chief\n\n${botMarker}\n`, revision: 2 }));
  await botMemoryRow.click();
  await expect(botDocEditor).toHaveValue(new RegExp(botMarker));
  await botMemory.getByRole("button", { name: "Cancel", exact: true }).click();

  const skills = page.getByTestId("bot-skills");
  const builtinSkill = skills.getByRole("button", { name: /Interrogate/ });
  await expect(builtinSkill).toBeVisible();
  await expect(builtinSkill.getByText("Built-in", { exact: true })).toBeVisible();
  await skills.getByRole("button", { name: "Add skill", exact: true }).click();
  await page.getByRole("menuitem", { name: "New skill", exact: true }).click();
  await skills.getByLabel("Name", { exact: true }).fill("greet-politely");
  await skills
    .getByLabel("What it does and when to use it", { exact: true })
    .fill("Say hello before anything else.");
  const editor = skills.locator("textarea");
  await editor.fill("Always open with a greeting.");
  await captureScreenshot(page, testInfo, "81-knowledge-skill-editor");
  await skills.getByRole("button", { name: "Save", exact: true }).click();
  const skillRow = skills.getByRole("button", { name: /greet-politely/ });
  await expect(skillRow).toBeVisible();
  await expect(skills.getByText("Say hello before anything else.")).toBeVisible();
  await expect(builtinSkill.getByText("Built-in", { exact: true })).toBeVisible();
  const listedShot = testInfo.outputPath("82-knowledge-skill-listed.png");
  await skills.screenshot({ animations: "disabled", caret: "hide", path: listedShot });
  await testInfo.attach("82-knowledge-skill-listed", {
    contentType: "image/png",
    path: listedShot,
  });
  const composer = page.getByRole("combobox", { name: /^Message/ });
  await composer.fill("/");
  await expect(
    page.getByRole("option", { name: "Skill greet-politely", exact: true }),
  ).toBeVisible();
  await composer.fill("");

  // A provider-owned skill uses the same viewer without mutation controls.
  await page.route(
    "**/rpc/agentSkills/get",
    async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({
        response,
        json: { ...body, json: { ...body.json, readOnly: true, source: "plugin" } },
      });
    },
    { times: 1 },
  );
  await skillRow.click();
  await expect(editor).toHaveAttribute("readonly", "");
  await expect(knowledge.getByText("Plugin", { exact: true })).toBeVisible();
  await expect(knowledge.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
  await expect(knowledge.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
  await knowledge.getByRole("button", { name: "Close", exact: true }).click();
  await skillRow.click();
  await expect(editor).toHaveValue(/Always open with a greeting/);
  await editor.fill(
    [
      "---",
      "name: greet-politely",
      "description: Say hello before anything else.",
      "---",
      "",
      "Open with a warm greeting.",
    ].join("\n"),
  );
  let releaseSkillRefresh!: () => void;
  const skillRefreshGate = new Promise<void>((resolve) => {
    releaseSkillRefresh = resolve;
  });
  await page.route(
    "**/rpc/agentSkills/list",
    async (route) => {
      await skillRefreshGate;
      await route.continue();
    },
    { times: 1 },
  );
  await knowledge.getByRole("button", { name: "Save", exact: true }).click();
  try {
    await expect(editor).toBeHidden();
    await expect(skillRow).toBeDisabled();
    await captureScreenshot(page, testInfo, "85-skill-refresh-pending");
  } finally {
    releaseSkillRefresh();
  }
  await skillRow.click();
  await expect(editor).toHaveValue(/warm greeting/);
  await knowledge.getByRole("button", { name: "Delete", exact: true }).click();
  await knowledge.getByRole("button", { name: "Confirm delete", exact: true }).click();
  await expect(skillRow).toBeHidden();
  await composer.fill("/");
  await expect(page.getByRole("option", { name: "Skill greet-politely", exact: true })).toHaveCount(
    0,
  );
  expect(await rpc<Array<{ name: string }>>(page, "agentSkills/list", {})).not.toContainEqual(
    expect.objectContaining({ name: "greet-politely" }),
  );
});
