import { Member as DatabaseMember, MembershipState, MembershipStateType } from "./schema";

/**
 * Enhanced Member class that encapsulates all user-related data and state management
 * Combines Farcaster profile data, wallet information, verification status, and membership state
 */
export class Member {
  private _data: DatabaseMember;
  private _farcasterVerifiedWallets: string[] = [];
  private _connectedWallet: string | null = null;

  constructor(data: DatabaseMember) {
    this._data = data;
  }

  // Static factory methods
  static createNew(farcasterData: {
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
    bio?: string;
  }): Partial<DatabaseMember> {
    return {
      farcasterFid: farcasterData.fid,
      farcasterUsername: farcasterData.username || null,
      farcasterDisplayName: farcasterData.displayName || null,
      farcasterPfpUrl: farcasterData.pfpUrl || null,
      farcasterBio: farcasterData.bio || null,
      membershipState: MembershipState.NEW_MEMBER,
      emailVerified: false,
      passportVerified: false,
    };
  }

  // Getters for database fields
  get id(): number { return this._data.id; }
  get farcasterFid(): number { return this._data.farcasterFid; }
  get farcasterUsername(): string | null { return this._data.farcasterUsername; }
  get farcasterDisplayName(): string | null { return this._data.farcasterDisplayName; }
  get farcasterPfpUrl(): string | null { return this._data.farcasterPfpUrl; }
  get farcasterBio(): string | null { return this._data.farcasterBio; }
  get email(): string | null { return this._data.email; }
  get emailVerified(): boolean { return this._data.emailVerified; }
  get ipePassport(): string | null { return this._data.ipePassport; }
  get passportVerified(): boolean { return this._data.passportVerified; }
  get connectedWalletAddress(): string | null { return this._data.connectedWalletAddress; }
  get membershipState(): MembershipStateType { return this._data.membershipState as MembershipStateType; }
  get createdAt(): Date | null { return this._data.createdAt; }
  get updatedAt(): Date | null { return this._data.updatedAt; }

  // Profile information getters
  get displayName(): string {
    return this.farcasterDisplayName || this.farcasterUsername || `FID ${this.farcasterFid}`;
  }

  get profileImageUrl(): string {
    return this.farcasterPfpUrl || `https://ui-avatars.com/api/?name=${this.displayName}&background=7c3aed&color=fff`;
  }

  // State management methods
  isNewMember(): boolean {
    return this.membershipState === MembershipState.NEW_MEMBER;
  }

  isWaitingVerification(): boolean {
    return this.membershipState === MembershipState.WAITING_MEMBERSHIP_VERIFICATION;
  }

  isMembershipActive(): boolean {
    return this.membershipState === MembershipState.MEMBERSHIP_ACTIVE;
  }

  // Verification status checks
  needsEmailVerification(): boolean {
    return !this.emailVerified;
  }

  needsPassportVerification(): boolean {
    return !this.passportVerified;
  }

  isFullyVerified(): boolean {
    return this.emailVerified && this.passportVerified;
  }

  // Profile completion checks
  hasBasicProfile(): boolean {
    return !!(this.farcasterUsername || this.farcasterDisplayName);
  }

  needsProfileCompletion(): boolean {
    return this.isMembershipActive() && (!this.emailVerified || !this.passportVerified);
  }

  // Wallet management
  setFarcasterVerifiedWallets(wallets: string[]): void {
    this._farcasterVerifiedWallets = wallets;
  }

  setConnectedWallet(wallet: string | null): void {
    this._connectedWallet = wallet;
  }

  get farcasterVerifiedWallets(): string[] {
    return this._farcasterVerifiedWallets;
  }

  get connectedWallet(): string | null {
    return this._connectedWallet;
  }

  // Check if user has passport via any verified wallet
  hasPassportInVerifiedWallets(): boolean {
    // This would be checked against Neynar API or ENS lookup
    return false; // Placeholder - implement with actual API calls
  }

  // State transitions
  getNextRequiredAction(): 'email_verification' | 'passport_verification' | 'complete' | 'none' {
    if (this.isNewMember()) {
      return 'email_verification';
    }
    
    if (this.isWaitingVerification()) {
      if (!this.emailVerified) return 'email_verification';
      if (!this.passportVerified) return 'passport_verification';
      return 'complete';
    }
    
    if (this.isMembershipActive()) {
      if (this.needsProfileCompletion()) {
        if (!this.emailVerified) return 'email_verification';
        if (!this.passportVerified) return 'passport_verification';
      }
      return 'none';
    }
    
    return 'none';
  }

  // Get routing destination based on current state
  getRequiredRoute(): string {
    const action = this.getNextRequiredAction();
    
    switch (action) {
      case 'email_verification':
      case 'passport_verification':
        return '/id-verification';
      case 'complete':
        return '/';
      default:
        return '/';
    }
  }

  // Update methods that return new Member instances (immutable pattern)
  withEmailVerified(email: string): Member {
    const newData = { 
      ...this._data, 
      email, 
      emailVerified: true,
      membershipState: this.passportVerified ? MembershipState.MEMBERSHIP_ACTIVE : MembershipState.WAITING_MEMBERSHIP_VERIFICATION
    };
    return new Member(newData);
  }

  withPassportVerified(passport: string, walletAddress: string): Member {
    const newData = { 
      ...this._data, 
      ipePassport: passport,
      passportVerified: true,
      connectedWalletAddress: walletAddress,
      membershipState: this.emailVerified ? MembershipState.MEMBERSHIP_ACTIVE : MembershipState.WAITING_MEMBERSHIP_VERIFICATION
    };
    return new Member(newData);
  }

  withFarcasterData(data: Partial<{
    username: string;
    displayName: string;
    pfpUrl: string;
    bio: string;
  }>): Member {
    const newData = { 
      ...this._data,
      farcasterUsername: data.username || this._data.farcasterUsername,
      farcasterDisplayName: data.displayName || this._data.farcasterDisplayName,
      farcasterPfpUrl: data.pfpUrl || this._data.farcasterPfpUrl,
      farcasterBio: data.bio || this._data.farcasterBio,
    };
    return new Member(newData);
  }

  // Convert to database update object
  toUpdateObject(): Partial<DatabaseMember> {
    const { id, createdAt, ...updateData } = this._data;
    return {
      ...updateData,
      updatedAt: new Date(),
    };
  }

  // Convert to API response object
  toApiResponse(): any {
    return {
      id: this.id,
      farcasterFid: this.farcasterFid,
      farcasterUsername: this.farcasterUsername,
      farcasterDisplayName: this.farcasterDisplayName,
      farcasterPfpUrl: this.farcasterPfpUrl,
      displayName: this.displayName,
      profileImageUrl: this.profileImageUrl,
      email: this.email,
      emailVerified: this.emailVerified,
      ipePassport: this.ipePassport,
      passportVerified: this.passportVerified,
      membershipState: this.membershipState,
      nextAction: this.getNextRequiredAction(),
      requiredRoute: this.getRequiredRoute(),
      isFullyVerified: this.isFullyVerified(),
      needsProfileCompletion: this.needsProfileCompletion(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}