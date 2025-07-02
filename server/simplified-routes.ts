import express, { Express, Request, Response } from "express";
import { simplifiedStorage } from "./simplified-storage";
import { Member } from "@shared/Member";
import { 
  emailVerificationRequestSchema, 
  passportVerificationSchema, 
  MembershipState
} from "@shared/schema";
import { sendVerificationEmail, generateVerificationCode } from "./lib/email";

export function registerSimplifiedRoutes(app: Express) {
  
  // Member status check - creates member if doesn't exist
  app.get("/api/members/check/:fid", async (req: Request, res: Response) => {
    try {
      const fid = parseInt(req.params.fid);
      
      let member = await simplifiedStorage.getMember(fid);
      
      // Auto-create member if doesn't exist
      if (!member) {
        try {
          const newMemberData = {
            farcasterFid: fid,
            farcasterUsername: null,
            farcasterDisplayName: null,
            farcasterPfpUrl: null,
            farcasterBio: null,
            membershipState: MembershipState.NEW_MEMBER,
            emailVerified: false,
            passportVerified: false,
          };
          
          member = await simplifiedStorage.createMember(newMemberData);
        } catch (error) {
          console.error("Error creating member:", error);
          return res.status(500).json({ success: false, error: "Failed to create member" });
        }
      }
      
      const memberInstance = new Member(member);
      
      res.json({
        success: true,
        member: memberInstance.toApiResponse(),
      });
      
    } catch (error) {
      console.error("Error checking member:", error);
      res.status(500).json({ success: false, error: "Failed to check member status" });
    }
  });

  // Email verification request
  app.post("/api/auth/request-email-verification", async (req: Request, res: Response) => {
    try {
      const validatedData = emailVerificationRequestSchema.parse(req.body);
      const { farcasterFid, email } = validatedData;
      
      const verificationCode = generateVerificationCode();
      
      // Store verification code
      await simplifiedStorage.createEmailVerification({
        farcasterFid,
        email,
        verificationCode,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        verified: false,
      });
      
      // Send email
      const emailSent = await sendVerificationEmail(email, verificationCode);
      
      if (!emailSent) {
        return res.status(500).json({ 
          success: false, 
          error: "Failed to send verification email" 
        });
      }
      
      res.json({ 
        success: true, 
        message: "Verification code sent to email" 
      });
      
    } catch (error) {
      console.error("Error requesting email verification:", error);
      res.status(400).json({ 
        success: false, 
        error: "Invalid request data" 
      });
    }
  });

  // Email verification confirmation
  app.post("/api/auth/confirm-email", async (req: Request, res: Response) => {
    try {
      const { farcasterFid, verificationCode } = req.body;
      
      const verification = await simplifiedStorage.getEmailVerification(farcasterFid, verificationCode);
      
      if (!verification) {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid or expired verification code" 
        });
      }
      
      // Check expiry
      if (verification.expiresAt < new Date()) {
        return res.status(400).json({ 
          success: false, 
          error: "Verification code has expired" 
        });
      }
      
      // Mark email as verified
      const updatedMember = await simplifiedStorage.markEmailVerified(farcasterFid, verification.email);
      const memberInstance = new Member(updatedMember);
      
      res.json({ 
        success: true, 
        message: "Email verified successfully",
        member: memberInstance.toApiResponse()
      });
      
    } catch (error) {
      console.error("Error confirming email:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to verify email" 
      });
    }
  });

  // Passport verification
  app.post("/api/passport/verify", async (req: Request, res: Response) => {
    try {
      const validatedData = passportVerificationSchema.parse(req.body);
      const { farcasterFid, ipePassport, connectedWalletAddress } = validatedData;
      
      // Here you would validate the SIWE signature and ENS ownership
      // For now, we'll assume the validation is successful
      
      // Mark passport as verified
      const updatedMember = await simplifiedStorage.markPassportVerified(
        farcasterFid, 
        ipePassport, 
        connectedWalletAddress
      );
      
      const memberInstance = new Member(updatedMember);
      
      res.json({ 
        success: true, 
        message: "Passport verified successfully",
        member: memberInstance.toApiResponse()
      });
      
    } catch (error) {
      console.error("Error verifying passport:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to verify passport" 
      });
    }
  });

  // Get member profile
  app.get("/api/members/:fid", async (req: Request, res: Response) => {
    try {
      const fid = parseInt(req.params.fid);
      const member = await simplifiedStorage.getMember(fid);
      
      if (!member) {
        return res.status(404).json({ 
          success: false, 
          error: "Member not found" 
        });
      }
      
      const memberInstance = new Member(member);
      
      res.json({
        success: true,
        member: memberInstance.toApiResponse(),
      });
      
    } catch (error) {
      console.error("Error getting member:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to get member" 
      });
    }
  });

  // Update member profile
  app.patch("/api/members/:fid", async (req: Request, res: Response) => {
    try {
      const fid = parseInt(req.params.fid);
      const updateData = req.body;
      
      // Only allow certain fields to be updated
      const allowedFields = ['xHandle', 'linkedin', 'miniBio', 'profileTags'];
      const filteredUpdate = Object.keys(updateData)
        .filter(key => allowedFields.includes(key))
        .reduce((obj: any, key) => {
          obj[key] = updateData[key];
          return obj;
        }, {});
      
      const updatedMember = await simplifiedStorage.updateMember(fid, filteredUpdate);
      const memberInstance = new Member(updatedMember);
      
      res.json({
        success: true,
        member: memberInstance.toApiResponse(),
      });
      
    } catch (error) {
      console.error("Error updating member:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to update member" 
      });
    }
  });
}