"use client";

import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  FormControl,
  Input,
  Textarea,
} from "@chakra-ui/react";
import { OpenSeaPropertyBadge } from "components/badges/opensea";
import { TransactionButton } from "components/buttons/TransactionButton";
import { PropertiesFormControl } from "components/contract-pages/forms/properties.shared";
import { FileInput } from "components/shared/FileInput";
import { useTrack } from "hooks/analytics/useTrack";
import { useTxNotifications } from "hooks/useTxNotifications";
import { type Dispatch, type SetStateAction, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { NFT, ThirdwebContract } from "thirdweb";
import {
  updateMetadata as updateMetadata721,
  updateTokenURI as updateTokenURI721,
} from "thirdweb/extensions/erc721";
import {
  updateMetadata as updateMetadata1155,
  updateTokenURI as updateTokenURI1155,
} from "thirdweb/extensions/erc1155";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import type { NFTMetadata } from "thirdweb/utils";
import {
  Button,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Heading,
} from "tw-components";
import type { NFTMetadataInputLimited } from "types/modified-types";
import { parseAttributes } from "utils/parseAttributes";
import {
  getUploadedNFTMediaMeta,
  handleNFTMediaUpload,
} from "../../../modules/components/nft/handleNFTMediaUpload";

const UPDATE_METADATA_FORM_ID = "nft-update-metadata-form";

type UpdateNftMetadataForm = {
  contract: ThirdwebContract;
  nft: NFT;
  setOpen: Dispatch<SetStateAction<boolean>>;
  /**
   * If useUpdateMetadata (NFT Drop, Edition Drop) -> use `updateMetadata`
   * else (NFT Collection, Edition) -> use `setTokenURI`
   */
  useUpdateMetadata: boolean;
  isLoggedIn: boolean;
};

export const UpdateNftMetadata: React.FC<UpdateNftMetadataForm> = ({
  contract,
  nft,
  useUpdateMetadata,
  setOpen,
  isLoggedIn,
}) => {
  const trackEvent = useTrack();
  const address = useActiveAccount()?.address;

  const transformedQueryData = useMemo(() => {
    const nftMetadata: Partial<NFTMetadata> = {
      // basic
      name: nft.metadata.name || "",
      description: nft.metadata.description || "",
      // media
      image: nft.metadata.image,
      animation_url: nft.metadata.animation_url,
      // advanced
      external_url: nft.metadata.external_url || "",
      background_color: nft.metadata.background_color || "",
      attributes: nft.metadata.attributes,
    };

    return nftMetadata;
  }, [nft]);

  const form = useForm<NFTMetadataInputLimited>({
    defaultValues: transformedQueryData,
    values: transformedQueryData,
  });

  const {
    setValue,
    control,
    register,
    watch,
    handleSubmit,
    formState: { errors, isDirty },
  } = form;

  const setFile = (file: File) => {
    handleNFTMediaUpload({ file, form });
  };
  const {
    media,
    image,
    mediaFileError,
    showCoverImageUpload,
    animation_url,
    external_url,
  } = getUploadedNFTMediaMeta(form);

  const sendAndConfirmTx = useSendAndConfirmTransaction();
  const updateMetadataNotifications = useTxNotifications(
    "NFT metadata updated successfully",
    "Failed to update NFT metadata",
  );

  return (
    <form
      className="flex flex-col gap-6"
      id={UPDATE_METADATA_FORM_ID}
      onSubmit={handleSubmit(async (data) => {
        if (!address) {
          toast.error("Please connect your wallet to update metadata.");
          return;
        }
        trackEvent({
          category: "nft",
          action: "update-metadata",
          label: "attempt",
        });

        try {
          const newMetadata = parseAttributes({
            ...data,
            image: data.image || nft.metadata.image,
            animation_url: data.animation_url || nft.metadata.animation_url,
          });

          const transaction = useUpdateMetadata
            ? // For Drop contracts, we need to call the `updateBatchBaseURI` method
              nft.type === "ERC721"
              ? updateMetadata721({
                  contract,
                  targetTokenId: BigInt(nft.id),
                  newMetadata,
                })
              : updateMetadata1155({
                  contract,
                  targetTokenId: BigInt(nft.id),
                  newMetadata,
                })
            : // For Collection contracts, we need to call the `setTokenURI` method
              nft.type === "ERC721"
              ? updateTokenURI721({
                  contract,
                  tokenId: BigInt(nft.id),
                  newMetadata,
                })
              : updateTokenURI1155({
                  contract,
                  tokenId: BigInt(nft.id),
                  newMetadata,
                });
          await sendAndConfirmTx.mutateAsync(transaction, {
            onSuccess: () => {
              trackEvent({
                category: "nft",
                action: "update-metadata",
                label: "success",
              });
              setOpen(false);
            },
            // biome-ignore lint/suspicious/noExplicitAny: FIXME
            onError: (error: any) => {
              trackEvent({
                category: "nft",
                action: "update-metadata",
                label: "error",
                error,
              });
            },
          });

          updateMetadataNotifications.onSuccess();
        } catch (err) {
          console.error(err);
          updateMetadataNotifications.onError(err);
        }
      })}
    >
      <FormControl isRequired isInvalid={!!errors.name}>
        <FormLabel>Name</FormLabel>
        <Input autoFocus {...register("name")} />
        <FormErrorMessage>{errors?.name?.message}</FormErrorMessage>
      </FormControl>

      <FormControl isInvalid={!!mediaFileError}>
        <FormLabel>Media</FormLabel>
        <div className="flex flex-row flex-wrap gap-3">
          <FileInput
            previewMaxWidth="200px"
            value={media}
            showUploadButton
            showPreview
            setValue={setFile}
            className="shrink-0 rounded border border-border transition-all duration-200"
            selectOrUpload="Upload"
            helperText={nft?.metadata ? "New Media" : "Media"}
            client={contract.client}
          />
        </div>

        <FormHelperText>
          You can upload image, audio, video, html, text, pdf, and 3d model
          files here.
        </FormHelperText>
        <FormErrorMessage>
          {mediaFileError?.message as unknown as string}
        </FormErrorMessage>
      </FormControl>

      {showCoverImageUpload && (
        <FormControl isInvalid={!!errors.image}>
          <FormLabel>Cover Image</FormLabel>
          <FileInput
            previewMaxWidth="200px"
            client={contract.client}
            accept={{ "image/*": [] }}
            value={image}
            showUploadButton
            setValue={(file) => setValue("image", file)}
            className="rounded border border-border transition-all"
          />
          <FormHelperText>
            You can optionally upload an image as the cover of your NFT.
          </FormHelperText>
          <FormErrorMessage>
            {errors?.image?.message as unknown as string}
          </FormErrorMessage>
        </FormControl>
      )}
      <FormControl isInvalid={!!errors.description}>
        <FormLabel>Description</FormLabel>
        <Textarea {...register("description")} />
        <FormErrorMessage>{errors?.description?.message}</FormErrorMessage>
      </FormControl>
      <PropertiesFormControl
        watch={watch}
        // biome-ignore lint/suspicious/noExplicitAny: FIXME
        errors={errors as any}
        control={control}
        register={register}
        setValue={setValue}
        client={contract.client}
      />

      <Accordion
        allowToggle={!(errors.background_color || errors.external_url)}
        index={errors.background_color || errors.external_url ? [0] : undefined}
      >
        <AccordionItem>
          <AccordionButton px={0} justifyContent="space-between">
            <Heading size="subtitle.md">Advanced Options</Heading>
            <AccordionIcon />
          </AccordionButton>
          <AccordionPanel className="!px-0 flex flex-col gap-6">
            <FormControl isInvalid={!!errors.background_color}>
              <FormLabel>
                Background Color <OpenSeaPropertyBadge />
              </FormLabel>
              <Input max="6" {...register("background_color")} />
              <FormHelperText>
                Must be a six-character hexadecimal with a pre-pended #.
              </FormHelperText>
              <FormErrorMessage>
                {errors?.background_color?.message}
              </FormErrorMessage>
            </FormControl>

            {!(external_url instanceof File) && (
              <FormControl isInvalid={!!errors.external_url}>
                <FormLabel>
                  External URL <OpenSeaPropertyBadge />
                </FormLabel>
                <Input {...register("external_url")} />
                <FormHelperText>
                  This is the URL that will appear below the asset&apos;s image
                  on OpenSea and will allow users to leave OpenSea and view the
                  item on your site.
                </FormHelperText>
                <FormErrorMessage>
                  {errors?.external_url?.message as unknown as string}
                </FormErrorMessage>
              </FormControl>
            )}

            {!(image instanceof File) && (
              <FormControl isInvalid={!!errors.image}>
                <FormLabel>Image URL</FormLabel>
                <Input
                  value={typeof image === "string" ? image : ""}
                  onChange={(e) => {
                    setValue("image", e.target.value);
                  }}
                />
                <FormHelperText>
                  If you already have your NFT image pre-uploaded to a URL, you
                  can specify it here instead of uploading the media file
                </FormHelperText>
                <FormErrorMessage>{errors?.image?.message}</FormErrorMessage>
              </FormControl>
            )}

            {!(animation_url instanceof File) && (
              <FormControl isInvalid={!!errors.animation_url}>
                <FormLabel>Animation URL</FormLabel>
                <Input
                  value={typeof animation_url === "string" ? animation_url : ""}
                  onChange={(e) => {
                    setValue("animation_url", e.target.value);
                  }}
                />
                <FormHelperText>
                  If you already have your NFT Animation URL pre-uploaded to a
                  URL, you can specify it here instead of uploading the media
                  file
                </FormHelperText>
                <FormErrorMessage>
                  {errors?.animation_url?.message}
                </FormErrorMessage>
              </FormControl>
            )}
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
      <div className="mt-8 flex flex-row justify-end gap-3">
        <Button
          isDisabled={sendAndConfirmTx.isPending}
          variant="outline"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
        <TransactionButton
          client={contract.client}
          isLoggedIn={isLoggedIn}
          txChainID={contract.chain.id}
          transactionCount={1}
          isPending={sendAndConfirmTx.isPending}
          form={UPDATE_METADATA_FORM_ID}
          type="submit"
          disabled={!isDirty}
        >
          Update NFT
        </TransactionButton>
      </div>
    </form>
  );
};
