# MyVital Harmony — Supply Chain Package

Working documents for securing U.S. medical-supply distribution **before** any further
build work on the storefront.

| Document | Purpose |
| --- | --- |
| [`supplier-strategy.md`](supplier-strategy.md) | Target suppliers, what each one actually offers, verified facts and open questions |
| [`compliance-prerequisites.md`](compliance-prerequisites.md) | What must exist before a distributor will open an account, and the licensing exposure of the private-label step |
| [`unit-economics.md`](unit-economics.md) | The SKU contribution-margin model and the order-volume math behind the revenue targets |
| [`outreach-templates.md`](outreach-templates.md) | Ready-to-send application and outreach messages per supplier |
| [`../../tools/sku-margin.js`](../../tools/sku-margin.js) | Offline calculator implementing the margin model (Node, no dependencies) |

## Status of this repository

This repository is **VitalConnect** — a static community-wellness site (mood tracking,
prayer wall, help board, blessing marketplace) built for a Purdue Global IT499 capstone,
using HTML/CSS/JS and LocalStorage. It contains no product catalog, cart, checkout,
payment integration, or supplier code of any kind.

Nothing here is an e-commerce storefront yet, so the supply-chain work below is planning
material, not integration work against an existing platform. See the note in
`supplier-strategy.md` under "Positioning claim to verify."

## Sequence

1. Confirm the legal entity, licensing, and insurance in `compliance-prerequisites.md`.
2. Send the Medline dealer drop-ship application (first choice) and the McKesson
   e-commerce enquiry (parallel).
3. Only after a supplier accepts: request catalog/feed/API specifications and design the
   storefront around what they actually provide.
4. Run every candidate SKU through `tools/sku-margin.js` before it is advertised.
