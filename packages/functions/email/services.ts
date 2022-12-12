import env from 'cdk/lib/env'
import axios, { AxiosResponse } from 'axios'

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${env.BRAZE_API_KEY}`,
}

export const emailTriggerSource = {
  CustomEmailSender_ResendCode: 'CustomEmailSender_ResendCode',
  CustomEmailSender_ForgotPassword: 'CustomEmailSender_ForgotPassword',
  CustomEmailSender_SignUp: 'CustomEmailSender_SignUp',
  CustomEmailSender_OrderConfirmation: 'CustomEmailSender_OrderConfirmation',
  CustomEmailSender_AutoRenewal: 'CustomEmailSender_AutoRenewal',
  CustomEmailSender_TrialExpiration: 'CustomEmailSender_TrialExpiration',
  CustomEmailSender_SubscriptionCancellation: 'CustomEmailSender_SubscriptionCancellation',
  CustomEmailSender_TransactionFailed: 'CustomEmailSender_TransactionFailed',
  CustomEmailSender_AccountDeactivation: 'CustomEmailSender_AccountDeactivation',
}

interface EmailTemplateValue {
  name: string
  params: string[]
}

export const emailTemplateMap: Record<string, EmailTemplateValue> = {
  [emailTriggerSource.CustomEmailSender_ResendCode]: {
    name: 'Forgot_Password',
    params: ['{{verification_code}}'],
  },
  [emailTriggerSource.CustomEmailSender_ForgotPassword]: {
    name: 'Forgot_Password',
    params: ['{{verification_code}}'],
  },
  [emailTriggerSource.CustomEmailSender_SignUp]: {
    name: 'Account_Creation',
    params: ['{{verification_code}}'],
  },
  [emailTriggerSource.CustomEmailSender_OrderConfirmation]: {
    name: 'Order_Confirmation',
    params: ['{{plan_name}}'],
  },
  [emailTriggerSource.CustomEmailSender_AutoRenewal]: {
    name: 'Auto_Renewal',
    params: ['{{renew_date}}', '{{amount}}'],
  },
  [emailTriggerSource.CustomEmailSender_TrialExpiration]: {
    name: 'Trial_Expiration',
    params: ['{{amount}}'],
  },
  [emailTriggerSource.CustomEmailSender_SubscriptionCancellation]: {
    name: 'Subscription_Cancellation',
    params: ['{{account_settings}}'],
  },
  [emailTriggerSource.CustomEmailSender_TransactionFailed]: {
    name: 'Transaction_Failed',
    params: ['{{details}}'],
  },
  [emailTriggerSource.CustomEmailSender_AccountDeactivation]: {
    name: 'Account_Deactivation',
    params: [],
  },
}

interface Template {
  email_template_id: string
  template_name: string
  created_at: Date
  updated_at: Date
  tags: string[]
}
interface TemplateListResponse {
  count: number
  templates: Template[]
  message: string
}

interface TemplateResponse extends Template {
  description: string
  subject: string
  preheader: string
  body: string
  plaintext_body: string | null
  should_inline_css: boolean
  message: string
}

export async function sendEmail(triggerSource: string, userId: string, params: string[] = []) {
  const templates: AxiosResponse<TemplateListResponse> = await axios.get(
    `${env.BRAZE_REST_ENDPOINT}/templates/email/list`,
    { headers },
  )
  const templateId: string =
    templates.data.templates.find(
      (template: { template_name: string }) => template.template_name === emailTemplateMap[triggerSource].name,
    )?.email_template_id ?? ''
  const template: AxiosResponse<TemplateResponse> = await axios.get(
    `${env.BRAZE_REST_ENDPOINT}/templates/email/info?email_template_id=${templateId}`,
    {
      headers,
    },
  )

  let { body } = template.data
  const { subject } = template.data

  if (params.length > 0) {
    emailTemplateMap[triggerSource].params.forEach((param, index) => {
      body = body.replace(param, params[index])
    })
  }

  await axios.post(
    `${env.BRAZE_REST_ENDPOINT}/messages/send`,
    {
      external_user_ids: [userId],
      messages: {
        email: {
          app_id: env.BRAZE_APP_ID,
          from: `LinCloud <${env.BRAZE_SENDER_EMAIL}>`,
          reply_to: 'NO_REPLY_TO',
          subject,
          body,
        },
      },
    },
    { headers },
  )
}

export async function createBrazeUser(userId: string, email: string) {
  await axios.post(
    `${env.BRAZE_REST_ENDPOINT}/users/track`,
    {
      attributes: [
        {
          _update_existing_only: false,
          external_id: userId,
          email,
        },
      ],
    },
    { headers },
  )
}
