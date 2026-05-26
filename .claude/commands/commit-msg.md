Run `git diff --staged` to see staged changes. If that returns nothing, fall back to `git diff HEAD` to capture unstaged working-tree changes (this happens when files are staged via a GUI like GitHub Desktop but not via the CLI index). Also run `git log --oneline -10` to understand the recent commit style. Then propose a commit message that:
- Follows the conventional commits format used in this repo (e.g. `fix:`, `feat:`, `refactor:`, `chore:`)
- Focuses on the *why*, not just the what
- Is a single line, under 72 characters
- Does not end with a period

Output only the commit message — no explanation, no code block, no quotes.
