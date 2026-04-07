// Auto Call Service (Mocked - Twilio/Exotel Integration)
// In production: POST to Node.js backend /trigger-call
// Backend calls Twilio API with TTS voice message

export interface CallTriggerParams {
  patientPhone: string;
  patientName: string;
  medicineName: string;
  caregiverPhone?: string;
  caregiverName?: string;
  missedCount: number;
}

export interface CallResult {
  success: boolean;
  callSid?: string;
  message: string;
  timestamp: string;
}

// In production: Replace with real API endpoint
const BACKEND_URL = 'https://api.aarvitacare.com/trigger-call';

export async function triggerAutoCall(params: CallTriggerParams): Promise<CallResult> {
  // MOCKED: Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Simulate success response
  const mockCallSid = 'CA' + Math.random().toString(36).substr(2, 32).toUpperCase();

  console.log('[MOCK] Auto call triggered:', {
    to: params.patientPhone,
    message: `${params.patientName}, you have missed ${params.missedCount} doses of ${params.medicineName}. Please take your medicine immediately.`,
    backend: BACKEND_URL,
  });

  if (params.caregiverPhone) {
    console.log('[MOCK] Caregiver call triggered:', {
      to: params.caregiverPhone,
      message: `Hello ${params.caregiverName || 'Caregiver'}, your family member ${params.patientName} has missed ${params.missedCount} doses of ${params.medicineName}. Please check on them.`,
    });
  }

  return {
    success: true,
    callSid: mockCallSid,
    message: params.caregiverPhone
      ? `Calls initiated to ${params.patientPhone} and caregiver ${params.caregiverPhone}`
      : `Call initiated to ${params.patientPhone}`,
    timestamp: new Date().toISOString(),
  };
}

// Real backend implementation reference:
/*
POST /trigger-call
{
  "patientPhone": "+919876543210",
  "patientName": "Ramesh",
  "medicineName": "Metformin",
  "caregiverPhone": "+919876543211",
  "caregiverName": "Priya",
  "missedCount": 2,
  "language": "hi-IN"
}

Node.js Express handler:
const twilio = require('twilio');
const client = twilio(TWILIO_SID, TWILIO_TOKEN);

app.post('/trigger-call', async (req, res) => {
  const call = await client.calls.create({
    twiml: `<Response><Say language="${req.body.language}">
      ${buildMessage(req.body)}
    </Say></Response>`,
    to: req.body.patientPhone,
    from: TWILIO_FROM_NUMBER,
  });
  res.json({ success: true, callSid: call.sid });
});
*/
