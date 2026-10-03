# TaskNest

TaskNest is a simple VS Code extension that organizes tasks into a tree using `:` separators in task names.

You can run, stop, and restart tasks from the view.

TaskNest displays its interface in English regardless of the VS Code display language.

## Versions

| Component | Version |
| --- | --- |
| TaskNest | 0.1.0 |
| VS Code | 1.100 or later |
| Node.js for development | 24.21.0 (pinned) |
| Package manager | pnpm 12.8.1 (pinned) |

## Usage

`.vscode/tasks.json`

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "build:frontend",
      "type": "shell",
      "command": "echo frontend build",
      "problemMatcher": []
    },
    {
      "label": "build:backend",
      "type": "shell",
      "command": "echo backend build",
      "problemMatcher": []
    },
    {
      "label": "test:unit",
      "type": "shell",
      "command": "echo unit test",
      "problemMatcher": []
    }
  ]
}
```

TaskNest displays these tasks as follows:

```text
build
├─ frontend
└─ backend
test
└─ unit
```

## Development

Run the following commands from the repository root. fnm selects the Node.js version specified in `.node-version`.

```powershell
fnm install
fnm use
node --version
corepack enable pnpm
pnpm install --frozen-lockfile
pnpm run all
```

Press F5 to launch the Extension Development Host. You can also select `all`, `format`, `package`, `build`, `test`, `test:integration`, `lint`, or `check` from VS Code's **Run Task** command.

### Commands

| Command | Purpose |
| --- | --- |
| `pnpm run all` | Type check → format → lint → build → unit tests → integration tests → VSIX package |
| `pnpm run check` | Check TypeScript types |
| `pnpm run format` | Format and overwrite code |
| `pnpm run format:check` | Check code formatting |
| `pnpm run lint` | Lint code and treat warnings as failures |
| `pnpm run lint:fix` | Apply automatic lint fixes |
| `pnpm run build` | Build the extension |
| `pnpm test` | Run unit tests |
| `pnpm run test:integration` | Run integration tests in VS Code |
| `pnpm run package` | Create an installable VSIX package |
| `pnpm run prepare` | Configure Git hooks and executable paths for Node.js and pnpm |

`pnpm run all` stops when a step fails. Integration tests download a test version of VS Code. To use an existing installation, set the `TASKNEST_VSCODE_PATH` environment variable to the absolute path of its executable.

### Pre-commit validation

`pnpm install --frozen-lockfile` enables the pre-commit Git hook. The hook runs `pnpm run all` and aborts the commit if validation fails.

Run `pnpm run all` before staging changes. The hook does not automatically stage formatting changes. Run `pnpm run prepare` again if the installation path of Node.js or pnpm changes.
The hook compares staged files with the working tree before and after validation. It aborts the commit if unstaged changes or untracked files that Git does not ignore remain. Stage your changes before retrying.

## Packaging and installation

Run the following commands to create and install the VSIX package. The `package` task in VS Code creates the same file.

```powershell
pnpm run package
code --install-extension .\task-nest-0.1.0.vsix
```

You can also install the package using VS Code's **Install from VSIX** command.

[Changelog](CHANGELOG.md) · [MIT license](LICENSE)
