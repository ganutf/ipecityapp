# **Onchain Rewards Implementation Plan**

## **Overview**

- Implement an Ethereum Attestation Service (EAS – [docs](https://docs.attest.org/docs/)) integration to register onchain rewards for pulse completion on Base L2, with a ranking system based on accumulated points.  
- Use the pre-existing Schema:  
  [https://base.easscan.org/schema/view/0x03486c2ea0d4fab00cf6c72fb856b5997c784df12fc0eae0868464ad03a4f8f5](https://base.easscan.org/schema/view/0x03486c2ea0d4fab00cf6c72fb856b5997c784df12fc0eae0868464ad03a4f8f5)

### Schema Fields:
- `bytes32 communityUid`:  
  `0xed52ad6ebe0c805fb5d6c8f852452611cf6313ef781802cc9d4ac6f5f4f75aca`
- `uint8 pulseType`:  
  `01` (like and/or share a Farcaster post)
- `string memberOnchainID`:  
  ipe passport (`ipecity.eth` subdomain)
- `uint16 pulseNumber`:  
  Number of the pulse
- `uint64 executedAt`:  
  Timestamp (UTC) when the member executed the pulse

---

- After the 24-hour window to perform the pulse has been finished, the app should run a script/cron job to:
  - Check every member (verified owner of `ipecity.eth` passport with active status)
  - Register the attestation onchain (Base L2) using EAS

- After creating the attestation:
  - Store the attestation UID in the execution table associated with the member and their pulse execution

- The execution of the pulse should generate points for the member

- Points should be defined by the admin at the time of pulse creation

---

## **Code Sample only for reference in how to use EAS**

```ts
import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";

const easContractAddress = "0x4200000000000000000000000000000000000021";
const schemaUID = "0x03486c2ea0d4fab00cf6c72fb856b5997c784df12fc0eae0868464ad03a4f8f5";

const eas = new EAS(easContractAddress);

// Signer must be an ethers-like signer.
await eas.connect(signer);

// Initialize SchemaEncoder with the schema string
const schemaEncoder = new SchemaEncoder(
  "bytes32 communityUid,uint8 pulseType,string memberOnchainID,uint16 pulseNumber,uint64 executedAt"
);

const encodedData = schemaEncoder.encodeData([
  { name: "communityUid", value: "", type: "bytes32" },
  { name: "pulseType", value: "0", type: "uint8" },
  { name: "memberOnchainID", value: "", type: "string" },
  { name: "pulseNumber", value: "0", type: "uint16" },
  { name: "executedAt", value: "0", type: "uint64" },
]);

const tx = await eas.attest({
  schema: schemaUID,
  data: {
    recipient: "0x0000000000000000000000000000000000000000",
    expirationTime: 0,
    revocable: true, // Set to false if schema is not revocable
    data: encodedData,
  },
});

const newAttestationUID = await tx.wait();
console.log("New attestation UID:", newAttestationUID);
