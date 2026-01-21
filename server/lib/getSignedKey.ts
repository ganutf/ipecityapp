import { neynar } from "./neynarClient";
import { ViemLocalEip712Signer } from "@farcaster/hub-nodejs";
import { bytesToHex, hexToBytes } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { getFid } from "./getFid";

export const getSignedKey = async (is_sponsored: boolean = true) => {
  const createSigner = await neynar.createSigner();
  const { deadline, signature, sponsor } = await generate_signature(
    createSigner.public_key,
    is_sponsored
  );

  if (deadline === 0 || signature === "") {
    throw new Error("Failed to generate signature");
  }

  const fid = await getFid();

  const signedKey = await neynar.registerSignedKey({
    signerUuid: createSigner.signer_uuid,
    appFid: fid,
    deadline,
    signature,
    sponsor,
  });

  return {
    signer_uuid: createSigner.signer_uuid,
    public_key: createSigner.public_key,
    status: signedKey.status,
    deep_link_url: signedKey.signer_approval_url,
    signedKey
  };
};

const generate_signature = async function (
  public_key: string,
  is_sponsored = false
) {
  const mnemonic = process.env.FARCASTER_DEVELOPER_MNEMONIC;
  if (!mnemonic) {
    throw new Error("FARCASTER_DEVELOPER_MNEMONIC must be set in environment variables");
  }

  const FID = await getFid();

  const account = mnemonicToAccount(mnemonic);
  const appAccountKey = new ViemLocalEip712Signer(account as any);

  // Generates an expiration date for the signature (24 hours from now).
  const deadline = Math.floor(Date.now() / 1000) + 86400;

  const uintAddress = hexToBytes(public_key as `0x${string}`);

  const signature = await appAccountKey.signKeyRequest({
    requestFid: BigInt(FID),
    key: uintAddress,
    deadline: BigInt(deadline),
  });

  if (signature.isErr()) {
    return {
      deadline,
      signature: "",
    };
  }

  const sigHex = bytesToHex(signature.value);

  let sponsor;

  if (is_sponsored) {
    const sponsorSignature = await account.signMessage({
      message: { raw: sigHex },
    });

    sponsor = {
      signature: sponsorSignature,
      fid: FID,
    };
  }

  return { deadline, signature: sigHex, sponsor };
};