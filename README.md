# he-debug — Header Editor Custom Function Debugger

Test [Header Editor](https://github.com/FirefoxBar/HeaderEditor) custom functions against a sample URL, entirely in your browser.

**Try it: https://dave-palt.github.io/he-debug/**

## Why

Header Editor's built-in rule Test panel checks whether a rule matches a URL, but it does **not** execute custom functions ("Custom code testing not supported"). This page fills that gap: it runs your function body with the exact same invocation the extension uses — `new Function('val', 'detail', 'util', code)` with the argument shapes observed in the extension source (`src/share/core/rule-utils.ts`, `web-request-handler.ts`).

## Features

- Rule types: Modify request/response header, Redirect, Cancel — with the real `val` shape per type (header array to mutate in place, or the URL for redirects)
- Match/Exclude regex filter, replicating `isMatchUrl()` semantics (including the `g`-flag `lastIndex` quirk)
- Shows the filter regex's capture groups (informational — the extension does not pass them to the function)
- Header diff (`+` added / `~` modified / `−` removed), redirect result, `_header_editor_cancel_` handling
- `console.log()` output from your function captured on the page
- Syntax and runtime error reporting
- Presets, localStorage persistence, shareable links (config in the URL hash)
- Zero dependencies, zero network calls — everything runs client-side

## Notes

- The `util` parameter is a minimal stub here; the real extension (5.4.2+) ships a lodash subset plus base64/text codecs.
- `he-debug.mjs` is the CLI sibling (run `bun he-debug.mjs "https://example.com/"`).

Not affiliated with the Header Editor authors.
