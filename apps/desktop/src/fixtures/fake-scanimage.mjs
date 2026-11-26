import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "scanner");
const scenarioPath = process.env.RAKAZO_FAKE_SCANIMAGE_SCENARIO;

async function main() {
  if (!scenarioPath) {
    process.stderr.write("Synthetic scanimage scenario is not configured.\n");
    process.exitCode = 2;
    return;
  }

  let scenario;
  try {
    scenario = JSON.parse(await readFile(scenarioPath, "utf8"));
  } catch {
    process.stderr.write("Synthetic scanimage scenario could not be read.\n");
    process.exitCode = 2;
    return;
  }

  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "-L") {
    if (scenario.listCallsFile) await appendFile(scenario.listCallsFile, "list\n", { mode: 0o600 });
    if (scenario.device === null) {
      process.stdout.write("device `test:flatbed` is a synthetic non-feeder scanner\n");
    } else {
      const device = scenario.device ?? "fujitsu:ScanSnap iX1600:synthetic";
      process.stdout.write(`device '${device}' is a synthetic Fujitsu scanner\n`);
    }
    return;
  }

  if (args.length === 3 && args[0] === "-d" && args[2] === "-A") {
    if (scenario.optionsCallsFile) {
      await appendFile(scenario.optionsCallsFile, "options\n", { mode: 0o600 });
    }
    if (scenario.busy) {
      process.stderr.write("scanimage: sane_start: Device busy\n");
      process.exitCode = 1;
      return;
    }
    if (scenario.optionsUnlisted) {
      process.stderr.write("scanimage: open of device failed: Invalid argument\n");
      process.exitCode = 1;
      return;
    }
    if (scenario.optionsHang) {
      await new Promise(() => setInterval(() => {}, 1000));
      return;
    }
    if (scenario.optionsDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, scenario.optionsDelayMs));
    }
    const loaded = scenario.pageLoaded === "on" || scenario.pageLoaded === true;
    process.stdout.write(`  --page-loaded[=(yes|no)] [${loaded ? "on" : "off"}]\n`);
    return;
  }

  const batch = args.find((arg) => arg.startsWith("--batch="))?.slice("--batch=".length);
  const expected = [
    "-d",
    args[args.indexOf("-d") + 1],
    "--source",
    "ADF Duplex",
    "--mode",
    "Color",
    "--resolution",
    "300",
    "--format=jpeg",
    `--batch=${batch}`,
    "--swskip=1",
  ];
  if (
    !batch ||
    args.length !== expected.length ||
    args.some((arg, index) => arg !== expected[index]) ||
    !args[1]?.startsWith("fujitsu:")
  ) {
    process.stderr.write("Unsupported synthetic scanimage arguments.\n");
    process.exitCode = 64;
    return;
  }

  if (scenario.callsFile) {
    await appendFile(scenario.callsFile, "scan\n", { mode: 0o600 });
  }
  if (scenario.startedFile) {
    await mkdir(path.dirname(scenario.startedFile), { recursive: true });
    await writeFile(scenario.startedFile, "started", { mode: 0o600 });
  }

  const pages = Array.isArray(scenario.pages)
    ? scenario.pages
    : ["page-one.jpg.b64", "page-two.jpg.b64"];
  for (const [index, fixtureName] of pages.entries()) {
    if (typeof fixtureName !== "string" || !/^[a-z0-9-]+\.jpg\.b64$/.test(fixtureName)) {
      process.stderr.write("Invalid synthetic page fixture.\n");
      process.exitCode = 64;
      return;
    }
    const bytes = Buffer.from(await readFile(path.join(fixtureDir, fixtureName), "utf8"), "base64");
    const file = batch.replace("%03d", String(index + 1).padStart(3, "0"));
    await writeFile(file, bytes, { mode: 0o600 });
  }

  if (scenario.scan?.delayMs) {
    await new Promise((resolve) => setTimeout(resolve, scenario.scan.delayMs));
  }
  if (scenario.scan?.hold) await new Promise(() => setInterval(() => {}, 1000));
  if (scenario.scan?.stderr) process.stderr.write(`${scenario.scan.stderr}\n`);
  const exitCode = Number.isInteger(scenario.scan?.exitCode) ? scenario.scan.exitCode : 0;
  if (exitCode === 0) {
    process.stderr.write("scanimage: sane_start: Document feeder out of documents\n");
  }
  process.exitCode = exitCode;
}

void main().catch(() => {
  process.stderr.write("Synthetic scanimage failed.\n");
  process.exitCode = 1;
});
