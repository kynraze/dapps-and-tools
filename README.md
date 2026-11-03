# dApps & tools

What shows up on the dApps & tools page of [Kynraze Explorer](https://explorer.kynraze.com). Open a PR to add yours.

```
chains/<chain>/<id>/   on one chain
shared/<id>/           on several chains (add "chains": [...])
```

The folder name is the listing's id: lowercase letters, digits and dashes.

`listing.json` needs four fields:

```json
{
  "name": "Freehold Wallet",
  "category": "wallet",
  "description": "A non-custodial, multi-chain DeFi wallet built on Realio's infrastructure.",
  "appUrl": "https://app.freehold.finance/"
}
```

Add `links` for your socials (website, docs, token, x, telegram, discord, github, ios, android) if you have them, and `"network": "testnet"` if the app only runs on a testnet. `explorer` is filled in by Kynraze during review.

Each folder also has `logo.png`. The logo is a PNG, square, 96 px or more. Best is an opaque one with its own background: the card then takes its colour from the logo's edge. A logo with a transparent edge still passes and sits on a neutral tile. The cover is optional: `cover.png`, `.webp` or `.jpg`, 1000 px wide or more. Copy one of the Realio listings as a starting point; the fields are in [schema/listing.schema.json](schema/listing.schema.json).

Categories:

- dApps: `app`, `defi`, `staking`, `rwa`, `nft`, `game`, `virtual-world`, `governance`, `bridge`
- Tools: `wallet`, `explorer`, `analytics`, `monitoring`, `developer-tools`, `infrastructure`

Before opening the PR:

```
node scripts/check.mjs --links
```

Don't edit `index.json` or `probe.json`, CI rebuilds them after the merge and every day. The daily run opens each `appUrl`: after three days without an answer the card says "Not responding", and after 30 days a maintainer gets an issue to review the listing.

Being listed here isn't an endorsement. See [CONTRIBUTING.md](CONTRIBUTING.md).
