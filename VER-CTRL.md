# Version Control Rules

## Version Format

This project uses semantic version numbers:

```text
MAJOR.MINOR.PATCH
```

Each number is a non-negative integer. There is no digit limit, so versions such as `0.1.23`, `0.10.198`, and `0.34.892183` are valid.

## Increment Rules

### MAJOR

Use MAJOR only when the product is stable enough for a public release:

- Core functionality is complete and stable.
- Key subsystems and integrations are stable.
- Public APIs and behavior are not expected to break casually.
- Documentation is complete enough for users to deploy and operate the project.
- No known critical bugs remain.

The MAJOR version must never be changed without explicit approval from the project owner.

### MINOR

Use MINOR for backward-compatible feature work:

- New user-facing features.
- New integrations or plugins.
- New commands or functional modules.
- Meaningful workflow improvements that expand what the product can do.

Example:

```text
0.1.x -> 0.2.0
```

### PATCH

Use PATCH for smaller changes:

- Bug fixes.
- Documentation corrections.
- Small behavior improvements.
- Performance or reliability improvements.
- Dependency updates.

Example:

```text
0.1.2 -> 0.1.3
```

## Current Product Stage

The project is still pre-stable, so it should remain in the `0.x.x` range until the project owner explicitly agrees that the product is stable enough for a MAJOR release.

## Update Process

1. Classify the change as bug fix, small improvement, feature, or stable release.
2. Choose PATCH, MINOR, or MAJOR using the rules above.
3. Ask the project owner before any MAJOR version change.
4. Update the project configuration file that holds the version (e.g., `package.json`, `pyproject.toml`, `Cargo.toml`).
5. Update user-facing documentation that mentions the version or release behavior.
6. Commit the version change with a clear conventional commit message.

## Project Guidance

If the project displays a startup banner or version string, it should read the version from the canonical configuration file. When the project version changes there, the banner should update automatically — do not maintain a separate hard-coded version string.

Keep version changes tied to coherent, verified work. Do not bump the version for unfinished experiments.

## Repository Integration Workflow

External contributions use Pull Requests. Repository maintainers may integrate owner-authorized work directly into the main branch (`main` or `master`):

1. Synchronize the local main branch with the upstream remote.
2. Run the checks relevant to the changed files.
3. Create a conventional commit and push it to the upstream main branch.
4. Monitor the resulting CI run and repair failures promptly with a follow-up commit.

CI runs on Pull Requests and direct pushes to the main branch. Required checks protect external Pull Requests before merge; maintainer direct pushes are checked after integration. A maintainer may still choose a branch and Pull Request for risky work or when pre-merge review is useful.

---

Last updated: 2026-07-25