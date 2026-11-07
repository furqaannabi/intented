// The parts of the firewall core this package uses: the chain client that sends propose and execute, and the token
// table. The build points @intented/firewall-core here, so the judge, the prompt and the attestation checker, and
// their dependencies, stay out of the package.
export { createChainClient, type ChainConfig } from "../../firewall-core/src/onchain.js";
export { KNOWN_TOKENS } from "../../firewall-core/src/tokens.js";
export type { Action } from "../../firewall-core/src/canonical.js";
