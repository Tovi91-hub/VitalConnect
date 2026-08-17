# Website Repositioning Brief — Medline Reviewer Readiness

> **Portable document.** This describes work on `MyVitalHarmony/myvitalharmony-platform`,
> not on VitalConnect. It lives here only because this session cannot attach that
> repository (see README). Move it with the rest of `docs/suppliers/` once a session has
> access to the platform repo.

## The problem, stated as a reviewer would see it

A Medline account reviewer opens myvitalharmony.com and needs to answer one question:
*is this a medical-supply retailer?* Today the homepage answers a different question. It
presents an operating system for independent healthcare and wellness businesses —
scheduling, Stripe payments, secure messaging, programs, AI, $19/$49/$129 subscription
tiers — plus links to a Benin pharmacy network.

The application says "I want to buy and resell your medical products." The website says
"I sell practice-management software." Those do not reconcile, and the reviewer has no
obligation to resolve the contradiction in the applicant's favor.

## What Medline's own paperwork actually says

Verified against Medline's published documents, because the application answers must match
what the site shows:

1. **Internet resale is contemplated, with a specific restriction.** The customer credit
   application asks whether the applicant intends to resell Medline products to any third
   party that sells via the internet, and asks for those third parties to be named. This is
   narrower than "do you sell online" — it is aimed at reseller-to-reseller supply.
2. **The critical line for this business model:** customers agree not to resell Medline
   brand products to other distributors and retailers for resale purposes, but to sell
   Medline brand products **only to customers for their own use.** A DTC storefront selling
   to consumers and to care facilities that consume the product is squarely within that.
   A wholesale-to-other-resellers model is not. This is a point in favor of the plan — but
   it means the site must read as a *retailer selling to end users*, not as a distributor
   or marketplace intermediary.
3. **Resale certificate must match the purchasing entity.** A valid tax exemption or resale
   certificate has to be received before an account is established, and the "sold to"
   entity name must match the legal name on the certificate exactly. Some states also
   require a No Nexus form alongside a home-state resale certificate. Get the certificate
   issued to **MyVital Harmony LLC** precisely as registered — not a DBA, not a variant.
4. **Authorized online retail is an established channel.** Medline maintains a consumer
   "Find a Retailer" page, and the authorized online sellers of Medline product include
   Parentgiving, Rehabmart, Allegro Medical, Health Products For You, CIA Medical, and DME
   of America, alongside CVS, Target, and Amazon. That is both proof the model exists and a
   preview of the competitive set — every one of those sites is what the reviewer will
   mentally compare myvitalharmony.com against.

## Target state

**Homepage headline:**

> Medical & Home Health Supplies You Can Depend On
> Quality healthcare, mobility, personal-care, monitoring, recovery, and caregiver
> essentials delivered directly to your door.

**Primary navigation:** Shop · Home Health · Mobility & Safety · Wound Care · PPE ·
Caregiver Supplies · About · Contact

**Page inventory a reviewer will check:**

| Page | Must contain | Status |
| --- | --- | --- |
| Homepage | Retail positioning, category entry points, no SaaS pricing tiers | ☐ |
| Shop / category pages | Real browsable catalog structure, even at launch depth | ☐ |
| About | MyVital Harmony LLC identified as a U.S. online medical and home-health supply retailer; state of registration | ☐ |
| Contact | Business phone, monitored email, hours, business mailing address | ☐ |
| Shipping | Carriers, processing time, destinations, costs | ☐ |
| Returns & Refunds | Window, condition requirements, non-returnable categories (opened hygiene/PPE), RMA process | ☐ |
| Privacy Policy | Data collected, processors, contact for requests | ☐ |
| Terms of Service | Governing entity, jurisdiction, order acceptance | ☐ |
| Product/medical disclaimer | Not medical advice; consult a clinician; OTC use only; follow manufacturer instructions | ☐ |
| Checkout | HTTPS, visible payment marks, no broken flows | ☐ |

The returns policy carries double weight: it is a trust signal to the reviewer *and* a
direct input to the margin model, since who pays inbound freight and what is refusable as
non-returnable determines the return-loss figure in `unit-economics.md`.

## Hard constraints during the build

- **Do not list Medline products, SKUs, images, or copy before authorization.** Medline's
  terms restrict use of its website content and intellectual property, and a reviewer
  finding scraped Medline content on an applicant's site is a decisive negative. Build the
  starter catalog from suppliers already authorized, or from own-photographed generic
  categories, or as clearly-labeled category placeholders.
- **Do not claim to be a Medline dealer, authorized retailer, or partner.** Not in copy,
  not in meta tags, not in a logo strip.
- **Do not imply inventory that does not exist.** "Preparing our catalog" is a legitimate
  and defensible state for a launching retailer. Invented stock counts are not.
- **Claims discipline applies to every line of new copy** — see
  `compliance-prerequisites.md`, Part 4. No "medical grade," no "FDA approved" as a
  generic reassurance, no outcome promises in category or bundle names.

## Preserving the SaaS platform

The provider platform code should not be deleted. Options, in order of preference:

1. **Move to `providers.myvitalharmony.com`** — keeps the investment live and addressable,
   clears the root domain for retail. Requires the marketing pages to move with it.
2. **Keep the routes, remove them from primary navigation** — faster, but a reviewer
   following a footer link still lands on subscription pricing. Acceptable only if the
   pages are clearly scoped as a separate product.
3. **Dormant behind a flag** — lowest effort, zero reviewer risk, but the work becomes
   invisible to everyone including future customers.

The Benin pharmacy network should come off the root domain entirely for now. It is the
single most confusing element for a U.S. distributor reviewing a U.S. reseller
application, and per the strategy it is a later-phase project regardless.

## Sequence

1. Reposition the public site to the target state above.
2. Verify every page in the inventory table renders and is linked.
3. Confirm the resale certificate is issued to the exact registered entity name.
4. Have the insurance certificate and EIN in hand.
5. *Then* submit the Medline application, with the site URL, answering the internet-resale
   question accurately: selling direct to end customers, not supplying other resellers.

## Sources

- [Medline — Customer Credit Application and Agreement (PDF)](https://www.medline.com/media/assets/pdf/MEDCAL_SALES_Credit_Application.pdf)
- [Medline — Documents and Forms](https://www.medline.com/pages/documents-and-forms/)
- [Medline — Consumer Find a Retailer](https://www.medline.com/about-us/who-we-serve/consumer/find-a-retailer/)
- [Medline — Dealer Drop Ship Program](https://www.medline.com/jump/content/supply-solutions/hme-providers/drop-ship-program)
