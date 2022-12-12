import axios from 'axios'
import env from 'cdk/lib/env'

export enum EventType {
  UserCreated = 'LinCloudUser.CreatedUser',
  LoggedIn = 'LinCloudUser.LoggedIn',
  LoggedOut = 'LinCloudUser.LoggedOut',
}

export interface AmplitudeEvent {
  event_type: string
  user_id: string
  device_id?: string
  user_properties: any
}

export async function sendAmplitudeEvent(event: AmplitudeEvent): Promise<boolean> {
  try {
    const body = {
      api_key: env.AMPLITUDE_API_KEY,
      events: [event],
    }

    await axios.post(env.AMPLITUDE_BASE_URL, body, {
      headers: {
        'Content-Type': 'application/json',
        Accept: '*/*',
      },
    })

    console.info(`Sent amplitude event with type ${event.event_type}`)
    return true
  } catch (err: any) {
    console.error('Failed to send amplitude event', err as Error)
    return false
  }
}
