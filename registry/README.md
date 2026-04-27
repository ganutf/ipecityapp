# Ipê Event Registry

Canonical registry of Ipê City events. The `id` of each entry is the
vendor-agnostic identifier we hash onchain — everything else (Luma URL, name,
location) is metadata.

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
