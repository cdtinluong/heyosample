FROM node:16-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and tsconfig.json into working directory
COPY *.json ./

# Install dependencies (Need to fixed version of NPM or later we can have error)
RUN npm install --location=global npm@8.15.0
RUN npm install
RUN npm install -g @aws-sdk/signature-v4-crt
# Copy source
COPY src/ ./src

# Compile TS into JS
RUN npx tsc

# Launch the Dockerfile
ENTRYPOINT ["npm", "start"]
