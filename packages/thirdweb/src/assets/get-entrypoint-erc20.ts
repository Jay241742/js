import type { Chain } from "../chains/types.js";
import { IMPLEMENTATIONS } from "./constants.js";

export async function getEntrypointERC20(chain: Chain): Promise<string> {
  // TODO: bootstrap all infra

  const implementations = IMPLEMENTATIONS[chain.id];

  if (!implementations) {
    throw new Error(`Entrypoint not found for chain: ${chain.id}`);
  }

  const entrypointAddress = implementations.AssetEntrypointERC20;

  if (!entrypointAddress) {
    throw new Error(`Entrypoint not found for chain: ${chain.id}`);
  }

  return entrypointAddress;
}
