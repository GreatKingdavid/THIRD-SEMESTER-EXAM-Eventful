import { z } from "zod";

export const setReminderSchema = z.object({
  body: z.object({
    eventId: z.string().uuid(),
    // Fully flexible: any number of minutes before the event (10 mins, 1 hour, 1 day, 1 week, etc.)
    minutesBeforeEvent: z.number().int().positive(),
  }),
});
