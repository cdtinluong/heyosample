#!/bin/bash

debug=0
if [[ $# -eq 0 ]]; then
  echo 'usage: create-user [parameters]'
  echo 'paramters:'
  echo '-c --clientId: Cognito ClientId'
  echo '-i --poolId: Cognito UserPoolId'
  echo '-s --clientSecret: Cognito ClientSecret'
  echo '-p --password: Password of new User'
  echo '-fn --frist-name: first name of new User'
  echo '-ln --last-name: last name of new User'
  echo '-e --email: Email of new User'
  echo '-r --region: Cogntio AWS Region'
  echo '-d --debug: Enable Debug Mode'
  echo 'example: ./create-user.sh --email your@mail.com --password test123456 --clientId xyz --poolId eu-west-1_AABBCC --region eu-west-1'
  exit 1
fi

region=eu-west-1

while [[ "$#" > 0 ]]; do
  case $1 in
  -c | --clientId)
    clientId="$2"
    shift
    ;;
  -i | --poolId)
    userpool="$2"
    shift
    ;;
  -s | --clientSecret)
    clientSecret="$2"
    shift
    ;;
  -e | --email)
    email="$2"
    shift
    ;;
  -p | --password)
    password="$2"
    shift
    ;;
  -fn | --first-name)
    firstName="$2"
    shift
    ;;
  -ln | --last-name)
    lastName="$2"
    shift
    ;;
  -r | --region)
    region="$2"
    shift
    ;;
  -d | --debug) debug=1 ;;
  *)
    echo "Unknown parameter passed: $1"
    exit 1
    ;;
  esac
  shift
done

GREEN='\033[0;32m'
NC='\033[0m'

aws configure set region $region

# Create SECRET HASH
SECRET_HASH=$(echo -n $email$clientId | openssl dgst -sha256 -hmac $clientSecret -binary | base64)

if [ $debug -eq 1 ]; then
  echo -e "[${GREEN} DEBUG MODE IS ON ${NC}]"
  # echo -e "AWS Caller Identity: "
  # aws sts get-caller-identity
  echo -e "AWS Region:"
  aws configure get region
fi

if [ $debug -eq 1 ]; then
  echo -e "[${GREEN} CREATING USER ${NC}]"
  echo "[invoke] aws cognito-idp sign-up --client-id $clientId --secret-hash $SECRET_HASH --username $email --password $password --user-attributes Name="email",Value="$email" Name="given_name",Value="$firstName" Name="family_name",Value="$lastName""
  aws cognito-idp sign-up --client-id $clientId --secret-hash $SECRET_HASH --username $email --password $password --user-attributes Name="email",Value="$email" Name="given_name",Value="$firstName" Name="family_name",Value="$lastName"
else
  aws cognito-idp sign-up --client-id $clientId --secret-hash $SECRET_HASH --username $email --password $password --user-attributes Name="email",Value="$email" Name="given_name",Value="$firstName" Name="family_name",Value="$lastName" >/dev/null 2>&1
fi

if [ $debug -eq 1 ]; then
  echo -e "[${GREEN} CONFIRMING USER ${NC}]"
  echo "[invoke] aws cognito-idp admin-confirm-sign-up --username $email --user-pool-id $userpool"
  aws cognito-idp admin-confirm-sign-up --username $email --user-pool-id $userpool
else
  aws cognito-idp admin-confirm-sign-up --username $email --user-pool-id $userpool >/dev/null 2>&1
fi

if [ $debug -eq 1 ]; then
  echo -e "[${GREEN} LOGIN USER ${NC}]"
  echo "aws cognito-idp admin-initiate-auth --user-pool-id $userpool --client-id $clientId --auth-flow ADMIN_NO_SRP_AUTH --auth-parameters USERNAME=$email,PASSWORD=$password,SECRET_HASH=$SECRET_HASH"
fi
token=$(aws cognito-idp admin-initiate-auth --user-pool-id $userpool --client-id $clientId --auth-flow ADMIN_NO_SRP_AUTH --auth-parameters USERNAME=$email,PASSWORD=$password,SECRET_HASH=$SECRET_HASH | jq -r '.AuthenticationResult.IdToken')
echo $token
