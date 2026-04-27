# Ipê Registry

Canonical registry of Ipê City onchain artefacts:

- [`events.json`](./events.json) — canonical Ipê event identifiers and metadata.
- [`schemas.json`](./schemas.json) — EAS schema UIDs and ABIs deployed for the
  Ipê platform.

The `id` of each event is the vendor-agnostic identifier we hash onchain —
everything else (Luma URL, name, location) is metadata.

## Onchain hash

The `bytes32` onchain value for any event is:

```
keccak256(toUtf8Bytes(id))
```

Once an `id` has been referenced onchain it **must never change**. Add new
entries; do not edit existing ones. Renaming an `id` will permanently
detach onchain data from its registry record.

## Fetching

Files are served via raw GitHub URLs and can be fetched from any client. The
canonical URL for `events.json`:

```
https://raw.githubusercontent.com/ganutf/ipecityapp/main/registry/events.json
```

## Lookup by hash

```js
import { keccak256, toUtf8Bytes } from "ethers";
import events from "./events.json" with { type: "json" };

function eventByHash(targetHash) {
  return events.events.find(
    e => keccak256(toUtf8Bytes(e.id)) === targetHash
  );
}
```

## Recurring events

Events that recur (e.g. a daily breakfast during a Village) use date-suffixed
IDs so each instance has a stable, unique hash:

```
ipe-breakfast-open-mic-2026-04-06
ipe-breakfast-open-mic-2026-04-07
ipe-breakfast-open-mic-2026-04-08
```

Singletons keep their bare ID (e.g. `ipe-village-2026`, `ipe-demo-day`).

## Schemas

`schemas.json` records the EAS schema UIDs and ABIs that the Ipê platform
attests against. Each schema UID is content-addressed by EAS — it changes if
the ABI changes. Same immutability rule applies: **never edit a published
schema entry**. To revise an ABI, register a new schema with EAS and add it as
a new key in `schemas.json` (e.g. `IpeCheckinV2`).

Canonical URL:

```
https://raw.githubusercontent.com/ganutf/ipecityapp/main/registry/schemas.json
```

Lookup by name:

```js
import schemas from "./schemas.json" with { type: "json" };

const checkinUid = schemas.schemas.IpeCheckin.uid;
const easContract = schemas.easContract;
const chainId = schemas.chainId;
```

The current set lives on **Base Sepolia** (`chainId: 84532`) at the canonical
EAS contract `0x4200000000000000000000000000000000000021`. Deploying to
mainnet will require re-registering the schemas (UIDs are per-network) and
publishing a separate `schemas.base.json` (or bumping `schemaVersion`).

