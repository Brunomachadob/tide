---
name: agent test
schedule: manual
agentRunner: true
agentAuth:
  strategy: tsh-okta-bedrock
  app: n26-dev-eu
  awsRole: bedrock-developer-user
  teleportProxy: teleport.access26.de:443
  model: arn:aws:bedrock:eu-central-1:538639307912:application-inference-profile/xswegkx4emk1
_id: "cadda1ce"
_createdAt: "2026-04-03T11:40:30Z"
_jitter: 0
_enabled: true
---
Explore the /Users/brunobrandao/git/tide/src directory. List all the files, read each one, and write a detailed summary of the codebase architecture: what each module does, how they interact, and what the main data flows are.
