# MyVital Harmony — Supply Chain Package

Working documents for securing U.S. medical-supply distribution **before** any further
build work on the storefront.

| Document | Purpose |
| --- | --- |
| [`supplier-strategy.md`](supplier-strategy.md) | Target suppliers, what each one actually offers, verified facts and open questions |
| [`compliance-prerequisites.md`](compliance-prerequisites.md) | What must exist before a distributor will open an account, and the licensing exposure of the private-label step |
| [`unit-economics.md`](unit-economics.md) | The SKU contribution-margin model and the order-volume math behind the revenue targets |
| [`website-repositioning-brief.md`](website-repositioning-brief.md) | What myvitalharmony.com must show before the Medline URL is handed over |
| [`outreach-templates.md`](outreach-templates.md) | Ready-to-send application and outreach messages per supplier |
| [`../../tools/sku-margin.js`](../../tools/sku-margin.js) | Offline calculator implementing the margin model (Node, no dependencies) |

## Wrong repository — move this package

This is **VitalConnect**, a separate Purdue Global IT499 capstone project. The MyVital
Harmony code lives at **`MyVitalHarmony/myvitalharmony-platform`**.

This package landed here because the session could not attach that repository:
`add_repo` rejects cross-owner adds once a session already holds repos from another owner
(`tovi91-hub`). Reaching the platform repo requires a **new session started with
`MyVitalHarmony/myvitalharmony-platform` as its initial source.**

Everything in this folder is portable — plain Markdown plus one dependency-free Node
script. Move `docs/suppliers/` and `tools/sku-margin.js` into the platform repo, then
delete this branch.

## Sequence

1. Confirm the legal entity, licensing, and insurance in `compliance-prerequisites.md`.
2. Send the Medline dealer drop-ship application (first choice) and the McKesson
   e-commerce enquiry (parallel).
3. Only after a supplier accepts: request catalog/feed/API specifications and design the
   storefront around what they actually provide.
4. Run every candidate SKU through `tools/sku-margin.js` before it is advertised.
