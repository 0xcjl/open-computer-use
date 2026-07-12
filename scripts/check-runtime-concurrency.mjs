import assert from "node:assert/strict";
import { ResourceScheduler, StateStore, StaleResourceStateError } from "../src/runtime.ts";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const states = new StateStore(2);
const first = states.create("pid:1", 0, { label: "first" });
states.create("pid:2", 0, { label: "second" });
states.create("pid:3", 0, { label: "third" });
assert.equal(states.get(first.stateId), undefined, "bounded state store did not evict oldest state");

const scheduler = new ResourceScheduler();
let active = 0;
let peak = 0;
const work = async () => {
	active += 1;
	peak = Math.max(peak, active);
	await sleep(25);
	active -= 1;
};
await Promise.all([
	scheduler.read("pid:1", work),
	scheduler.read("pid:2", work),
]);
assert.equal(peak, 2, "different resources did not overlap");

active = 0;
peak = 0;
await Promise.all([
	scheduler.read("pid:3", work),
	scheduler.read("pid:3", work),
]);
assert.equal(peak, 1, "same-resource operations overlapped");

await scheduler.write("pid:4", 0, async () => undefined);
await assert.rejects(
	() => scheduler.readAt("pid:4", 0, async () => undefined),
	(error) => error instanceof StaleResourceStateError,
);
await assert.rejects(
	() => scheduler.write("pid:4", 0, async () => undefined),
	(error) => error instanceof StaleResourceStateError,
);

await scheduler.close();
console.log("Runtime concurrency checks passed.");
