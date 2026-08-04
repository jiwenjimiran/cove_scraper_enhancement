import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, normalizeSettings } from "../src/api.js";

test("settings default to five and five",()=>assert.deepEqual(normalizeSettings(),DEFAULT_SETTINGS));
test("settings are rounded and clamped",()=>assert.deepEqual(normalizeSettings({batchSize:200.2,pauseSeconds:-1}),{batchSize:100,pauseSeconds:0}));
test("invalid settings fall back independently",()=>assert.deepEqual(normalizeSettings({batchSize:"nope",pauseSeconds:12}),{batchSize:5,pauseSeconds:12}));
