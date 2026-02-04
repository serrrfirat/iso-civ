import { NextRequest } from 'next/server';
import { getGame, subscribe } from '@/server/gameStore';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gameId = `game_${id}`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial state
      const state = getGame(gameId);
      if (state) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'state', data: state })}\n\n`)
        );
      }

      // Subscribe to updates
      const unsubscribe = subscribe(gameId, (state, event) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: event, data: state })}\n\n`)
          );
        } catch {
          unsubscribe();
        }
      });

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
