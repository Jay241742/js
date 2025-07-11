import { TabButtons } from "@/components/ui/tabs";
import { useTrack } from "hooks/analytics/useTrack";
import type { ThirdwebClient } from "thirdweb";
import { StepCard } from "../../_common/step-card";
import { getStepCardTrackingData } from "../../token/_common/tracking";
import { nftCreationPages } from "../_common/pages";
import { BatchUploadNFTs } from "./batch-upload/batch-upload-nfts";
import type {
  NFTMetadataWithPrice,
  ProcessBatchUploadFilesResult,
} from "./batch-upload/process-files";
import { SingleUploadNFT } from "./single-upload/single-upload-nft";

export type NFTData =
  | {
      type: "multiple";
      nfts: ProcessBatchUploadFilesResult | null;
    }
  | {
      type: "single";
      nft: NFTMetadataWithPrice | null;
    };

export function UploadNFTsFieldset(props: {
  client: ThirdwebClient;
  chainId: number;
  onNext: () => void;
  onPrev: () => void;
  nftData: NFTData;
  setNFTData: (nftData: NFTData) => void;
}) {
  const trackEvent = useTrack();

  function handleNextClick() {
    trackEvent(
      getStepCardTrackingData({
        step: nftCreationPages["upload-assets"],
        click: "next",
        contractType: "NFTCollection",
      }),
    );
    props.onNext();
  }

  function handlePrevClick() {
    trackEvent(
      getStepCardTrackingData({
        step: nftCreationPages["upload-assets"],
        click: "prev",
        contractType: "NFTCollection",
      }),
    );
    props.onPrev();
  }

  return (
    <StepCard
      title="Upload NFTs"
      tracking={{ page: "upload-nfts", contractType: "NFTCollection" }}
      prevButton={undefined}
      nextButton={undefined}
    >
      <TabButtons
        containerClassName="pt-2 px-4 md:px-6"
        tabClassName="!text-sm"
        tabs={[
          {
            name: "Create Single",
            onClick: () =>
              props.setNFTData({
                type: "single",
                nft: null,
              }),
            isActive: props.nftData.type === "single",
          },
          {
            name: "Create Multiple",
            onClick: () => props.setNFTData({ type: "multiple", nfts: null }),
            isActive: props.nftData.type === "multiple",
          },
        ]}
      />

      {props.nftData.type === "multiple" && (
        <BatchUploadNFTs
          onNext={handleNextClick}
          onPrev={handlePrevClick}
          client={props.client}
          results={props.nftData.nfts}
          setResults={(results) =>
            props.setNFTData({
              type: "multiple",
              nfts: results,
            })
          }
          chainId={props.chainId}
        />
      )}

      {props.nftData.type === "single" && (
        <SingleUploadNFT
          client={props.client}
          onNext={handleNextClick}
          onPrev={handlePrevClick}
          chainId={props.chainId}
          nftData={props.nftData.nft}
          setNFTData={(nft) =>
            props.setNFTData({
              type: "single",
              nft,
            })
          }
        />
      )}
    </StepCard>
  );
}
