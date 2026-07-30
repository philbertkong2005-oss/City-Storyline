import eventsJson from '../data/events.json';
import localitiesJson from '../data/localities.json';
import storylinesJson from '../data/storylines.json';
import visitablePlacesJson from '../data/visitablePlaces.json';
import {
  localitiesSchema,
  storyEventsSchema,
  storylinesSchema,
  visitablePlacesSchema,
  type Locality,
  type StoryEvent,
  type Storyline,
  type VisitablePlace,
} from '../data/schema';

const events = storyEventsSchema.parse(eventsJson);
const visitablePlaces = visitablePlacesSchema.parse(visitablePlacesJson);
const storylines = storylinesSchema.parse(storylinesJson);
const localities = localitiesSchema.parse(localitiesJson);

export interface ContentRepository {
  getStorylines(): Promise<Storyline[]>;
  getEvents(): Promise<StoryEvent[]>;
  getEvent(eventId: string): Promise<StoryEvent | null>;
  getVisitablePlaces(): Promise<VisitablePlace[]>;
  getLocalities(): Promise<Locality[]>;
}

export class StaticJsonRepository implements ContentRepository {
  async getStorylines(): Promise<Storyline[]> {
    return structuredClone(storylines);
  }

  async getEvents(): Promise<StoryEvent[]> {
    return structuredClone(events);
  }

  async getEvent(eventId: string): Promise<StoryEvent | null> {
    const event = events.find((item) => item.id === eventId) ?? null;
    return structuredClone(event);
  }

  async getVisitablePlaces(): Promise<VisitablePlace[]> {
    return structuredClone(visitablePlaces);
  }

  async getLocalities(): Promise<Locality[]> {
    return structuredClone(localities);
  }
}
