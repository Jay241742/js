"use client";
import {
  type MultiStepState,
  MultiStepStatus,
} from "@/components/blocks/multi-step-status/multi-step-status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TransactionButton } from "components/buttons/TransactionButton";
import { useTrack } from "hooks/analytics/useTrack";
import {
  ArrowRightIcon,
  ArrowUpFromLineIcon,
  ImageOffIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { ThirdwebClient } from "thirdweb";
import { useActiveWallet } from "thirdweb/react";
import { parseError } from "utils/errorParser";
import { ChainOverview } from "../../_common/chain-overview";
import { FilePreview } from "../../_common/file-preview";
import { StepCard } from "../../_common/step-card";
import type { CreateAssetFormValues } from "../_common/form";
import { getTokenLaunchTrackingData } from "../_common/tracking";
import type { CreateTokenFunctions } from "../create-token-page.client";
import { TokenDistributionBarChart } from "../distribution/token-distribution";

const stepIds = {
  "deploy-contract": "deploy-contract",
  "set-claim-conditions": "set-claim-conditions",
  "mint-tokens": "mint-tokens",
  "airdrop-tokens": "airdrop-tokens",
} as const;

type StepId = keyof typeof stepIds;

export function LaunchTokenStatus(props: {
  createTokenFunctions: CreateTokenFunctions;
  values: CreateAssetFormValues;
  onPrevious: () => void;
  client: ThirdwebClient;
  onLaunchSuccess: () => void;
  teamSlug: string;
  projectSlug: string;
}) {
  const formValues = props.values;
  const { createTokenFunctions } = props;
  const [steps, setSteps] = useState<MultiStepState<StepId>[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [contractLink, setContractLink] = useState<string | null>(null);
  const activeWallet = useActiveWallet();
  const walletRequiresApproval = activeWallet?.id !== "inApp";
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
      getTokenLaunchTrackingData({
        chainId: Number(formValues.chain),
        airdropEnabled: formValues.airdropEnabled,
        saleEnabled: formValues.saleEnabled,
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
        label: "Set claim conditions",
        id: stepIds["set-claim-conditions"],
        status: { type: "idle" },
      },
      {
        label: "Mint tokens",
        id: stepIds["mint-tokens"],
        status: { type: "idle" },
      },
    ];

    if (formValues.airdropEnabled && formValues.airdropAddresses.length > 0) {
      initialSteps.push({
        label: "Airdrop tokens",
        id: stepIds["airdrop-tokens"],
        status: { type: "idle" },
      });
    }

    setSteps(initialSteps);
    setIsModalOpen(true);
    executeSteps(initialSteps, 0);
  }

  const isComplete = steps.every((step) => step.status.type === "completed");
  const isPending = steps.some((step) => step.status.type === "pending");

  async function executeStep(stepId: StepId) {
    if (stepId === "deploy-contract") {
      const result = await createTokenFunctions.deployContract(formValues);
      setContractLink(
        `/team/${props.teamSlug}/${props.projectSlug}/contract/${formValues.chain}/${result.contractAddress}`,
      );
    } else if (stepId === "set-claim-conditions") {
      await createTokenFunctions.setClaimConditions(formValues);
    } else if (stepId === "mint-tokens") {
      await createTokenFunctions.mintTokens(formValues);
    } else if (stepId === "airdrop-tokens") {
      await createTokenFunctions.airdropTokens(formValues);
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

        await executeStep(currentStep.id);

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
  }

  async function handleRetry(step: MultiStepState<StepId>) {
    const startIndex = steps.findIndex((s) => s.id === step.id);
    if (startIndex === -1) {
      return;
    }

    await executeSteps(steps, startIndex);
  }

  return (
    <StepCard
      tracking={{
        page: "launch",
        contractType: "DropERC20",
      }}
      title="Launch Coin"
      prevButton={{
        onClick: props.onPrevious,
      }}
      nextButton={{
        type: "custom",
        custom: (
          <TransactionButton
            client={props.client}
            variant="default"
            txChainID={Number(formValues.chain)}
            isLoggedIn={true}
            isPending={false}
            transactionCount={undefined}
            onClick={handleSubmitClick}
          >
            <ArrowUpFromLineIcon className="size-4" />
            Launch Coin
          </TransactionButton>
        ),
      }}
    >
      {/* Token info */}
      <div className="flex flex-col gap-6 border-b border-dashed px-4 py-6 pb-6 md:px-6 lg:flex-row">
        <OverviewField name="Image" className="shrink-0">
          <FilePreview
            client={props.client}
            srcOrFile={formValues.image}
            className="size-24 rounded-lg border object-cover"
            fallback={
              <div className="flex items-center justify-center bg-muted/50">
                <ImageOffIcon className="size-5 text-muted-foreground" />
              </div>
            }
          />
        </OverviewField>

        <div className="flex grow flex-col gap-4 ">
          <div className="flex flex-col gap-4 lg:flex-row lg:gap-6 lg:border-b lg:border-dashed lg:pb-4 lg:[&>*:not(:first-child)]:border-l lg:[&>*:not(:first-child)]:border-dashed lg:[&>*:not(:first-child)]:pl-5">
            <OverviewField name="Name">
              <OverviewFieldValue value={formValues.name} />
            </OverviewField>

            <OverviewField name="Symbol">
              <OverviewFieldValue value={formValues.symbol} />
            </OverviewField>

            <OverviewField name="Chain">
              <ChainOverview client={props.client} chainId={formValues.chain} />
            </OverviewField>
          </div>

          <OverviewField name="Description">
            <OverviewFieldValue
              value={formValues.description || "No Description"}
            />
          </OverviewField>
        </div>
      </div>

      {/* Token distribution */}
      <div className="flex flex-col gap-4 px-4 py-6 md:px-6">
        <OverviewField name="Total Supply">
          <p className="font-medium text-foreground text-sm">
            {compactNumberFormatter.format(Number(formValues.supply))}
          </p>
        </OverviewField>

        <TokenDistributionBarChart distributionFormValues={formValues} />
      </div>

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
                    View Coin <ArrowRightIcon className="size-4" />
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
    </StepCard>
  );
}

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 10,
});

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
