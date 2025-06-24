import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";

export const neynarClient = new NeynarAPIClient(
  new Configuration({
    apiKey: process.env.NEYNAR_API_KEY ?? "NEYNAR_API_DOCS",
    baseOptions: { headers: { "x-neynar-experimental": true } },
  })
);