export type Category =
  | "home"
  | "transport"
  | "money"
  | "documents"
  | "family"
  | "tasks"
  | "services";

export type ThingKind =
  | "rent"
  | "utility"
  | "bill"
  | "subscription"
  | "school-fee"
  | "vehicle"
  | "fuel"
  | "maintenance"
  | "insurance"
  | "document"
  | "asset"
  | "appointment"
  | "reminder"
  | "service-provider"
  | "task"
  | "birthday"
  | "important-date";

export type Frequency =
  | "none"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "biannual"
  | "annual";

export type Priority = "urgent" | "important" | "upcoming" | "routine";

export type Status = "active" | "completed" | "archived";

/**
 * The central model. A Thing is any responsibility the user is managing.
 * Type-specific fields live in `details` so one store covers every category.
 */
export interface Thing {
  id: string;
  name: string;
  category: Category;
  kind: ThingKind;
  amount: number | null;
  currency: "NGN";
  /** ISO date string (YYYY-MM-DD) */
  dueDate: string | null;
  /** Last date this responsibility was actually handled */
  lastHandledDate: string | null;
  recurrence: { frequency: Frequency; interval: number } | null;
  /** Days between services for maintenance-style things */
  serviceIntervalDays: number | null;
  status: Status;
  priority: Priority;
  notes: string | null;
  details: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  thingId: string;
  thingName: string;
  category: Category;
  kind: ThingKind;
  priority: Priority;
  reason: "overdue" | "expiring" | "recurring-due" | "service-overdue" | "no-record";
  title: string;
  message: string;
  dueDate: string | null;
  createdAt: string;
  dismissed: boolean;
}

export interface HouseholdMember {
  id: string;
  name: string;
  role: "owner" | "adult" | "child" | "trusted";
  createdAt: string;
}