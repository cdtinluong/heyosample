import axios from 'axios'
import { faker } from '@faker-js/faker'
import { createBrazeUser, sendEmail } from '../services'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

const userId = faker.datatype.uuid()
const email = faker.internet.email()
const templateId = faker.datatype.uuid()

describe('EmailService', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('createBrazeUser', () => {
    it('should create user successfully', async () => {
      mockedAxios.post.mockResolvedValue({})

      await createBrazeUser(userId, email)

      expect(mockedAxios.post).toBeCalledTimes(1)
    })
  })

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      mockedAxios.post.mockResolvedValue({})
      mockedAxios.get
        .mockResolvedValueOnce({
          data: {
            count: 1,
            message: 'success',
            templates: [
              {
                email_template_id: templateId,
                template_name: 'user_creation',
                created_at: '2022-11-22T07:11:06.563Z',
                updated_at: '2022-11-22T07:11:06.563Z',
                tags: [],
              },
            ],
          },
        })
        .mockResolvedValueOnce({
          data: {
            email_template_id: templateId,
            template_name: 'user_creation',
            description: '',
            subject: 'Verifying your account',
            preheader: '',
            body: '<!DOCTYPE html>\n<html>\n  <header>\n    <title>hello</title>\n  </header>\n  <body>\n    <table>\n      <tr>\n        <td>Welcome to linearity!</td>\n      </tr>\n      <tr>\n        <td>Please click the link below to verify your new email address:</td>\n      </tr>\n      <tr>\n        <td>{{verification_code}}</td>\n      </tr>\n    </table>\n  </body>\n  \n \n  \n</html>',
            plaintext_body: null,
            should_inline_css: true,
            tags: [],
            created_at: '2022-11-22T07:11:06.563+00:00',
            updated_at: '2022-11-22T08:51:16.768+00:00',
            message: 'success',
          },
        })

      await sendEmail('CustomEmailSender_SignUp', userId, ['12345'])

      expect(mockedAxios.get).toBeCalledTimes(2)
      expect(mockedAxios.post).toBeCalledTimes(1)
    })
  })
})
