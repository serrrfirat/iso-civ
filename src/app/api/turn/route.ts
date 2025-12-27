import { NextResponse } from 'next/server';

// Twilio credentials from environment
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

// Cache TURN credentials for 1 hour (they're valid for 24 hours)
let cachedCredentials: { iceServers: RTCIceServer[]; expiry: number } | null = null;

export async function GET() {
  // Check cache first
  if (cachedCredentials && Date.now() < cachedCredentials.expiry) {
    return NextResponse.json({ iceServers: cachedCredentials.iceServers });
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio credentials');
    // Return just STUN servers as fallback
    return NextResponse.json({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
  }

  try {
    // Fetch TURN credentials from Twilio
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Tokens.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Twilio API error:', error);
      throw new Error('Failed to fetch TURN credentials');
    }

    const data = await response.json();
    
    // Twilio returns ice_servers array
    const iceServers = data.ice_servers || [];
    
    // Cache for 1 hour
    cachedCredentials = {
      iceServers,
      expiry: Date.now() + 60 * 60 * 1000,
    };

    return NextResponse.json({ iceServers });
  } catch (error) {
    console.error('Error fetching TURN credentials:', error);
    // Return STUN-only fallback
    return NextResponse.json({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
  }
}
