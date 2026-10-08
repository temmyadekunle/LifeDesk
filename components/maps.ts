import type { IconName } from "./Icons";
import type { Category, Thing, ThingKind } from "@/lib/types";
import type { TKey } from "@/lib/locales/en";

/**
 * Presentation maps. Kept out of the screen components so an icon or colour can
 * be changed in one place, and so the same category never looks like two
 * different things on two different screens.
 */

export type ModuleId = "home" | "vehicles" | "bills" | "documents" | "assets";

const MODULE_CATEGORY: Record<ModuleId, Category | "asset"> = {
  home: "home",
  vehicles: "transport",
  bills: "money",
  documents: "documents",
  assets: "asset",
};

export function moduleThings(things: Thing[], id: ModuleId): Thing[] {
  const target = MODULE_CATEGORY[id];
  return things.filter((x) => {
    if (x.status !== "active") return false;
    if (target === "asset") return x.kind === "asset";
    return x.category === target && x.kind !== "asset";
  });
}

export const MODULES: {
  id: ModuleId;
  labelKey: TKey;
  blurbKey: TKey;
  ico: string;
  color: string;
}[] = [
  {
    id: "home",
    labelKey: "module.home",
    blurbKey: "module.home.blurb",
    ico: "🏠",
    color: "var(--home)",
  },
  {
    id: "vehicles",
    labelKey: "module.vehicles",
    blurbKey: "module.vehicles.blurb",
    ico: "🚗",
    color: "var(--transport)",
  },
  {
    id: "bills",
    labelKey: "module.bills",
    blurbKey: "module.bills.blurb",
    ico: "💳",
    color: "var(--money)",
  },
  {
    id: "documents",
    labelKey: "module.documents",
    blurbKey: "module.documents.blurb",
    ico: "📄",
    color: "var(--documents)",
  },
  {
    id: "assets",
    labelKey: "module.assets",
    blurbKey: "module.assets.blurb",
    ico: "📦",
    color: "var(--assets)",
  },
];

export const CATEGORY_META: Record<
  Category,
  { icon: IconName; color: string; labelKey: TKey }
> = {
  home: { icon: "home", color: "var(--home)", labelKey: "cat.home" },
  transport: { icon: "car", color: "var(--transport)", labelKey: "cat.transport" },
  money: { icon: "wallet", color: "var(--money)", labelKey: "cat.money" },
  documents: { icon: "file", color: "var(--documents)", labelKey: "cat.documents" },
  family: { icon: "users", color: "var(--family)", labelKey: "cat.family" },
  tasks: { icon: "checkSquare", color: "var(--tasks)", labelKey: "cat.tasks" },
  services: { icon: "wrench", color: "var(--services)", labelKey: "cat.services" },
};

export const CATEGORIES = Object.keys(CATEGORY_META) as Category[];

export const KIND_ICON: Record<ThingKind, IconName> = {
  rent: "home",
  utility: "zap",
  bill: "receipt",
  subscription: "repeat",
  "school-fee": "graduation",
  vehicle: "car",
  fuel: "fuel",
  maintenance: "wrench",
  insurance: "shieldCheck",
  document: "file",
  asset: "package",
  appointment: "calendar",
  reminder: "bell",
  "service-provider": "pin",
  task: "checkSquare",
  birthday: "cake",
  "important-date": "flag",
};

export const KIND_LABEL_KEY: Record<ThingKind, TKey> = {
  rent: "kind.rent",
  utility: "kind.utility",
  bill: "kind.bill",
  subscription: "kind.subscription",
  "school-fee": "kind.school-fee",
  vehicle: "kind.vehicle",
  fuel: "kind.fuel",
  maintenance: "kind.maintenance",
  insurance: "kind.insurance",
  document: "kind.document",
  asset: "kind.asset",
  appointment: "kind.appointment",
  reminder: "kind.reminder",
  "service-provider": "kind.service-provider",
  task: "kind.task",
  birthday: "kind.birthday",
  "important-date": "kind.important-date",
};

export const MODULE_ICON: Record<ModuleId, IconName> = {
  home: "home",
  vehicles: "car",
  bills: "wallet",
  documents: "file",
  assets: "package",
};