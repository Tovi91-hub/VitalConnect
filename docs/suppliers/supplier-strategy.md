# Supplier Strategy

## Positioning claim to verify

The strategy assumes MyVital Harmony is "already positioned as an online medical-supply
retailer." That is not visible from anything available here:

- The only repository in scope is `Tovi91-hub/VitalConnect`, a static wellness-community
  capstone site. No catalog, cart, checkout, payments, or fulfillment code exists in it.
- No `myvitalharmony.com` codebase, product data, or order history is available to review.

This matters for supplier applications, because every distributor below asks what the
applicant currently sells, through what channel, and at what volume. If the storefront is
not live and transacting, the honest framing is **launching retailer**, not established
retailer. Distributors do open accounts for pre-launch businesses, but the application
should say so — a claim they can disprove in one browser visit costs the account.

Before sending anything, confirm which of these is true:

- [ ] MyVitalHarmony.com is live and selling today (share URL + monthly order volume)
- [ ] It is live but not yet selling medical supplies
- [ ] It is not yet built

## Tier 1 — Medline (first approach)

**Program:** Dealer Drop Ship Program. Product stays in Medline's distribution centers
until sold, then ships direct to the customer.

Verified from Medline's own program pages:

- Catalog access of **5,000+ items** without carrying inventory.
- Ships from **36 distribution centers** via FedEx.
- **Flat $9.95 shipping fee** per shipment regardless of item count — a hard input to the
  margin model, and a favorable one for multi-item bundles.
- Categories: durable equipment, respiratory, incontinence, gloves, enterals, diabetes
  care, and more.
- Qualified dealers get HMEOS, a patient-specific ordering system.
- Contact path: 1-800-MEDLINE, plus the partner/account request form.

**The caveat to plan around:** it is branded a *Dealer* Drop Ship Program and the
supporting literature is aimed at **HME (home medical equipment) providers**. Expect
qualification questions oriented toward provider/dealer status rather than general
e-commerce. Ask directly on the first call whether a DTC e-commerce retailer without HME
provider accreditation qualifies, and if not, what the alternative account type is. Do not
let this question go unanswered through three weeks of email.

**Why first:** the flat shipping rate, the breadth, and the fact that the drop-ship model
is a published program rather than an exception to be negotiated.

## Tier 1 — McKesson Medical-Surgical (parallel approach)

**Program:** e-commerce services including pick, pack, and ship direct to patients, on a
very large catalog.

**The blocking issue is real and confirmed.** McKesson's standard Terms of Sale restrict
purchases to the buyer's **"own use"** — merchandise is sold on the understanding it is
for use in the purchaser's own medical practice and *not* for further sale or resale by
retailers, wholesalers, or other parties. Their terms further define "Diversion" to cover
sale or transfer of product to any unauthorized third party. Resale requires an authorized
relationship.

So the sequence is strict: **do not open a standard SupplyManager account and start
listing McKesson products on the storefront.** That is a terms violation, and the remedy
is account termination plus whatever contractual exposure follows. Approach them only
through the e-commerce services / authorized-reseller path, and get the resale permission
in writing before a single SKU is published.

Framing for the enquiry:

> MyVital Harmony LLC, an online medical-supply retailer seeking an authorized e-commerce
> reseller / direct-to-consumer fulfillment relationship.

**Why second:** the upside is the larger catalog, but the contractual gate is higher and
slower. Run it in parallel; do not wait on it.

## Tier 2 — Meddcare LLC

Advertises wholesale, B2B, DTC, dropshipping, and distributor programs explicitly aimed at
online retailers; California-based. Smaller and faster-moving than the majors, which makes
it a plausible **bridge supplier** — something to launch on while Medline or McKesson
qualification runs its course.

Diligence before relying on it: years in business, whether it holds the state distributor
licensing described in `compliance-prerequisites.md`, which brands it is authorized to
distribute, return/recall handling, lot traceability, and whether it ships from its own
U.S. warehouse or brokers to another party. A supplier that cannot answer lot traceability
is not usable for anything regulated.

## Excluded from the core catalog — Doba

Automated dropshipping, U.S. inventory, real-time inventory sync, and platform
integrations — genuinely useful plumbing, but it is a general dropshipping marketplace,
not a healthcare distributor. Chain of custody, recall reach, and authorized-brand status
are the things a medical brand is actually buying from a distributor, and a general
marketplace does not provide them.

Acceptable use: non-regulated wellness accessories (pill organizers, grabbers, cushions,
bags). Not acceptable: anything that is an FDA-regulated device, anything sterile,
anything with a lot number that could be recalled.

## Decision rule for any future supplier

Accept only if all five are true:

1. It is an authorized distributor of the brands it sells (not a broker of grey-market stock).
2. It will confirm resale/DTC permission **in writing**.
3. It provides lot/serial traceability and a defined recall process.
4. It provides a product data feed or API — not a PDF catalog to retype.
5. Its returns policy on opened/unopened medical goods is written down and survivable.

## Sources

- [Medline — Dealer Drop Ship Program](https://www.medline.com/jump/content/supply-solutions/hme-providers/drop-ship-program)
- [Medline — Dealer Drop Ship Program (overview page)](https://www.medline.com/pages/dealer-drop-ship-program/)
- [Medline — HME Provider Programs brochure (PDF)](https://www.medline.com/media/catalog/Docs/MKT/LIT485R_BRO_UpdateHMEPrograms_tk2_21.pdf)
- [McKesson Medical-Surgical — Supply Terms of Sale (PDF)](https://imgcdn.mckesson.com/CumulusWeb/SMO_Legal_Documents/TermsofSale_EC.pdf)
- [McKesson Medical-Surgical — Terms and Conditions of Sale (PDF)](https://sites.mckesson.com/mscs/images/MSCS_Terms_and_Conditions_102008.pdf)
- [McKesson Customer Center Terms and Conditions (PDF)](https://cms.mscs.mckesson.com/wp-content/uploads/2021/07/MCKESSON-CUSTOMER-CENTER-TERMS-AND-CONDITIONS_Rev.-July-2021.pdf)
