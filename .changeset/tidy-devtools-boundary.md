---
'@captra-ai/devtools': patch
'captra': patch
---

Publish Devtools as a standalone package and make `captra/devtools` re-export that canonical implementation so conversation and future inspection views cannot drift between entry points.
