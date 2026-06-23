// lib/pusher-client.ts
import PusherDefault from "pusher-js";

// pusher-js ships as a UMD/CJS bundle; webpack interop can hand back the module
// namespace instead of the constructor ("is not a constructor"). Unwrap .default.
const Pusher = (((PusherDefault as any)?.default ?? PusherDefault) as typeof PusherDefault);

export const pusherClient = new Pusher(
  process.env.NEXT_PUBLIC_PUSHER_KEY!,
  {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    forceTLS: true,
  }
);
