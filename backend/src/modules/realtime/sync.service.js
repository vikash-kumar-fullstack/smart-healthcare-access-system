import RealtimeEvent from "./realtime_event.model.js";

export const getSyncEvents = async (userId, afterSequence, reqLimit) => {
  const afterSeq = parseInt(afterSequence) || 0;
  const limit = Math.min(50, Math.max(1, parseInt(reqLimit) || 50));

  // 1. Get highest sequence number currently logged for this user
  const highestEvent = await RealtimeEvent.findOne({ userId }).sort({ sequenceNumber: -1 });
  const highest = highestEvent ? highestEvent.sequenceNumber : 0;

  // 2. Evaluate backpressure limit (exceeded 100 missed events)
  const missedCount = highest - afterSeq;
  if (afterSeq > 0 && missedCount > 100) {
    return {
      version: "v1",
      syncRequired: true,
      events: [],
      nextSequence: highest,
      hasMore: false
    };
  }

  if (afterSeq === 0) {
    return {
      version: "v1",
      syncRequired: false,
      events: [],
      nextSequence: highest,
      hasMore: false
    };
  }

  // 3. Query missed events within paginated range
  const events = await RealtimeEvent.find({
    userId,
    sequenceNumber: { $gt: afterSeq }
  })
    .sort({ sequenceNumber: 1 })
    .limit(limit + 1); // Get one extra to check if hasMore is true

  const hasMore = events.length > limit;
  if (hasMore) {
    events.pop();
  }

  const clientEvents = events.map(evt => ({
    eventId: evt.eventId,
    sequenceNumber: evt.sequenceNumber,
    type: evt.type,
    payload: evt.payload,
    eventVersion: evt.eventVersion,
    idempotencyKey: evt.idempotencyKey
  }));

  const nextSequence = clientEvents.length > 0 
    ? clientEvents[clientEvents.length - 1].sequenceNumber 
    : afterSeq;

  return {
    version: "v1",
    syncRequired: false,
    events: clientEvents,
    nextSequence,
    hasMore
  };
};
