# dApps & tools

Listings for the dApps & tools page of [Kynraze Explorer](https://explorer.kynraze.com). Each listing is a folder with a `listing.json` and two images. CI checks every pull request, and after a merge it rebuilds `index.json`, the single file the Explorer will read.

A listing is not an endorsement.

## Layout

```
chains/<chain>/<id>/    a dApp or tool on one chain
  listing.json
  logo.png              square, at least 96 px, up to 200 KB
  cover.png             at least 1000 px wide, up to 500 KB
shared/<id>/            a tool on several chains (a wallet, an explorer), written once
  listing.json          same fields, plus "chains"
chains.json             the chain slugs the Explorer serves
schema/listing.schema.json
index.json              generated, do not edit
```

Images can be PNG, WebP or JPEG. The cover is cropped to 16:9 on the page; set `coverPosition` if the subject is not in the middle.

## Adding a listing

1. Pick the folder. If the product runs on one chain, use `chains/<chain>/<id>/`. If it runs on two or more, use `shared/<id>/` and list them in `chains`.
2. Write `listing.json`. The folder name is the `id`: lowercase letters, digits and hyphens.
3. Add `logo` and `cover`.
4. Run the checks (below) and open a pull request.

```json
{
  "$schema": "../../../schema/listing.schema.json",
  "id": "districts",
  "name": "Districts",
  "category": "virtual-world",
  "network": "mainnet",
  "status": "open",
  "description": "A real-world themed virtual world where players claim land in real cities.",
  "appUrl": "https://app.districts.xyz/",
  "coverPosition": "center 62%",
  "links": [{ "kind": "website", "href": "https://districts.xyz/" }],
  "explorer": [{ "kind": "analytics", "topic": "districts" }],
  "maintainers": ["your-github-handle"]
}
```

`description` is one or two sentences, up to 220 characters. `appUrl` points at the product itself rather than its marketing page; a `sunset` listing may leave it out and stays on the page marked as sunset. `network` is `mainnet` or `testnet`; a testnet-only product sits on the mainnet chain's page with a Testnet flag. `explorer` links into Explorer pages and takes only the kinds in the schema (`photon`, `governance`, `validator`, `account`, `analytics`), never a free URL. `maintainers` are the GitHub handles who approve later changes to the listing.

## Categories

dApps: `app`, `defi`, `staking`, `rwa`, `nft`, `game`, `virtual-world`, `governance`, `bridge`.

Tools: `wallet`, `explorer`, `analytics`, `monitoring` (validator and node alerting), `developer-tools`, `infrastructure` (RPC, indexers, relayers).

If none fits, say so in the pull request instead of picking the nearest one.

## Checks

Node 20 or later, no install step:

```
node scripts/validate.mjs           # fields, chains, ids, images
node scripts/validate.mjs --links   # also requests every URL
node --test scripts/validate.test.mjs
```

The link check fails on a dead link or a redirect to another site. Sites that turn away bots (403, 429) only print a warning. A weekly run of the link check opens an issue when a listed link stops answering.

See [CONTRIBUTING.md](CONTRIBUTING.md) for what we accept.
