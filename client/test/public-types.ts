// Not a test file: `pnpm typecheck` compiles it, and it fails if types/index.d.ts drifts from src/index.ts.
import * as declared from "../types/index.js";
import * as real from "../src/index.js";

const init: typeof declared.init = real.init;
const pay: typeof declared.pay = (o) => real.pay(o);
const toUnits: typeof declared.toUnits = real.toUnits;
const defaults: typeof declared.defaults = real.defaults;
const result: declared.PayResult = {} as real.PayResult;
const step: declared.PayStep = {} as real.PayStep;
const initResult: declared.InitResult = {} as real.InitResult;
export { init, pay, toUnits, defaults, result, step, initResult };
