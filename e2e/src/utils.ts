import superagent from 'superagent'

const SECRET_HASH = process.env.COGNITO_SECRET_HASH ?? 'uWApcJn5qL60BN6QWTtTX/FZ3N5GkNnChSsaRfk90po='
const CLIENT_ID = process.env.COGNITO_CLIENT_ID ?? '6npeetnvf8i4dillrbcpiut1tb'

interface AuthToken {
  AuthenticationResult: AuthenticationResult
}

interface AuthenticationResult {
  AccessToken: string
  ExpiresIn: number
  IdToken: string
  RefreshToken: string
  TokenType: string
}
export async function getCognitoToken(): Promise<AuthToken> {
  const headers = {
    'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
    'Content-Type': 'application/x-amz-json-1.1',
  }
  const data = {
    AuthParameters: {
      USERNAME: process.env.COGNITO_USERNAME ?? 'fe_test@codeleap.de',
      PASSWORD: process.env.COGNITO_PASSWORD ?? 'toto4242',
      SECRET_HASH,
    },
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: CLIENT_ID,
  }
  const COGNITO_API = process.env.COGNITO_API ?? 'https://cognito-idp.eu-west-1.amazonaws.com/'
  const result = await superagent.post(COGNITO_API).set(headers).send(JSON.stringify(data))
  return JSON.parse(result.body.toString()) as AuthToken
}

export async function postFn(url: string, token: string, data: any, deviceId?: string) {
  const headers = {
    'x-device-id': deviceId ?? 'iTnk',
    Authorization: `Bearer ${token}`,
  }
  return superagent.post(url).set(headers).send(JSON.stringify(data))
}

export async function deleteFn(url: string, token: string, deviceId?: string) {
  const headers = {
    'x-device-id': deviceId ?? 'iTnk',
    Authorization: `Bearer ${token}`,
  }
  return superagent.delete(url).set(headers).send()
}

export async function getFn(url: string, token: string, query?: object, deviceId?: string) {
  const headers = {
    'x-device-id': deviceId ?? 'iTnk',
    Authorization: `Bearer ${token}`,
  }
  let request = superagent.get(url).set(headers)
  if (query) {
    request = request.query(query!)
  }
  return request.send()
}

export async function patchFn(url: string, token: string, data: any, deviceId?: string) {
  const headers = {
    'x-device-id': deviceId ?? 'iTnk',
    Authorization: `Bearer ${token}`,
  }
  return superagent.patch(url).set(headers).send(JSON.stringify(data))
}
