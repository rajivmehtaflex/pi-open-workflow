import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";

export type TestFramework = "node" | "python" | "unknown";

export interface TestCommand {
  command: string;
  cwd: string;
  framework: TestFramework;
}

export type TestOutcome = "passed" | "failed" | "no-tests" | "not-configured";

export interface ClassifiedTestResult {
  outcome: TestOutcome;
  exitCode: number | null;
  output: string;
  testCount?: number;
  failedCount?: number;
}

const MANIFESTS = ["package.json", "pyproject.toml", "Cargo.toml", "go.mod"];
const PLACEHOLDER_TEST = /^echo\s+["']?Error:\s*no test specified["']?\s*(?:&&|;)\s*exit\s+1\s*$/i;

function isPlaceholderTest(script: string): boolean {
  return PLACEHOLDER_TEST.test(script) || script === 'echo "Error: no test specified" && exit 1';
}

export function resolveProjectRoot(startPath: string): string | null {
  if (!isAbsolute(startPath)) return null;

  let current = startPath;
  try {
    if (!statSync(current).isDirectory()) current = dirname(current);
  } catch {
    current = dirname(current);
  }

  while (true) {
    if (MANIFESTS.some((manifest) => existsSync(join(current, manifest)))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export function detectTestCommand(projectRoot: string | null): TestCommand | null {
  if (!projectRoot) return null;

  const packagePath = join(projectRoot, "package.json");
  if (existsSync(packagePath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as {
        scripts?: { test?: unknown };
      };
      const testScript = packageJson.scripts?.test;
      if (typeof testScript === "string" && testScript.trim() !== "" && !isPlaceholderTest(testScript.trim())) {
        return { command: "npm test", cwd: projectRoot, framework: "node" };
      }
    } catch {
      return null;
    }
    return null;
  }

  if (existsSync(join(projectRoot, "pyproject.toml"))) {
    return { command: "uv run pytest -q --tb=short", cwd: projectRoot, framework: "python" };
  }

  return null;
}

export function classifyTestResult(
  command: TestCommand | null,
  result: { exitCode: number; stdout: string; stderr: string },
): ClassifiedTestResult {
  const output = `${result.stdout}\n${result.stderr}`.trim();
  if (!command) return { outcome: "not-configured", exitCode: null, output };

  if (
    (command.framework === "python" && result.exitCode === 5) ||
    /no tests (?:ran|found)|collected 0 items/i.test(output)
  ) {
    return { outcome: "no-tests", exitCode: result.exitCode, output };
  }

  return {
    outcome: result.exitCode === 0 ? "passed" : "failed",
    exitCode: result.exitCode,
    output,
  };
}
