"use client";

import { MultiStepStatus } from "@/components/blocks/multi-step-status/multi-step-status";
import type { MultiStepState } from "@/components/blocks/multi-step-status/multi-step-status";
import { WalletAddress } from "@/components/blocks/wallet-address";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionButton } from "components/buttons/TransactionButton";
import { useTrack } from "hooks/analytics/useTrack";
import {
  ArrowRightIcon,
  ArrowUpFromLineIcon,
  ImageOffIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { type ThirdwebClient, defineChain } from "thirdweb";
import { TokenProvider, TokenSymbol, useActiveWallet } from "thirdweb/react";
import { parseError } from "utils/errorParser";
import { ChainOverview } from "../../_common/chain-overview";
import { FilePreview } from "../../_common/file-preview";
import { StepCard } from "../../_common/step-card";
import type {
  CreateNFTCollectionAllValues,
  CreateNFTCollectionFunctions,
} from "../_common/form";
import { getNFTLaunchTrackingData } from "../_common/tracking";

const stepIds = {
  "deploy-contract": "deploy-contract",
  "set-claim-conditions": "set-claim-conditions",
  "mint-nfts": "mint-nfts",
} as const;

type StepId = keyof typeof stepIds;

export function LaunchNFT(props: {
  createNFTFunctions: CreateNFTCollectionFunctions;
  values: CreateNFTCollectionAllValues;
  onPrevious: () => void;
  client: ThirdwebClient;
  onLaunchSuccess: () => void;
  teamSlug: string;
  projectSlug: string;
}) {
  const formValues = props.values;
  const [steps, setSteps] = useState<MultiStepState<StepId>[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const activeWallet = useActiveWallet();
  const walletRequiresApproval = activeWallet?.id !== "inApp";
  const [contractLink, setContractLink] = useState<string | null>(null);
  const trackEvent = useTrack();

  function updateStatus(
    index: number,
    newStatus: MultiStepState<StepId>["status"],
  ) {
    setSteps((prev) => {
      return [
        ...prev.slice(0, index),
        { ...prev[index], status: newStatus },
        ...prev.slice(index + 1),
      ] as MultiStepState<StepId>[];
    });
  }

  function updateDescription(index: number, description: string) {
    setSteps((prev) => {
      return [
        ...prev.slice(0, index),
        { ...prev[index], description },
        ...prev.slice(index + 1),
      ] as MultiStepState<StepId>[];
    });
  }

  function launchTracking(
    params:
      | {
          type: "attempt" | "success";
        }
      | {
          type: "error";
          errorMessage: string;
        },
  ) {
    trackEvent(
      getNFTLaunchTrackingData({
        chainId: Number(formValues.collectionInfo.chain),
        ercType: ercType,
        ...params,
      }),
    );
  }

  async function handleSubmitClick() {
    launchTracking({
      type: "attempt",
    });

    const initialSteps: MultiStepState<StepId>[] = [
      {
        label: "Deploy contract",
        id: stepIds["deploy-contract"],
        status: { type: "idle" },
      },
      {
        label: formValues.nfts.length > 1 ? "Mint NFTs" : "Mint NFT",
        id: stepIds["mint-nfts"],
        status: { type: "idle" },
      },
      {
        label:
          formValues.nfts.length > 1
            ? "Set claim conditions"
            : "Set claim condition",
        id: stepIds["set-claim-conditions"],
        status: { type: "idle" },
      },
    ];

    setSteps(initialSteps);
    setIsModalOpen(true);
    executeSteps(initialSteps, 0);
  }

  const batchesProcessedRef = useRef(0);
  const batchSize = 50;
  const batchCount =
    formValues.nfts.length > batchSize
      ? Math.ceil(formValues.nfts.length / batchSize)
      : 1;

  const ercType: "erc721" | "erc1155" = useMemo(() => {
    // if all prices (amount + currency) are same and all supply is to 1
    const shouldDeployERC721 = formValues.nfts.every((nft) => {
      return (
        nft.supply === "1" &&
        formValues.nfts[0] &&
        nft.price_amount === formValues.nfts[0].price_amount &&
        nft.price_currency === formValues.nfts[0].price_currency
      );
    });

    return shouldDeployERC721 ? "erc721" : "erc1155";
  }, [formValues.nfts]);

  async function executeStep(steps: MultiStepState<StepId>[], stepId: StepId) {
    if (stepId === "deploy-contract") {
      const result =
        await props.createNFTFunctions[ercType].deployContract(formValues);
      setContractLink(
        `/team/${props.teamSlug}/${props.projectSlug}/contract/${formValues.collectionInfo.chain}/${result.contractAddress}`,
      );
    } else if (stepId === "set-claim-conditions") {
      if (ercType === "erc721") {
        await props.createNFTFunctions.erc721.setClaimConditions(formValues);
      } else {
        if (batchCount > 1) {
          const batchStartIndex = batchesProcessedRef.current;
          for (
            let batchIndex = batchStartIndex;
            batchIndex < batchCount;
            batchIndex++
          ) {
            const index = steps.findIndex(
              (s) => s.id === stepIds["set-claim-conditions"],
            );

            if (index !== -1) {
              updateDescription(
                index,
                `Processing batch ${batchIndex + 1} of ${batchCount}`,
              );
            }

            await props.createNFTFunctions.erc1155.setClaimConditions({
              values: formValues,
              batch: {
                startIndex: batchIndex * batchSize,
                count: batchSize,
              },
            });

            batchesProcessedRef.current += 1;
          }
        } else {
          await props.createNFTFunctions.erc1155.setClaimConditions({
            values: formValues,
            batch: {
              startIndex: 0,
              count: formValues.nfts.length,
            },
          });
        }
      }
    } else if (stepId === "mint-nfts") {
      await props.createNFTFunctions[ercType].lazyMintNFTs(formValues);
    }
  }

  async function executeSteps(
    steps: MultiStepState<StepId>[],
    startIndex: number,
  ) {
    for (let i = startIndex; i < steps.length; i++) {
      const currentStep = steps[i];
      if (!currentStep) {
        return;
      }

      try {
        updateStatus(i, {
          type: "pending",
        });

        await executeStep(steps, currentStep.id);

        updateStatus(i, {
          type: "completed",
        });
      } catch (error) {
        const parsedError = parseError(error);

        updateStatus(i, {
          type: "error",
          message: parsedError,
        });

        launchTracking({
          type: "error",
          errorMessage:
            typeof parsedError === "string" ? parsedError : "Unknown error",
        });

        throw error;
      }
    }

    launchTracking({
      type: "success",
    });
    props.onLaunchSuccess();
    batchesProcessedRef.current = 0;
  }

  async function handleRetry(step: MultiStepState<StepId>) {
    const startIndex = steps.findIndex((s) => s.id === step.id);
    if (startIndex === -1) {
      return;
    }

    try {
      await executeSteps(steps, startIndex);
    } catch {
      // no op
    }
  }

  const isComplete = steps.every((step) => step.status.type === "completed");
  const isPending = steps.some((step) => step.status.type === "pending");

  const isPriceSame = props.values.nfts.every(
    (nft) => nft.price_amount === props.values.nfts[0]?.price_amount,
  );

  const uniqueAttributes = useMemo(() => {
    const attributeNames = new Set<string>();
    for (const nft of props.values.nfts) {
      if (nft.attributes) {
        for (const attribute of nft.attributes) {
          if (attribute.trait_type && attribute.value) {
            attributeNames.add(attribute.trait_type);
          }
        }
      }
    }
    return Array.from(attributeNames);
  }, [props.values.nfts]);

  return (
    <StepCard
      tracking={{
        page: "launch",
        contractType: "NFTCollection",
      }}
      title="Launch NFT"
      prevButton={{
        onClick: props.onPrevious,
      }}
      nextButton={{
        type: "custom",
        custom: (
          <TransactionButton
            client={props.client}
            variant="default"
            txChainID={Number(formValues.collectionInfo.chain)}
            isLoggedIn={true}
            isPending={false}
            transactionCount={undefined}
            onClick={handleSubmitClick}
          >
            <ArrowUpFromLineIcon className="size-4" />
            Launch NFT
          </TransactionButton>
        ),
      }}
    >
      <Dialog
        open={isModalOpen}
        // do not set onOpenChange
      >
        <DialogContent
          className="gap-0 overflow-hidden p-0 md:max-w-[480px]"
          dialogCloseClassName="hidden"
        >
          <div className="flex flex-col gap-6 p-6">
            <DialogHeader>
              <DialogTitle className="font-semibold text-xl tracking-tight">
                Status
              </DialogTitle>
              {walletRequiresApproval && (
                <DialogDescription>
                  Each step will prompt a signature request in your wallet
                </DialogDescription>
              )}
            </DialogHeader>

            <MultiStepStatus steps={steps} onRetry={handleRetry} />
          </div>

          <div className="mt-2 flex justify-between gap-4 border-border border-t bg-card p-6">
            {isComplete && contractLink ? (
              <div>
                <Button asChild className="gap-2">
                  <Link href={contractLink}>
                    View NFT <ArrowRightIcon className="size-4" />
                  </Link>
                </Button>
              </div>
            ) : (
              <div />
            )}

            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => {
                setIsModalOpen(false);
                // reset steps
                setSteps([]);
              }}
            >
              {isComplete ? "Close" : "Cancel"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Token info */}
      <div className="border-b border-dashed px-4 py-6 pb-6 md:px-6 ">
        <h2 className="mb-3 font-semibold text-base">Collection Info</h2>

        <div className="flex flex-col gap-6 lg:flex-row">
          <OverviewField name="Image" className="shrink-0">
            <FilePreview
              client={props.client}
              srcOrFile={formValues.collectionInfo.image}
              className="size-24 rounded-lg border object-cover"
              fallback={
                <div className="flex items-center justify-center bg-muted/50">
                  <ImageOffIcon className="size-5 text-muted-foreground" />
                </div>
              }
            />
          </OverviewField>

          <div className="flex grow flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:gap-6 lg:border-b lg:border-dashed lg:pb-4 lg:[&>*:not(:first-child)]:border-l lg:[&>*:not(:first-child)]:border-dashed lg:[&>*:not(:first-child)]:pl-5">
              <OverviewField name="Name">
                <OverviewFieldValue value={formValues.collectionInfo.name} />
              </OverviewField>

              {formValues.collectionInfo.symbol && (
                <OverviewField name="Symbol">
                  <OverviewFieldValue
                    value={formValues.collectionInfo.symbol}
                  />
                </OverviewField>
              )}

              <OverviewField name="Chain">
                <ChainOverview
                  client={props.client}
                  chainId={formValues.collectionInfo.chain}
                />
              </OverviewField>
            </div>

            <OverviewField name="Description">
              <OverviewFieldValue
                value={
                  formValues.collectionInfo.description || "No Description"
                }
              />
            </OverviewField>
          </div>
        </div>
      </div>

      <div className="border-b border-dashed px-4 py-6 pb-6 md:px-6">
        <h2 className="font-semibold text-base">NFTs</h2>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:gap-4 lg:[&>*:not(:first-child)]:border-l lg:[&>*:not(:first-child)]:border-dashed lg:[&>*:not(:first-child)]:pl-5">
          <OverviewField name="Total NFTs">
            <OverviewFieldValue value={formValues.nfts.length.toString()} />
          </OverviewField>

          {isPriceSame && formValues.nfts[0] && (
            <OverviewField name="Price">
              <p className="flex items-center gap-1 text-foreground text-sm">
                {formValues.nfts[0].price_amount}{" "}
                <TokenProvider
                  client={props.client}
                  address={formValues.nfts[0].price_currency}
                  // eslint-disable-next-line no-restricted-syntax
                  chain={defineChain(Number(formValues.collectionInfo.chain))}
                >
                  <TokenSymbol
                    loadingComponent={<Skeleton className="size-5 w-20" />}
                  />
                </TokenProvider>
              </p>
            </OverviewField>
          )}

          {uniqueAttributes.length > 0 && (
            <OverviewField name="Attributes">
              <div className="flex flex-wrap gap-1">
                {uniqueAttributes.map((attr) => {
                  return (
                    <Badge variant="secondary" key={attr}>
                      {attr}
                    </Badge>
                  );
                })}
              </div>
            </OverviewField>
          )}
        </div>
      </div>

      <div className="px-4 py-6 pb-6 md:px-6">
        <h2 className="font-semibold text-base">Sales and Fees</h2>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:gap-4 lg:[&>*:not(:first-child)]:border-l lg:[&>*:not(:first-child)]:border-dashed lg:[&>*:not(:first-child)]:pl-5">
          <OverviewField name="Primary Sales Recipient">
            <WalletAddress
              address={formValues.sales.primarySaleRecipient}
              client={props.client}
              className="h-auto py-1"
              iconClassName="size-3.5"
            />
          </OverviewField>

          <OverviewField name="Royalties Recipient">
            <WalletAddress
              address={formValues.sales.royaltyRecipient}
              client={props.client}
              iconClassName="size-3.5"
              className="h-auto py-1"
            />
          </OverviewField>

          <OverviewField name="Royalties">
            <p className="flex items-center gap-1 text-foreground text-sm">
              {Number(formValues.sales.royaltyBps) / 100}%
            </p>
          </OverviewField>
        </div>
      </div>
    </StepCard>
  );
}

function OverviewField(props: {
  name: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={props.className}>
      <p className="mb-1 text-muted-foreground text-sm">{props.name}</p>
      {props.children}
    </div>
  );
}

function OverviewFieldValue(props: {
  value: string;
}) {
  return <p className="text-foreground text-sm">{props.value}</p>;
}
