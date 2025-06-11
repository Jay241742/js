import type { Hex } from "viem";
import type { ThirdwebClient } from "../client/client.js";
import { ZERO_ADDRESS } from "../constants/addresses.js";
import { getContract } from "../contract/contract.js";
import { createAsset } from "../extensions/assets/__generated__/AssetEntrypointERC20/write/createAsset.js";
import { encodeInitialize } from "../extensions/assets/__generated__/ERC20Asset/write/initialize.js";
import { eth_blockNumber } from "../rpc/actions/eth_blockNumber.js";
import { getRpcClient } from "../rpc/rpc.js";
import { upload } from "../storage/upload.js";
import type { FileOrBufferOrString } from "../storage/upload/types.js";
import { sendTransaction } from "../transaction/actions/send-transaction.js";
import { keccakId } from "../utils/any-evm/keccak-id.js";
import { toHex } from "../utils/encoding/hex.js";
import type { ClientAndChainAndAccount } from "../utils/types.js";
import { DEFAULT_MAX_SUPPLY_ERC20 } from "./constants.js";
import { getEntrypointERC20 } from "./get-entrypoint-erc20.js";

export type TokenParams = {
  name: string;
  description?: string;
  image?: FileOrBufferOrString;
  external_link?: string;
  social_urls?: Record<string, string>;
  symbol?: string;
  contractURI?: string;
  maxSupply?: bigint;
  owner?: string;
};

export type CreateTokenOptions = ClientAndChainAndAccount & {
  salt?: string;
  params: TokenParams;
};

export async function createToken(options: CreateTokenOptions) {
  const { chain, client, account, params } = options;

  const creator = params.owner || account.address;

  const encodedInitData = await encodeInitParams({
    client,
    params,
    creator,
  });

  const rpcRequest = getRpcClient({
    ...options,
  });
  const blockNumber = await eth_blockNumber(rpcRequest);
  const salt = options.salt
    ? options.salt.startsWith("0x") && options.salt.length === 66
      ? (options.salt as `0x${string}`)
      : keccakId(options.salt)
    : toHex(blockNumber, {
        size: 32,
      });

  const entrypointAddress = await getEntrypointERC20(chain);
  const entrypoint = getContract({
    client,
    address: entrypointAddress,
    chain,
  });

  const transaction = createAsset({
    contract: entrypoint,
    creator,
    createParams: {
      amount: params.maxSupply || DEFAULT_MAX_SUPPLY_ERC20,
      referrer: ZERO_ADDRESS,
      salt,
      data: encodedInitData,
      hookData: "0x",
    },
  });

  return await sendTransaction({ account, transaction });
}

async function encodeInitParams(options: {
  client: ThirdwebClient;
  params: TokenParams;
  creator: string;
}): Promise<Hex> {
  const { client, params, creator } = options;

  const contractURI =
    options.params.contractURI ||
    (await upload({
      client,
      files: [
        {
          name: params.name,
          description: params.description,
          symbol: params.symbol,
          image: params.image,
          external_link: params.external_link,
          social_urls: params.social_urls,
        },
      ],
    })) ||
    "";

  return encodeInitialize({
    name: params.name,
    symbol: params.symbol || params.name,
    contractURI,
    maxSupply: params.maxSupply || DEFAULT_MAX_SUPPLY_ERC20,
    owner: creator,
  });
}
