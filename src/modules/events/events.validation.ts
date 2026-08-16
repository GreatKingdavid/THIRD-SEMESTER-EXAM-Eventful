import { z } from "zod";

export const createEventSchema = z.object({
  body: z.object({
    title: z.string().min(2),
    description: z.string().min(2),
    location: z.string().min(2),
    date: z.string().datetime(),
    price: z.number().nonnegative().default(0),
    capacity: z.number().int().positive().optional(),
    // e.g. 1440 = 1 day before, 10080 = 1 week before
    defaultReminderMinutesBefore: z.number().int().positive().optional(),
  }),
});

export const updateEventSchema = z.object({
  body: createEventSchema.shape.body.partial(),
  params: z.object({ id: z.string().uuid() }),
});

export const eventIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
