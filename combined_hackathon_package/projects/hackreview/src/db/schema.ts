import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Personal triage state for each idea in the dossier (status, notes, score overrides).
export const ideaState = pgTable("idea_state", {
  slug: text("slug").primaryKey(),
  status: text("status").notNull().default("none"),
  note: text("note").notNull().default(""),
  scores: jsonb("scores").$type<Record<string, number>>(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type IdeaStateRow = typeof ideaState.$inferSelect;
