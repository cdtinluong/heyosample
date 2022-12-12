import axios from 'axios'
import { sendAmplitudeEvent, EventType } from '../services'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('AmplitudeService', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  const event = {
    event_type: EventType.UserCreated,
    user_id: 'dfc0ac8d-9a01-41b6-a560-5c04bee18021',
    device_id: 'bf6c27a5-cf07-4d71-b856-dc5d1f1ae73f',
    user_properties: {
      linCloud: 'enabled',
    },
  }

  it('should send event successfully', async () => {
    mockedAxios.post.mockResolvedValueOnce({})

    const result = await sendAmplitudeEvent(event)

    expect(result).toBeTruthy()
  })

  it('should send event error', async () => {
    mockedAxios.post.mockRejectedValueOnce({ message: 'bad request' })

    const result = await sendAmplitudeEvent(event)

    expect(result).toBeFalsy()
  })
})
