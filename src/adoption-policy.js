const dependencySections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

/** @pure */
export function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** @pure */
export function isSilvermoonSourceProject(manifest) {
  const repositoryUrl = manifest.repository?.url;
  if (
    manifest.name !== "silvermoon"
    || typeof repositoryUrl !== "string"
  ) {
    return false;
  }
  const normalizedUrl = repositoryUrl
    .replace(/^git\+/, "")
    .replace(/\.git$/, "");
  return normalizedUrl === "https://github.com/shazhou-ww/silvermoon";
}

/** @pure */
export function workspaceRoot(manifest) {
  if (!Object.hasOwn(manifest, "workspaces")) return false;
  const workspaces = manifest.workspaces;
  const packages = Array.isArray(workspaces)
    ? workspaces
    : isRecord(workspaces)
      ? workspaces.packages
      : null;
  if (!Array.isArray(packages) || !packages.every((item) => typeof item === "string")) {
    return null;
  }
  return packages.length > 0;
}

/** @pure */
export function packageManagerDescriptor(manager, workspace, reason = null) {
  if (reason || !manager || workspace === null) {
    return {
      manager: null,
      reason: reason ?? (workspace === null
        ? "The root workspaces field is not in a recognized form."
        : "The package manager could not be determined safely."),
      workspace,
    };
  }
  return {
    manager,
    reason: null,
    workspace,
  };
}

/** @pure */
export function dependencyInstallCommands(manager, workspace, version) {
  const packageSpecifier = `silvermoon@^${version}`;
  if (manager === "npm") {
    return [{ executable: "npm", args: ["install", "--save-dev", packageSpecifier] }];
  }
  if (manager === "pnpm") {
    return [{
      executable: "pnpm",
      args: [
        "add",
        "--save-dev",
        packageSpecifier,
        ...(workspace ? ["--workspace-root"] : []),
      ],
    }];
  }
  if (manager === "yarn") {
    return [
      {
        executable: "npm",
        args: ["pkg", "set", `devDependencies.silvermoon=^${version}`],
      },
      { executable: "yarn", args: ["install"] },
    ];
  }
  if (manager === "bun") {
    return [{ executable: "bun", args: ["add", packageSpecifier, "--dev"] }];
  }
  return null;
}

/** @pure */
export function renderCommand({ executable, args }) {
  return [executable, ...args]
    .map((argument) => argument.includes("^") || argument.includes(" ")
      ? `"${argument.replaceAll('"', '\\"')}"`
      : argument)
    .join(" ");
}

/** @pure */
export function renderDependencyCommand(manager, workspace, version) {
  const commands = dependencyInstallCommands(manager, workspace, version);
  return commands ? commands.map(renderCommand).join("\n") : null;
}

/** @pure */
export function dependencyInstruction(packageManager, expectedDependency, version) {
  const renderedCommands = packageManager.manager
    ? renderDependencyCommand(
      packageManager.manager,
      packageManager.workspace,
      version,
    )
    : null;
  if (!expectedDependency) {
    return `The running Silvermoon version ${JSON.stringify(version)} is not a supported SemVer version; repair the package before declaring its dependency.`;
  }
  if (!renderedCommands) {
    return `Do not guess a package-manager command. ${packageManager.reason} Resolve the root package-manager/workspace configuration, then add silvermoon@${expectedDependency} to the root devDependencies.`;
  }
  const commands = renderedCommands.split("\n");
  if (commands.length === 1) {
    return `From the repository root, run \`${commands[0]}\` to set root devDependencies.silvermoon to ${expectedDependency}.`;
  }
  return `From the repository root, run these commands in order: ${commands.map((command) => `\`${command}\``).join(", then ")} to set root devDependencies.silvermoon to ${expectedDependency}.`;
}

/** @pure */
export function skillInstruction(skill, packageManager, packagedSkillsRoot) {
  const registration = `npx skills add "${skill}" --skill silvermoon --agent universal --yes --copy`;
  if (skill === packagedSkillsRoot) {
    return `Run \`${registration}\`.`;
  }
  const install = packageManager.manager
    ? `run \`${packageManager.manager} install\``
    : "install dependencies with the resolved project package manager";
  return `After you add the required Silvermoon devDependency and ${install} at the repository root, run \`${registration}\`.`;
}

/** @pure */
export function canonicalSkillBytes(content) {
  if (content.includes(0)) return content;
  try {
    return Buffer.from(
      new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(content).replaceAll("\r\n", "\n"),
      "utf8",
    );
  } catch {
    return content;
  }
}

/** @pure */
export function evaluateNpmAdoption({ manifest, packageManager, sourceCheckout, sameSourceRuntime, expectedDependency, version }) {
  const findings = [];
  if (sourceCheckout && !sameSourceRuntime) {
    findings.push({
      priority: 35,
      problem: {
        type: "source-checkout-runtime-required",
        summary: "The Silvermoon source project must use its own checkout runtime, not an installed package or another checkout.",
      },
      instruction: "From the target repository root, rerun the same command and options with `node bin/silvermoon.js` instead of `silvermoon`. Do not add a Silvermoon dependency to its own source project.",
    });
  } else if (!expectedDependency) {
    findings.push({
      priority: 35,
      problem: {
        type: "npm-runtime-version-invalid",
        summary: `The running Silvermoon version ${JSON.stringify(version)} is not a supported SemVer version.`,
      },
      instruction: "Use a Silvermoon package with a valid SemVer version before adopting this npm project.",
    });
  } else if (!sourceCheckout) {
    const declarations = dependencySections
      .filter((section) => isRecord(manifest[section]) && Object.hasOwn(manifest[section], "silvermoon"));
    const hasDevDependency = declarations.includes("devDependencies");
    const actual = isRecord(manifest.devDependencies)
      ? manifest.devDependencies.silvermoon
      : undefined;
    if (!hasDevDependency) {
      findings.push({
        priority: 35,
        problem: {
          type: declarations.length > 0
            ? "npm-dependency-wrong-section"
            : "npm-dependency-missing",
          summary: declarations.length > 0
            ? "The root Silvermoon dependency must be declared in devDependencies."
            : `The root devDependencies.silvermoon must be ${expectedDependency}.`,
        },
        instruction: dependencyInstruction(packageManager, expectedDependency, version),
      });
    } else if (actual !== expectedDependency) {
      findings.push({
        priority: 35,
        problem: {
          type: "npm-dependency-version-mismatch",
          summary: `The root devDependencies.silvermoon must be exactly ${expectedDependency}; found ${JSON.stringify(actual)}.`,
        },
        instruction: dependencyInstruction(packageManager, expectedDependency, version),
      });
    }
    if (declarations.length > 1) {
      findings.push({
        priority: 36,
        problem: {
          type: "npm-dependency-duplicate",
          summary: `Silvermoon is declared in multiple root dependency sections: ${declarations.join(", ")}.`,
        },
        instruction: `Remove duplicate Silvermoon declarations and keep only devDependencies.silvermoon at ${expectedDependency}.`,
      });
    }
  }
  return findings;
}
