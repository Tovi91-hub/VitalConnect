# Unit Economics

The rule: **no SKU gets advertised until it clears the margin gate.** The calculator at
[`tools/sku-margin.js`](../../tools/sku-margin.js) implements the gate. Run it before a
product is listed, and re-run it whenever a supplier price list changes.

```
node tools/sku-margin.js --price 79.99 --wholesale 41 --cac 25
node tools/sku-margin.js --examples
node tools/sku-margin.js --help
```

## The formula

```
revenue        = price + shipping charged to customer
fulfillment    = wholesale + dropship fee + outbound freight
processing     = revenue x 2.9% + $0.30            (Stripe)
overhead       = revenue x 3%                      (platform, apps, support)
margin if kept = revenue - fulfillment - processing - overhead

return loss    = outbound freight + inbound freight
                 + wholesale x (1 - recovery rate)
                 + dropship fee + fixed processing fee

expected contribution = (1 - return rate) x margin if kept
                      - return rate x return loss

net contribution = expected contribution - CAC
```

Two things this captures that a naive spreadsheet misses:

1. **A return costs more than the sale earned.** Freight is paid twice, the unit may not be
   resellable, and the fixed processing fee is gone. At a 6% return rate the drag is
   material; on hygiene-adjacent categories where returns cannot be restocked at all
   (set `--recovery-rate 0`), it is severe.
2. **Flat-rate drop-ship shipping punishes cheap SKUs and rewards baskets.** Medline's
   $9.95 flat fee, applied regardless of item count, is nearly the entire margin on a $19
   product and a rounding error on a $189 basket.

## Worked results

Using placeholder wholesale costs at a 15% margin floor:

| SKU | Price | CAC | Net contribution | Verdict |
| --- | --- | --- | --- | --- |
| Blood pressure monitor | $79.99 | $25 | −$4.86 (−6.1%) | Do not advertise |
| Same monitor, organic traffic only | $79.99 | $0 | $20.14 (25.2%) | Advertisable |
| 4-item caregiver collection | $189.00 | $32 | $31.21 (16.5%) | Advertisable |
| Commodity glove box | $18.99 | $12 | −$17.20 | Never profitable |

Three conclusions fall straight out of the table, and they should drive the launch plan:

- **The single-unit commodity monitor cannot carry paid acquisition.** Maximum viable CAC
  on it is about $8, which is not a realistic Google Shopping cost in this category. It
  survives on organic and SEO traffic, or as an attach item — not as an ad-funded hero.
- **The basket is the business.** The same flat freight and fixed fees spread across a
  $189 order support a $35 CAC. This is the quantitative case for the curated-collection
  approach, and it is stronger than the branding argument for it.
- **Low-ticket commodities are structurally negative** under drop-ship freight. They belong
  in the catalog only as add-ons that ride along in an existing shipment, never as
  standalone advertised SKUs.

## Revenue targets

| Target | AOV | Orders/year | Orders/day |
| --- | --- | --- | --- |
| $1M | $100 | 10,000 | 27 |
| $1M | $150 | 6,667 | 18 |
| $5M | $150 | 33,333 | 91 |

At a $31 contribution per order, $1M of revenue at a $150 AOV yields roughly $208K of
contribution before fixed costs — which is what actually has to cover salaries, software,
insurance, and the regulatory work. That figure, not the revenue line, is the one to plan
against.

B2B changes this arithmetic more than any marketing channel does. Ten organizations at
$3,000/month is $360K/year at near-zero acquisition cost and a fraction of the return
rate. The economics argue for putting real effort into home-care agencies, assisted
living, and small clinics early — not treating B2B as a phase-two nicety.

## Inputs still missing

Every number above is a placeholder until these arrive:

- [ ] Actual wholesale price list from an accepted supplier
- [ ] Confirmed per-order drop-ship fee and freight terms
- [ ] Whether the supplier charges freight per shipment or per line item
- [ ] Return authorization terms — restocking fees, who pays inbound freight, what is
      refusable as non-returnable
- [ ] Real category CAC from a small paid test, not an assumed figure
- [ ] Payment processing rate actually offered (healthcare categories sometimes price
      above standard card rates)
