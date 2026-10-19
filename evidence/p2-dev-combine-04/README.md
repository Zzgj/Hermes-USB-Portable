# P2-09-DEV-COMBINE-04 + WIN-NATIVE-VERIFY-02 Evidence

## Fixed source identity
- DEV-COMBINE-04 combined source: `6a0daaaf0576c594ec58f652be027e5d5a6394e5`
- WIN-NATIVE-VERIFY-02 fixed source: `aa4c6360b800e247fb95f971a23cea237fce1b6b`

## Platform
- Windows 10 (10.0.18363)
- Node v26.7.0 (`D:/hermes/tools/node-26.7.0-win32-x64/node`)
- Python 3.14.7 (`D:/hermes/tools/python-3.14.7+202****0901-win32-x64/python`)
- Chrome: `C:/Program Files/Google/Chrome/Application/chrome.exe`

## Logs

| # | File | Command | Exit code | SHA-256 (as stored, CRLF) | SHA-256 (LF-normalized) |
|---|------|---------|----------:|---------------------------|-------------------------|
| 01 | 01-node-test.log | `node --test tests/native-entry-client.test.mjs tests/native-entry-panel.test.mjs tests/merge-handoff.test.mjs tests/native-package-contract.test.mjs tests/package.test.mjs tests/portable-native-entries.test.mjs tests/portable-guard-order.test.mjs tests/native-entry-manager.test.mjs tests/s1-browser-driver.test.mjs` | 0 | `3cc9c1bc19d34a56311d44dbe9e1bf28ad01699efaa57cf4a89259e7f98012b5` | — (Node output is LF) |
| 02 | 02-validate.log | `npm run validate` | 0 | `4981dabc268f18953909fdeab9c6075cd54e46f019f192b202e8d5f923f8277e` | — |
| 03 | 03-build.log | `npm run build` | 0 | `859c48ac5f8704684923bdc3f649c99368603fa70e1888815291ff1c19f12740` | — |
| 04 | 04-native-browser-check.log | `node tests/native-entry-browser-check.mjs` | 0 | `35fb752c72d6ec7fc687925b9968ac5a41e372b07c72ef1addb8d184f211f7c6` | — |
| 05 | 05-entry-control-check.log | `node tests/entry-control-browser-check.mjs` | 0 | `2dfa71d0fb43a20ca47d4b44dd8fec45f688aa567e6d72366c6b0b476d6c20b7` | — |
| 06 | 06-s1-browser-check.log | `node tests/s1-browser-check.mjs` | 0 | `cbe2df6b003882edc26f061b6938b5911500adc22195c6174fbc88dd10c402c0` | — |
| 07 | 07-win-native-host-test.log | `python -m unittest discover -s tests -p test_native_entry_host.py -v` | 0 | `277ec3411f16773d6831d38b9ea1b4080ce8229b99171711a876e29dbc7e7943` (CRLF) | `68192080f24fd7b1365d9425fadd3c0044f8601a18e373aa7e6c151e200e7566` (LF) |
| 08 | 08-win-native-node-test.log | `node --test tests/native-entry-session.test.mjs tests/native-entry-manager.test.mjs tests/native-process-protocol.test.mjs tests/native-owned-process.test.mjs tests/managed-native.test.mjs tests/legacy-entry.test.mjs` | 0 | `68356ecb82990ecf1a3fba49d32e21b5fd4b4e48af771489e452bce71eb26ce6` | — |

### Python log CRLF note
Log 07 was produced by Python's `unittest -v` on Windows, which emits CRLF line endings. The file is stored in this evidence branch with CRLF preserved. The SHA-256 `277ec341…` is the CRLF byte hash as stored; the LF-normalized hash is `68192080…`. Git's `autocrlf` may report a different blob hash depending on checkout settings; the file content is identical in both cases.

## dist manifest (from 03-build)
- `dist/index.html` 440B — `85cff85d4ed17057a05a596b70de47d7f11de3cd86bcf1a552629b9865808e77`
- `dist/assets/index-2AciLI6h.js` 323757B — `6e32d63e656021ff63c30ad6ace787ca2a12e5635f0e6fbebf6024db1b920d6d`
- `dist/assets/index-LurzMAcB.css` 17945B — `0fabcada339dd49f6438628254be3e76cdcdef6fc4339d2e980ef3ecbd6a479d`

## Known gaps (not covered by these logs)
- `windows-job-host.py` execution-time disk SHA-256 was not recorded before WIN-NATIVE-VERIFY-02; Git blob `2d98b874e241dbadbda00f3769c641ed9e15c509` is the tree-level trace but not a pre-execution disk hash
- Linux socket sub-assertion in `s1-browser-driver.test.mjs` not executed on Windows (`if(process.platform!=='linux')return`)
- Browser checks use synthetic adapters, not real Hermes/CLI/U-disk
- WIN-NATIVE-VERIFY-02 logs (07-08) are historical, not re-run for DEV-COMBINE-04
- guard持锁时序动态覆盖仅限 `createPortableNativeEntries` 路径; `legacy-hermes-entry.mjs` 与 `launch-managed.mjs`/`managed-instance.mjs` 的 `beforeStart` 调用路径未做动态覆盖
- No sensitive paths, credentials, or personal configuration in any log
