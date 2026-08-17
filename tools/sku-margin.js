#!/usr/bin/env node
/**
 * SKU contribution-margin calculator for MyVital Harmony.
 *
 * Offline planning tool. No dependencies, no network, no relation to the
 * VitalConnect site code. Run a SKU through this before it is listed or advertised.
 *
 *   node tools/sku-margin.js --price 79.99 --wholesale 41.00 --cac 25
 *   node tools/sku-margin.js --examples
 *   node tools/sku-margin.js --help
 *
 * See docs/suppliers/unit-economics.md for what each input means and where to get it.
 */

'use strict';

const DEFAULTS = {
  price: 0,             // what the customer pays for the product
  shippingCharged: 0,   // shipping revenue collected from the customer
  wholesale: 0,         // supplier cost of goods
  dropshipFee: 0,       // per-order handling fee charged by the supplier
  freight: 9.95,        // outbound shipping cost (Medline flat drop-ship rate)
  processingPct: 0.029, // Stripe variable rate
  processingFixed: 0.3, // Stripe per-transaction fee
  overheadPct: 0.03,    // platform, apps, support, packaging inserts
  returnRate: 0.06,     // share of orders returned
  recoveryRate: 0.5,    // share of wholesale cost recovered on a returned unit
  returnFreight: 9.95,  // inbound cost of a return
  cac: 0,               // paid acquisition cost per order
  minMarginPct: 0.15,   // required contribution margin as a share of revenue
};

const NUMERIC = new Set(Object.keys(DEFAULTS));

function computeUnitEconomics(input) {
  const p = { ...DEFAULTS, ...input };

  const revenue = p.price + p.shippingCharged;
  const processing = revenue * p.processingPct + p.processingFixed;
  const overhead = revenue * p.overheadPct;
  const fulfillment = p.wholesale + p.dropshipFee + p.freight;

  // Margin on an order that is kept.
  const keptMargin = revenue - fulfillment - processing - overhead;

  // Cost of an order that comes back: revenue refunded, product partly recovered,
  // freight paid both directions, fixed processing fee generally not returned.
  const returnLoss =
    p.freight +
    p.returnFreight +
    p.wholesale * (1 - p.recoveryRate) +
    p.dropshipFee +
    p.processingFixed;

  const expected = (1 - p.returnRate) * keptMargin - p.returnRate * returnLoss;
  const afterCac = expected - p.cac;

  const requiredMargin = p.minMarginPct * revenue;
  const maxCac = expected - requiredMargin;
  const breakevenRoas = expected > 0 ? revenue / expected : Infinity;

  return {
    inputs: p,
    revenue,
    fulfillment,
    processing,
    overhead,
    keptMargin,
    returnLoss,
    expectedContribution: expected,
    contributionAfterCac: afterCac,
    marginPct: revenue > 0 ? afterCac / revenue : 0,
    requiredMargin,
    maxCac,
    breakevenRoas,
    advertisable: revenue > 0 && afterCac >= requiredMargin,
  };
}

/** Orders per day and per year implied by a revenue target at a given AOV. */
function volumeForTarget(annualRevenue, aov) {
  const orders = annualRevenue / aov;
  return { orders, ordersPerDay: orders / 365 };
}

const money = (n) => `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`;
const pct = (n) => `${(n * 100).toFixed(1)}%`;

function report(label, r) {
  const lines = [
    ``,
    `${label}`,
    `${'-'.repeat(Math.max(label.length, 44))}`,
    `  Revenue per order          ${money(r.revenue)}`,
    `  Fulfillment (COGS+fees)   -${money(r.fulfillment)}`,
    `  Payment processing        -${money(r.processing)}`,
    `  Overhead                  -${money(r.overhead)}`,
    `  Margin if kept             ${money(r.keptMargin)}`,
    `  Cost of a return           ${money(r.returnLoss)} at ${pct(r.inputs.returnRate)} return rate`,
    `  Expected contribution      ${money(r.expectedContribution)}`,
    `  Acquisition cost          -${money(r.inputs.cac)}`,
    `  Net contribution           ${money(r.contributionAfterCac)}  (${pct(r.marginPct)} of revenue)`,
    ``,
    `  Max CAC at ${pct(r.inputs.minMarginPct)} floor    ${money(r.maxCac)}`,
    `  Break-even ROAS            ${Number.isFinite(r.breakevenRoas) ? r.breakevenRoas.toFixed(2) + 'x' : 'never profitable'}`,
    `  Verdict                    ${r.advertisable ? 'ADVERTISABLE' : 'DO NOT ADVERTISE'}`,
  ];
  if (!r.advertisable) {
    const gap = r.requiredMargin - r.contributionAfterCac;
    lines.push(
      `  Shortfall                  ${money(gap)} per order — raise price, cut CAC, or drop the SKU`
    );
  }
  console.log(lines.join('\n'));
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const [rawKey, inlineValue] = arg.slice(2).split('=');
    const key = rawKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (key === 'help' || key === 'examples') {
      out[key] = true;
      continue;
    }
    const value = inlineValue !== undefined ? inlineValue : argv[++i];
    if (!NUMERIC.has(key)) {
      throw new Error(`Unknown option --${rawKey}. Run with --help for the list.`);
    }
    const num = Number(value);
    if (!Number.isFinite(num)) {
      throw new Error(`Option --${rawKey} needs a number, got "${value}".`);
    }
    out[key] = num;
  }
  return out;
}

function usage() {
  console.log(`
SKU contribution-margin calculator — MyVital Harmony

Usage:
  node tools/sku-margin.js [--option value ...]
  node tools/sku-margin.js --examples

Options (defaults in parentheses):`);
  for (const [key, value] of Object.entries(DEFAULTS)) {
    const flag = `--${key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`;
    console.log(`  ${flag.padEnd(20)} (${value})`);
  }
  console.log(`
Rates are decimals: 0.029 means 2.9%. Percent-style options are
processing-pct, overhead-pct, return-rate, recovery-rate, min-margin-pct.
`);
}

function examples() {
  console.log('\nIllustrative SKUs. Wholesale figures are placeholders until a supplier');
  console.log('price list is in hand — replace them before drawing any conclusion.\n');

  report(
    'Blood pressure monitor @ $79.99, paid traffic',
    computeUnitEconomics({ price: 79.99, wholesale: 41, cac: 25 })
  );
  report(
    'Same SKU, free shipping absorbed, no paid traffic',
    computeUnitEconomics({ price: 79.99, wholesale: 41, cac: 0 })
  );
  report(
    'Curated 4-item caregiver collection @ $189, one flat-rate shipment',
    computeUnitEconomics({ price: 189, wholesale: 96, cac: 32 })
  );
  report(
    'Commodity glove box @ $18.99 — the classic trap',
    computeUnitEconomics({ price: 18.99, wholesale: 11.5, cac: 12 })
  );

  console.log('\n\nOrder volume required by revenue target');
  console.log('--------------------------------------------');
  for (const [target, aov] of [
    [1e6, 100],
    [1e6, 150],
    [5e6, 150],
  ]) {
    const v = volumeForTarget(target, aov);
    console.log(
      `  $${(target / 1e6).toFixed(0)}M/yr at $${aov} AOV: ` +
        `${Math.round(v.orders).toLocaleString()} orders/yr, ` +
        `${v.ordersPerDay.toFixed(0)}/day`
    );
  }
  console.log('');
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  if (args.help) return usage();
  if (args.examples) return examples();
  if (!args.price) {
    usage();
    console.log('No --price given. Showing worked examples instead:\n');
    return examples();
  }

  report(`SKU @ ${money(args.price)}`, computeUnitEconomics(args));
  console.log('');
}

if (require.main === module) main();

module.exports = { computeUnitEconomics, volumeForTarget, DEFAULTS };
