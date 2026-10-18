# dApps & tools

What shows up on the dApps & tools page of [Kynraze Explorer](https://explorer.kynraze.com). Open a PR to add yours.

```
chains/<chain>/<id>/   on one chain
shared/<id>/           on several chains (add "chains": [...])
```

Each folder has `listing.json`, `logo.png` (square, 96 px or more) and `cover.png` (1000 px wide or more). WebP and JPEG work too. Copy one of the Realio listings as a starting point; the fields are in [schema/listing.schema.json](schema/listing.schema.json).

Categories:

- dApps: `app`, `defi`, `staking`, `rwa`, `nft`, `game`, `virtual-world`, `governance`, `bridge`
- Tools: `wallet`, `explorer`, `analytics`, `monitoring`, `developer-tools`, `infrastructure`

Before opening the PR:

```
node scripts/check.mjs --links
```

Don't edit `index.json`, CI rebuilds it after the merge.

Being listed here isn't an endorsement. See [CONTRIBUTING.md](CONTRIBUTING.md).
