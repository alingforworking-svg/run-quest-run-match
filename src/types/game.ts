export type QuestType = "easy" | "medium" | "hard" | "team" | "reward" | "daily" | "boss" | "mystery" | "night";
export type QuestStatus = "locked" | "available" | "active" | "completed" | "perfect";

export interface Coordinates { lat: number; lng: number }
export interface RunningVenue extends Coordinates { id:string; name:string; laoName:string; radiusMeters:number }
export interface Checkpoint extends Coordinates { id: string; name: string; order: number; radiusMeters: number; revealed: boolean }
export interface Quest {
  id: string; worldId: string; name: string; type: QuestType; status: QuestStatus;
  description: string; distanceKm: number; durationMinutes: number; pace: string;
  difficulty: number; xp: number; badge?: string; checkpoints: Checkpoint[];
  requirements?: string; sponsoredReward?: string; venue?:RunningVenue; allowAnywhere?:boolean;
}
export interface World { id: string; number: number; name: string; subtitle: string; color: string; progress: number }
export interface Runner {
  id: string; name: string; username: string; avatar: string; level: number; title: string;
  paceMinKm: number; distanceRange: [number, number]; streak: number; rating: number;
  distanceAwayKm: number; availableTimes: string[]; experience: string; style: string; questTypes: QuestType[];
}
export interface GPSPoint extends Coordinates { timestamp: number; accuracy?: number; speed?: number | null }
export interface VerificationResult { score: number; verified: boolean; flags: string[]; stats: { distanceKm: number; maxSpeedKmh: number; jumpCount: number } }
export interface RunSpot extends Coordinates {
  id: string; ownerId: string; ownerName: string; ownerAvatar: string; title: string; note: string;
  distanceKm: number; pace: string; startsAt: string; expiresAt: string; joinCount: number;
  maxMembers: number; partyId: string|null; joined: boolean; hasRoute: boolean; createdAt: string; source: "supabase";
}
