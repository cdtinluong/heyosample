# LinCloud Cognito

## Process

Below you'll find some example to go through all Cognito's processes manually and locally.

We're using the [aws-cli](https://awscli.amazonaws.com/v2/documentation/api/latest/reference/index.html) but you can find the correspondence with the [API](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/Welcome.html).

### Create User

First create the user:
```bash
AWS_PROFILE=your-profile aws cognito-idp sign-up --client-id {clientId} --username {email} --password {password} --user-attributes Name="email",Value="{email}" Name="given_name",Value="{firstName}" Name="family_name",Value="{lastName}"
````

#### Admin
As an *admin*:
```bash
AWS_PROFILE=your-profile aws cognito-idp admin-confirm-sign-up --username {email} --user-pool-id {userpoolId}
```

#### User
As a *user* by using a code you received by email:
```bash
AWS_PROFILE=your-profile aws cognito-idp confirm-sign-up --username {email} --client-id {clientId} --confirmation-code {code}
```

### Authenticate

#### Admin
As an *admin*:
```bash
AWS_PROFILE=your-profile aws cognito-idp admin-initiate-auth --user-pool-id {userpoolId} --client-id {clientId} --auth-flow ADMIN_NO_SRP_AUTH --auth-parameters USERNAME={email},PASSWORD={password}
```

#### User
As a *user*:
```bash
AWS_PROFILE=your-profile aws cognito-idp initiate-auth --client-id {clientId} --auth-flow USER_PASSWORD_AUTH --auth-parameters USERNAME={email},PASSWORD={password}
```

In the case you receive a challenge from the previous call, it's most likely to change your password so you can do as follow:
```bash
AWS_PROFILE=your-profile aws cognito-idp respond-to-auth-challenge --client-id {clientId} --challenge-name NEW_PASSWORD_REQUIRED --challenge-responses USERNAME={email},NEW_PASSWORD={password},userAttributes.given_name={firstName},userAttributes.family_name={lastName} --session {session}
```

If by any change (or not) your challenge is not the one mentioned above then you can consult this [page](https://docs.aws.amazon.com/cli/latest/reference/cognito-idp/respond-to-auth-challenge.html) and act accordingly.

### Forgot Password

First trigger the forgot password:
```bash
AWS_PROFILE=your-profile aws cognito-idp forgot-password --client-id {clientId} --username {email}
```

Then you'll receive an email with a verification code you should use such as:
```bash
AWS_PROFILE=your-profile aws cognito-idp confirm-forgot-password --client-id {clientId} --username {email} --confirmation-code {code} --password {password}
```

### Logout

To logout from one device, you need to revoke the refresh token you've:
```bash
AWS_PROFILE=your-profile aws cognito-idp revoke-token --client-id {clientId} --token {refreshToken}
```

### User's deletion

The user's deletion is handled by the API, however you still need to revoke all tokens for all devices link to a user.

#### Admin
As a *admin*:
```bash
AWS_PROFILE=your-profile aws cognito-idp admin-user-global-sign-out --user-pool-id {userpoolId} --username {email}
```

#### User
As a *user*:
```bash
AWS_PROFILE=your-profile aws cognito-idp global-sign-out --access-token {accessToken}
```

### Further notes

The command line below will automatically trigger the `Create User` and `Authenticate` mentioned above as admin process and provide you a token:
```bash
yarn claim-token \
  --clientId {clientId} \
  --clientSecret {clientSecret} \
  --poolId {userpoolId} \
  --email {email} \
  --password {password} \
  --first-name {firstName} \
  --last-name {lastName}
```

## Use AWS SES instead of cognito email

> Every time a user signs up for our application or requests a password recovery, AWS Cognito sends them an email. By default, Cognito sends emails from `no-reply@verificationemail.com`.

> Cognito only integrates with SES in 3 regions - `us-east-1`, `us-west-2` and `eu-west-1` - [Cognito Docs](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-email.html#user-pool-email-developer)

The default email configuration has many [restrictions and quotas](https://docs.aws.amazon.com/cognito/latest/developerguide/limits.html#resource-quotas), for example - `we can only send 50 emails per day and the subject of the email has to be less than 140 characters long`.

In order to configure SES for a Cognito User Pool in CDK, we have to get access to the [CfnUserPool](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cognito.CfnUserPool.html) construct and update its [emailConfiguration](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cognito.CfnUserPool.html#emailconfiguration) property.

```typescript
const userPool = new cognito.UserPool(this, 'user-pool-id', {
  //...rest
});

// 👇 update Email sender for Cognito Emails
const cfnUserPool = userPool.node.defaultChild as cognito.CfnUserPool;
cfnUserPool.emailConfiguration = {
  emailSendingAccount: 'DEVELOPER',
  replyToEmailAddress: 'YOUR_EMAIL@example.com',
  sourceArn: `arn:aws:ses:YOUR_COGNITO_SES_REGION:${
    cdk.Stack.of(this).account
  }:identity/YOUR_FROM_EMAIL@example.com`,
};
```

Let's go over the properties we've set for email configuration:

- [emailSendingAccount](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cognito.CfnUserPool.EmailConfigurationProperty.html#emailsendingaccount) specifies whether Cognito should use the default email provider or our custom SES configuration. The `DEVELOPER` setting indicates that we'll provide our custom SES config.
- [replyToEmailAddress](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cognito.CfnUserPool.EmailConfigurationProperty.html#replytoemailaddress) specifies the email address users will be replying to
- [sourceArn](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cognito.CfnUserPool.EmailConfigurationProperty.html#sourcearn) specifies the ARN of a verified email address. Note that cognito only integrates with SES in 3 regions: `us-east-1`, `us-west-2`, `eu-west-1`. The SES `from-email` has to be [verified](https://docs.aws.amazon.com/ses/latest/DeveloperGuide/verify-email-addresses.html) in the specific region, and your SES account must be [out of the sandbox](https://docs.aws.amazon.com/ses/latest/DeveloperGuide/request-production-access.html).
