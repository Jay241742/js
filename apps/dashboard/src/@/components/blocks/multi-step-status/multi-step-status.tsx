"use client";

import { Button } from "@/components/ui/button";
import {
  AlertCircleIcon,
  CircleCheckIcon,
  CircleIcon,
  RefreshCwIcon,
} from "lucide-react";
import { DynamicHeight } from "../../ui/DynamicHeight";
import { Spinner } from "../../ui/Spinner/Spinner";

export type MultiStepState<T extends string> = {
  id: T;
  status:
    | {
        type: "idle" | "pending" | "completed";
      }
    | {
        type: "error";
        message: React.ReactNode;
      };
  label: string;
  description?: string;
};

export function MultiStepStatus<T extends string>(props: {
  steps: MultiStepState<T>[];
  onRetry: (step: MultiStepState<T>) => void;
}) {
  return (
    <DynamicHeight>
      <div className="space-y-4">
        {props.steps.map((step) => (
          <div key={step.label} className="flex items-start space-x-3 ">
            {step.status.type === "completed" ? (
              <CircleCheckIcon className="mt-0.5 size-5 flex-shrink-0 text-green-500" />
            ) : step.status.type === "pending" ? (
              <Spinner className="mt-0.5 size-5 flex-shrink-0 text-foreground" />
            ) : step.status.type === "error" ? (
              <AlertCircleIcon className="mt-0.5 size-5 flex-shrink-0 text-red-500" />
            ) : (
              <CircleIcon className="mt-0.5 size-5 flex-shrink-0 text-muted-foreground/70" />
            )}
            <div className="flex-1">
              <p
                className={`font-medium ${
                  step.status.type === "pending"
                    ? "text-foreground"
                    : step.status.type === "completed"
                      ? "text-green-500"
                      : step.status.type === "error"
                        ? "text-red-500"
                        : "text-muted-foreground/70"
                }`}
              >
                {step.label}
              </p>

              {/* show description when this step is active */}
              {(step.status.type === "pending" ||
                step.status.type === "error") &&
                step.description && (
                  <p className="text-muted-foreground text-sm">
                    {step.description}
                  </p>
                )}

              {step.status.type === "error" && (
                <div className="mt-1 space-y-2">
                  <p className="mb-1 text-red-500 text-sm">
                    {step.status.message}
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    onClick={() => props.onRetry(step)}
                  >
                    <RefreshCwIcon className="size-4" />
                    Retry
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </DynamicHeight>
  );
}
