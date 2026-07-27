import erasJson from '../data/eras.json';
import eventsJson from '../data/events.json';
import toursJson from '../data/tours.json';
import {
  erasSchema,
  storyEventsSchema,
  toursSchema,
  type Era,
  type StoryEvent,
  type Tour,
} from '../data/schema';

const eras = erasSchema.parse(erasJson);
const events = storyEventsSchema.parse(eventsJson);
const tours = toursSchema.parse(toursJson);

export interface ContentRepository {
  getEras(): Promise<Era[]>;
  getEvents(): Promise<StoryEvent[]>;
  getEvent(eventId: string): Promise<StoryEvent | null>;
  getTours(): Promise<Tour[]>;
}

export class StaticJsonRepository implements ContentRepository {
  async getEras(): Promise<Era[]> {
    return structuredClone(eras);
  }

  async getEvents(): Promise<StoryEvent[]> {
    return structuredClone(events);
  }

  async getEvent(eventId: string): Promise<StoryEvent | null> {
    const event = events.find((item) => item.id === eventId) ?? null;
    return structuredClone(event);
  }

  async getTours(): Promise<Tour[]> {
    return structuredClone(tours);
  }
}
