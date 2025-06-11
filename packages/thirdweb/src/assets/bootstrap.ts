import { getContract } from "src/contract/contract.js";
import { assetInfraDeployedEvent } from "src/extensions/assets/__generated__/AssetInfraDeployer/events/AssetInfraDeployed.js";
import { deployInfraProxyDeterministic } from "src/extensions/assets/__generated__/AssetInfraDeployer/write/deployInfraProxyDeterministic.js";
import { encodeInitialize } from "src/extensions/assets/__generated__/FeeManager/write/initialize.js";
import { isContractDeployed } from "src/utils/bytecode/is-contract-deployed.js";
import { keccak256 } from "src/utils/hashing/keccak256.js";
import { encodePacked } from "viem";
import { ZERO_ADDRESS } from "~test/addresses.js";
import { getOrDeployInfraContract } from "../contract/deployment/utils/bootstrap.js";
import {
  deployCreate2Factory,
  getDeployedCreate2Factory,
} from "../contract/deployment/utils/create-2-factory.js";
import { getDeployedInfraContract } from "../contract/deployment/utils/infra.js";
import { parseEventLogs } from "../event/actions/parse-logs.js";
import { sendAndConfirmTransaction } from "../transaction/actions/send-and-confirm-transaction.js";
import { keccakId } from "../utils/any-evm/keccak-id.js";
import type {
  ClientAndChain,
  ClientAndChainAndAccount,
} from "../utils/types.js";
import {
  DEFAULT_FEE_BPS,
  DEFAULT_FEE_RECIPIENT,
  DEFAULT_INFRA_ADMIN,
  DEFAULT_SALT,
  IMPLEMENTATIONS,
} from "./constants.js";

export async function deployRewardLocker(options: ClientAndChainAndAccount) {
  let v3PositionManager = ZERO_ADDRESS;
  let v4PositionManager = ZERO_ADDRESS;

  const implementations = IMPLEMENTATIONS[options.chain.id];

  if (implementations) {
    v3PositionManager = implementations.V3PositionManager || ZERO_ADDRESS;
    v4PositionManager = implementations.V4PositionManager || ZERO_ADDRESS;
  }

  let feeManager = await getDeployedFeeManager(options);

  if (!feeManager) {
    feeManager = await deployFeeManager(options);
  }

  return await getOrDeployInfraContract({
    ...options,
    contractId: "RewardLocker",
    constructorParams: {
      _feeManager: feeManager,
      _v3PositionManager: v3PositionManager,
      _v4PositionManager: v4PositionManager,
    },
  });
}

export async function deployFeeManager(options: ClientAndChainAndAccount) {
  // asset factory
  let assetFactory = await getDeployedAssetFactory(options);
  if (!assetFactory) {
    assetFactory = await deployAssetFactory(options);
  }

  // fee manager implementation
  const feeManagerImpl = await getOrDeployInfraContract({
    ...options,
    contractId: "FeeManager",
  });

  // encode init data
  const initData = encodeInitialize({
    owner: DEFAULT_INFRA_ADMIN,
    feeRecipient: DEFAULT_FEE_RECIPIENT,
    defaultFee: DEFAULT_FEE_BPS,
  });

  // fee manager proxy deployment
  const transaction = deployInfraProxyDeterministic({
    contract: assetFactory,
    implementation: feeManagerImpl.address,
    data: initData,
    extraData: "0x",
    salt: keccakId(DEFAULT_SALT),
  });

  const receipt = await sendAndConfirmTransaction({
    transaction,
    account: options.account,
  });
  const proxyEvent = assetInfraDeployedEvent();
  const decodedEvent = parseEventLogs({
    events: [proxyEvent],
    logs: receipt.logs,
  });

  if (decodedEvent.length === 0 || !decodedEvent[0]) {
    throw new Error(
      `No AssetInfraDeployed event found in transaction: ${receipt.transactionHash}`,
    );
  }

  return decodedEvent[0]?.args.proxy;
}

async function deployAssetFactory(options: ClientAndChainAndAccount) {
  // create2 factory
  const create2Factory = await getDeployedCreate2Factory(options);
  if (!create2Factory) {
    await deployCreate2Factory(options);
  }

  // asset factory
  return getOrDeployInfraContract({
    ...options,
    contractId: "AssetInfraDeployer",
  });
}

export async function getDeployedFeeManager(options: ClientAndChain) {
  const [assetFactory, feeManagerImpl] = await Promise.all([
    getDeployedAssetFactory(options),
    getDeployedInfraContract({
      ...options,
      contractId: "FeeManager",
    }),
  ]);

  if (!assetFactory || !feeManagerImpl) {
    return null;
  }

  const initCodeHash = getInitCodeHashERC1967(feeManagerImpl.address);

  const saltHash = keccak256(
    encodePacked(
      ["bytes32", "address"],
      [keccakId(DEFAULT_SALT), DEFAULT_INFRA_ADMIN],
    ),
  );

  const hashedDeployInfo = keccak256(
    encodePacked(
      ["bytes1", "address", "bytes32", "bytes32"],
      ["0xff", assetFactory.address, saltHash, initCodeHash],
    ),
  );

  const feeManagerProxyAddress = `0x${hashedDeployInfo.slice(26)}`;
  const feeManagerProxy = getContract({
    client: options.client,
    chain: options.chain,
    address: feeManagerProxyAddress,
  });

  if (!(await isContractDeployed(feeManagerProxy))) {
    return null;
  }

  return feeManagerProxyAddress;
}

async function getDeployedAssetFactory(args: ClientAndChain) {
  const assetFactory = await getDeployedInfraContract({
    ...args,
    contractId: "AssetInfraDeployer",
  });
  if (!assetFactory) {
    return null;
  }
  return assetFactory;
}

function getInitCodeHashERC1967(implementation: string) {
  // See `initCodeHashERC1967` - LibClone {https://github.com/vectorized/solady/blob/main/src/utils/LibClone.sol}
  return keccak256(
    `0x603d3d8160223d3973${implementation.toLowerCase().replace(/^0x/, "")}60095155f3363d3d373d3d363d7f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc545af43d6000803e6038573d6000fd5b3d6000f3`,
  );
}
