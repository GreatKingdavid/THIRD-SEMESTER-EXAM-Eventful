import { prisma } from "../../config/db";
import { ApiError } from "../../utils/apiError";
import { cacheAside, invalidateCache } from "../../utils/cache";

interface CreateEventInput {
  title: string;
  description: string;
  location: string;
  date: string;
  price?: number;
  capacity?: number;
  defaultReminderMinutesBefore?: number;
}

export class EventsService {
  async create(creatorId: string, input: CreateEventInput) {
    const event = await prisma.event.create({
      data: { ...input, date: new Date(input.date), creatorId },
    });

    // If the creator wants a default reminder, create one for themselves as a template;
    // actual per-eventee reminders are created when someone buys a ticket (see tickets.service)
    await invalidateCache("events:all:*");
    return event;
  }

  /** All events visible to eventees, browsable/paginated, cached to avoid hammering the DB */
  async listAll(page = 1, pageSize = 20) {
    const cacheKey = `events:all:page:${page}:size:${pageSize}`;
    return cacheAside(cacheKey, async () => {
      const [items, total] = await Promise.all([
        prisma.event.findMany({
          orderBy: { date: "asc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: { creator: { select: { id: true, name: true } } },
        }),
        prisma.event.count(),
      ]);
      return { items, total, page, pageSize };
    });
  }

  /** Events a specific creator has created */
  async listByCreator(creatorId: string) {
    const cacheKey = `events:creator:${creatorId}`;
    return cacheAside(cacheKey, () =>
      prisma.event.findMany({
        where: { creatorId },
        orderBy: { date: "asc" },
      })
    );
  }

  async getById(id: string) {
    const event = await prisma.event.findUnique({
      where: { id },
      include: { creator: { select: { id: true, name: true } } },
    });
    if (!event) throw ApiError.notFound("Event not found");
    return event;
  }

  async update(id: string, creatorId: string, input: Partial<CreateEventInput>) {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw ApiError.notFound("Event not found");
    if (event.creatorId !== creatorId) throw ApiError.forbidden("You do not own this event");

    const updated = await prisma.event.update({
      where: { id },
      data: { ...input, date: input.date ? new Date(input.date) : undefined },
    });

    await invalidateCache("events:all:*");
    await invalidateCache(`events:creator:${creatorId}`);
    return updated;
  }

  async remove(id: string, creatorId: string) {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw ApiError.notFound("Event not found");
    if (event.creatorId !== creatorId) throw ApiError.forbidden("You do not own this event");

    await prisma.event.delete({ where: { id } });
    await invalidateCache("events:all:*");
    await invalidateCache(`events:creator:${creatorId}`);
  }

  /** Builds shareable social links for an event (Shareability requirement) */
  buildShareLinks(eventId: string, title: string, appUrl: string) {
    const eventUrl = `${appUrl}/events/${eventId}`;
    const text = encodeURIComponent(`Check out this event: ${title}`);
    const url = encodeURIComponent(eventUrl);
    return {
      eventUrl,
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      whatsapp: `https://wa.me/?text=${text}%20${url}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      telegram: `https://t.me/share/url?url=${url}&text=${text}`,
    };
  }
}

export const eventsService = new EventsService();
