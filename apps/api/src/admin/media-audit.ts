const OPEN_WINDOW_MS = 30 * 60 * 1000;
const MAX_TRACKED_OPENS = 5000;

export type MediaAccess = {
  kind: string;
  id: string;
  photoId?: string;
  revision?: number;
  download: boolean;
  range?: string;
  restricted?: boolean;
};

const startsMedia = (range: string | undefined) => !range || /^bytes=0-/i.test(range);

/**
 * Decides which media requests write an audit row. Only a ranged read from the
 * middle of media this session already opened may skip it, so no crafted range
 * can reach private bytes unrecorded. Downloads and restricted views are always
 * recorded. Losing this per-process memory only adds rows, it never removes them.
 */
export function createMediaOpenLog(now: () => number = Date.now) {
  const opened = new Map<string, number>();
  const keyOf = (sessionId: string, media: MediaAccess) =>
    [sessionId, media.kind, media.id, media.photoId ?? "", media.revision ?? ""].join(":");
  return {
    needsAudit(sessionId: string, media: MediaAccess) {
      if (media.download || media.restricted || startsMedia(media.range)) return true;
      const openedAt = opened.get(keyOf(sessionId, media));
      return openedAt === undefined || now() - openedAt > OPEN_WINDOW_MS;
    },
    recorded(sessionId: string, media: MediaAccess) {
      const key = keyOf(sessionId, media);
      opened.delete(key);
      opened.set(key, now());
      if (opened.size > MAX_TRACKED_OPENS) opened.delete(opened.keys().next().value!);
    },
  };
}
